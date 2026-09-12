const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function harness(role = 'ADMIN') {
  let currentRole = role;
  const windowEvents = {};
  const elements = new Map();
  const requests = [];
  const documentEvents = {};
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, { innerHTML: '', textContent: '', hidden: true, open: true, close() { this.open = false; } });
    return elements.get(selector);
  }
  const context = vm.createContext({
    document: { querySelector: element, addEventListener(name, handler) { documentEvents[name] = handler; }, title: '' },
    window: { confirm() { return false; }, addEventListener(name, handler) { windowEvents[name] = handler; } },
    FormData: class { constructor(form) { this.values = form.values || {}; } [Symbol.iterator]() { return Object.entries(this.values)[Symbol.iterator](); } },
    sessionStorage: { getItem() { return null; }, removeItem() {} },
    setTimeout() {}, clearTimeout() {}, URLSearchParams, URL,
    fetch: async (url) => {
      requests.push(url);
      if (url.endsWith('/auth/me')) return { ok: currentRole !== null, status: currentRole === null ? 401 : 200, json: async () => ({ data: { userId: 1, role: currentRole } }) };
      if (url.includes('/users?')) return { ok: true, status: 200, json: async () => ({ data: { users: [], pagination: { page: 1, totalPages: 1, total: 0 } } }) };
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    },
  });
  const source = readFileSync(require.resolve('../public/app.js'), 'utf8').split('(async function start()')[0];
  vm.runInContext(source, context);
  vm.runInContext(`state.user = {userId:1,role:'${role}'}; state.view = 'users';`, context);
  return { context, elements, requests, element, documentEvents, setRole(value) { currentRole = value; }, focus: () => windowEvents.focus() };
}

test('window focus after demotion removes admin navigation, closes stale dialogs and loads an allowed view', async () => {
  const h = harness(); h.setRole('STUDENT');
  await h.focus();
  assert.equal(vm.runInContext('state.view', h.context), 'opportunities');
  assert.equal(h.element('#dialog').open, false);
  assert.doesNotMatch(h.element('#navigation').innerHTML, /data-view="users"/);
  assert.match(h.element('#navigation').innerHTML, /My profile/);
  assert.ok(h.requests.some(url => url.endsWith('/posts')));
});

test('unchanged focus preserves the current form and filters', async () => {
  const h = harness(); h.element('#main').innerHTML = 'unsaved form';
  vm.runInContext("state.userQuery = 'Professor Smith'; state.userRole = 'STUDENT'; state.userPage = 2;", h.context);
  await h.focus();
  assert.equal(h.element('#main').innerHTML, 'unsaved form');
  assert.equal(vm.runInContext('state.userQuery', h.context), 'Professor Smith');
  assert.equal(vm.runInContext('state.userPage', h.context), 2);
  assert.equal(h.requests.length, 1);
});

test('expired sessions return to sign-in and clear cached user data', async () => {
  const h = harness(); h.setRole(null);
  await h.focus();
  assert.equal(vm.runInContext('state.user', h.context), null);
  assert.match(h.element('#main').innerHTML, /Sign in with Microsoft/);
  assert.equal(vm.runInContext('state.users.length', h.context), 0);
});

test('navigation refreshes roles before fetching restricted data', async () => {
  const h = harness(); h.setRole('PROFESSOR');
  await vm.runInContext("navigate('users')", h.context);
  assert.equal(vm.runInContext('state.view', h.context), 'manage');
  assert.ok(!h.requests.some(url => url.includes('/users')));
  assert.doesNotMatch(h.element('#navigation').innerHTML, /data-view="users"/);
});

test('role-specific landing pages prioritize professor applications and admin accounts', async () => {
  for (const [role, view, endpoint] of [['PROFESSOR','manage','/posts/workspace'],['ADMIN','users','/users?'],['STUDENT','opportunities','/posts']]) {
    const h = harness(role);
    await vm.runInContext("navigate('home')", h.context);
    assert.equal(vm.runInContext('state.view', h.context), view);
    assert.ok(h.requests.some(url => url.includes(endpoint)));
  }
});

test('profile distinguishes saved data, unsaved edits, reverting edits, and navigation cancellation', async () => {
  const h = harness('STUDENT');
  h.element('#profile-form').values = { bio: 'Original' };
  vm.runInContext("state.view = 'profile'; renderProfile({id:3,bio:'Original'})", h.context);
  assert.match(h.element('#main').innerHTML, /Saved profile/);
  h.element('#profile-form').values.bio = 'Changed';
  vm.runInContext('updateProfileStatus()', h.context);
  assert.match(h.element('#profile-status').textContent, /Unsaved changes/);
  assert.equal(h.element('#save-profile').disabled, false);
  await vm.runInContext("navigate('applications')", h.context);
  assert.equal(vm.runInContext('state.view', h.context), 'profile');
  h.element('#profile-form').values.bio = 'Original';
  vm.runInContext('updateProfileStatus()', h.context);
  assert.equal(h.element('#save-profile').disabled, true);
});

test('professor posting filters show pending work and clear empty states', () => {
  const h = harness('PROFESSOR');
  vm.runInContext(`state.posts = [{id:1,title:'Research role',createdAt:'2026-01-01',status:'CLOSED',jobCategory:'RA',applicationCounts:{total:3,pending:2,accepted:1}}]; renderStaff();`, h.context);
  assert.match(h.element('#staff-posts').innerHTML, /2 awaiting review/);
  assert.match(h.element('#staff-posts').innerHTML, /Review applications/);
  vm.runInContext("staffFilter = 'OPEN'; renderStaffPosts()", h.context);
  assert.match(h.element('#staff-posts').innerHTML, /No matching postings/);
});

test('profile save failure preserves edits and retry success clears the unsaved state', async () => {
  const h = harness('STUDENT');
  const form = h.element('#profile-form');
  const submit = h.element('#save-profile');
  const error = {};
  const controls = [{disabled:false}];
  form.id = 'profile-form';
  form.values = { bio: 'Updated bio', skills: 'Research', faculty: '', major: '', gpa: '', workHoursPerWeek: '', resumeUrl: '' };
  form.querySelector = selector => selector === '[type=submit]' ? submit : error;
  form.querySelectorAll = () => controls;
  vm.runInContext("state.view = 'profile'; renderProfile({id:3}); profileDirty = true;", h.context);
  submit.disabled = false;
  h.context.fetch = async () => ({ok:false,status:500,json:async () => ({error:{message:'Unable to save'}})});
  await h.documentEvents.submit({target:form,preventDefault(){}});
  assert.match(h.element('#profile-status').textContent, /Save failed/);
  assert.equal(form.values.bio, 'Updated bio');
  assert.equal(submit.textContent, 'Retry save');
  assert.equal(submit.disabled, false);
  assert.equal(controls[0].disabled, false);
  assert.equal(vm.runInContext('profileDirty', h.context), true);
  h.context.fetch = async () => ({ok:true,status:200,json:async () => ({data:{id:3,...form.values,skills:['Research']}})});
  await h.documentEvents.submit({target:form,preventDefault(){}});
  assert.match(h.element('#main').innerHTML, /Profile saved successfully/);
  assert.equal(vm.runInContext('profileDirty', h.context), false);
});

test('permission failures reconcile the current role and discard the restricted view', async () => {
  const h = harness(); h.setRole('STUDENT');
  assert.equal(await vm.runInContext('recoverAccess({status:403})', h.context), true);
  assert.equal(vm.runInContext('state.view', h.context), 'opportunities');
});
