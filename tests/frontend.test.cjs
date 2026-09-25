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
  const location = { pathname: '/assistlink/users/', search: '', replaced: null, assigned: null,
    replace(path) { this.replaced = path; }, assign(path) { this.assigned = path; } };
  const history = { pushState(_state, _title, path) { location.pathname = path; }, replaceState(_state, _title, path) { location.pathname = path; } };
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, { innerHTML: '', textContent: '', hidden: true, open: true, events: {}, addEventListener(name, handler) { this.events[name] = handler; }, close() { this.open = false; }, showModal() { this.open = true; } });
    return elements.get(selector);
  }
  const context = vm.createContext({
    document: { querySelector: element, addEventListener(name, handler) { documentEvents[name] = handler; }, title: '' },
    window: { location, history, confirm() { return false; }, addEventListener(name, handler) { windowEvents[name] = handler; } },
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
  return { context, elements, requests, element, documentEvents, location, setRole(value) { currentRole = value; }, focus: () => windowEvents.focus(), popstate: () => windowEvents.popstate() };
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
  assert.match(h.element('#main').innerHTML, /Sign in to AssistLink/);
  assert.equal(h.location.replaced, '/assistlink/login/?next=%2Fassistlink%2Fusers%2F');
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

test('workspace navigation gives pages shareable paths and back navigation restores them', async () => {
  const h = harness('STUDENT');
  await vm.runInContext("navigate('profile')", h.context);
  assert.equal(h.location.pathname, '/assistlink/profile/');
  await vm.runInContext("navigate('applications')", h.context);
  assert.equal(h.location.pathname, '/assistlink/applications/');
  h.location.pathname = '/assistlink/profile/';
  await h.popstate();
  assert.equal(vm.runInContext('state.view', h.context), 'profile');
});

test('first session check preserves a directly opened permitted page', async () => {
  const h = harness('STUDENT');
  h.location.pathname = '/assistlink/profile/';
  vm.runInContext('state.user = null', h.context);
  await vm.runInContext("navigate('profile', false, 'none')", h.context);
  assert.equal(vm.runInContext('state.view', h.context), 'profile');
  assert.equal(h.location.pathname, '/assistlink/profile/');
  assert.ok(h.requests.some(url => url.endsWith('/me/profile')));
});

test('opportunity URLs parse numeric IDs and sign-in keeps a safe return path', () => {
  const h = harness(null);
  assert.equal(vm.runInContext("routeFromPath('/assistlink/opportunities/42/').postId", h.context), 42);
  h.location.pathname = '/assistlink/login/';
  h.location.search = '?next=%2Fassistlink%2Fopportunities%2F42%2F';
  vm.runInContext('signIn()', h.context);
  assert.match(h.element('#dialog-content').innerHTML, /next=%2Fassistlink%2Fopportunities%2F42%2F/);
  h.location.search = '?next=https%3A%2F%2Fevil.example';
  assert.equal(vm.runInContext('requestedPath()', h.context), '/assistlink/');
});

test('opening a shared opportunity URL restores its detail dialog', async () => {
  const h = harness('STUDENT');
  const originalFetch = h.context.fetch;
  h.context.fetch = async (url, options) => url.endsWith('/posts/42')
    ? { ok: true, status: 200, json: async () => ({ data: { id: 42, title: 'Research assistant', author: { name: 'Professor Lee' }, createdAt: '2026-09-01', status: 'OPEN', jobCategory: 'RA', requiredSkills: [], details: 'Help with research' } }) }
    : originalFetch(url, options);
  h.location.pathname = '/assistlink/opportunities/42/';
  await h.popstate();
  assert.equal(h.location.pathname, '/assistlink/opportunities/42/');
  assert.match(h.element('#dialog-content').innerHTML, /Research assistant/);
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

test('opportunity board and posting form expose all supported opportunity types', () => {
  const h = harness('PROFESSOR');
  vm.runInContext("state.view = 'opportunities'; renderBoard(); postForm({jobCategory:'LAB_ASSISTANT'});", h.context);
  const board = h.element('#main').innerHTML;
  const form = h.element('#dialog-content').innerHTML;
  for (const label of ['Research', 'Teaching', 'Internship', 'Projects', 'Laboratory', 'Peer tutoring']) assert.match(board, new RegExp(label));
  for (const value of ['RA', 'TA', 'INTERNSHIP', 'PROJECT_ASSISTANT', 'LAB_ASSISTANT', 'PEER_TUTOR']) assert.match(form, new RegExp(`value="${value}"`));
  assert.match(form, /value="LAB_ASSISTANT" selected/);
  assert.match(vm.runInContext("badge({jobCategory:'PEER_TUTOR'})", h.context), /PEER TUTOR/);
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

test('demo sign-in is a blank credential form and never lists seeded accounts', () => {
  const h = harness('STUDENT');
  vm.runInContext('state.demoAuthEnabled = true; signIn();', h.context);
  const html = h.element('#dialog-content').innerHTML;
  assert.match(html, /name="email"/);
  assert.match(html, /name="passcode"/);
  assert.match(html, /Continue with Microsoft/);
  assert.doesNotMatch(html, /Alice Johnson|Jane Smith|student1@university\.edu|prof@university\.edu|Database user ID/);
});

test('student profile shows uploaded résumé metadata and extracted text without editable URL fields', () => {
  const h = harness('STUDENT');
  vm.runInContext(`renderProfile({id:3,resume:{fileName:'Alice Resume.pdf',sizeBytes:2048,uploadedAt:'2026-09-15T00:00:00Z'},resumeText:'Python and TensorFlow research experience.'})`, h.context);
  const html = h.element('#main').innerHTML;
  assert.match(html, /Alice Resume\.pdf/);
  assert.match(html, /Extracted résumé text/);
  assert.match(html, /\/assistlink\/api\/me\/resume/);
  assert.doesNotMatch(html, /name="resumeUrl"|name="resumeText"/);
});

test('résumé upload snapshots the selected PDF before disabling the file input', async () => {
  const h = harness('STUDENT');
  const form = h.element('#resume-form');
  const submit = { disabled: false, textContent: 'Upload résumé', isConnected: true };
  const error = { textContent: '' };
  const file = { name: 'david.pdf', type: 'application/pdf', size: 82555 };
  const input = { name: 'resume', disabled: false };
  form.id = 'resume-form';
  Object.defineProperty(form, 'values', { get: () => input.disabled ? {} : { resume: file } });
  form.querySelector = selector => selector === '[type=submit]' ? submit : error;
  form.querySelectorAll = () => [input, submit];
  let uploadBody;
  const fetch = h.context.fetch;
  h.context.fetch = async (url, options) => {
    if (url.endsWith('/me/resume')) {
      uploadBody = options.body;
      return { ok: true, status: 201, json: async () => ({ data: { resume: { fileName: 'david.pdf' } } }) };
    }
    return fetch(url, options);
  };

  await h.documentEvents.submit({ target: form, preventDefault() {} });

  assert.equal(uploadBody.values.resume, file);
  assert.equal(error.textContent, '');
});

test('invalid demo credentials keep the sign-in dialog open and show the generic server error', async () => {
  const h = harness('STUDENT');
  const form = h.element('#demo-login-form');
  const submit = { disabled: false };
  const error = { textContent: '' };
  form.id = 'demo-login-form';
  form.values = { email: 'unknown@example.test', passcode: 'wrong' };
  form.querySelector = selector => selector === '[type=submit]' ? submit : error;
  h.context.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid email or passcode' } }) });
  await h.documentEvents.submit({ target: form, preventDefault() {} });
  assert.equal(error.textContent, 'Invalid email or passcode');
  assert.equal(h.element('#dialog').open, true);
});
