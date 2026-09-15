'use strict';
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FACULTY_PROGRAMS = {
  'Martin de Tours School of Management and Economics': ['Accountancy', 'Business Economics', 'Family Business Management & Innovation', 'Global Hospitality Management', 'Design & Digital Innovation', 'Sustainable Business Management', 'Business Administration'],
  'Theodore Maria School of Arts': ['Business English', 'Business French', 'Business Chinese', 'Business Japanese', 'English-Chinese for Digital Communication'],
  'Albert Laurence School of Communication Arts': ['Creative Commercial Communication', 'Creative Communication Design'],
  'Vincent Mary School of Engineering, Science and Technology': ['Aeronautic Engineering', 'Electrical & Computer Engineering', 'Mechatronics Engineering & Artificial Intelligence', 'New Energy Automotive Engineering', 'Computer Science', 'Applied Informatics'],
  'Montfort del Rosario School of Architecture and Design': ['Architecture', 'Interior Design', 'Art and Design'],
  'Theophane Venard School of Food Biotechnology & Innovation': ['Food Technology'],
  'Thomas Aquinas School of Law': ['Business Law'],
  'Louis Nobiron School of Music': ['Music Entrepreneurship'],
  'Bernadette de Lourdes School of Nursing Science': ['Nursing Science'],
};
const facultyNames = Object.keys(FACULTY_PROGRAMS);
const majorsFor = faculty => faculty && FACULTY_PROGRAMS[faculty] ? FACULTY_PROGRAMS[faculty] : [];
const state = { user: null, view: 'opportunities', posts: [], applications: [], category: 'ALL', search: '', development: false, demoAuthEnabled: false, revision: 0, users: [], userQuery: '', userRole: '', userPage: 1, userPagination: null };
let devUser;
try { devUser = JSON.parse(sessionStorage.getItem('assistlink_dev') || 'null'); } catch { sessionStorage.removeItem('assistlink_dev'); }
let noticeTimer;
let profileBaseline = '';
let profileDirty = false;
let profileSaving = false;
let profileExists = false;
let staffFilter = 'ALL';
let adminCounts = null;
let lastRoleChange = '';
const homeView = () => state.user?.role === 'ADMIN' ? 'users' : state.user?.role === 'PROFESSOR' ? 'manage' : 'opportunities';
function notify(message) { $('#notice').textContent = message; $('#notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('#notice').hidden = true, 6000); }
async function api(path, method = 'GET', body) {
  const isFormData = body instanceof FormData;
  const headers = { 'x-assistlink-request': 'web' };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (devUser && state.development) headers['x-dev-user'] = JSON.stringify(devUser);
  let response;
  try { response = await fetch(`/assistlink/api${path}`, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body) }); }
  catch { throw new Error('Cannot connect to AssistLink. Check your connection and try again.'); }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const sessionExpired = response.status === 401 && path !== '/auth/demo-login';
    const error = new Error(sessionExpired ? 'Please sign in to continue.' : result?.error?.message || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return result?.data;
}
const isStaff = () => state.user && ['PROFESSOR', 'ADMIN'].includes(state.user.role);
const owns = post => isStaff() && (state.user.role === 'ADMIN' || post.authorId === state.user.userId);
const date = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const tags = skills => `<div class="tags">${(skills || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>`;
const badge = post => `<span class="category ${post.jobCategory === 'TA' ? 'ta' : ''}">${post.jobCategory === 'TA' ? 'TEACHING ASSISTANT' : 'RESEARCH ASSISTANT'}</span>`;
function heading(title, subtitle, action = '') { return `<div class="page-heading"><div><p class="eyebrow">${state.user?.role === 'ADMIN' ? 'Campus administration' : state.user?.role === 'PROFESSOR' ? 'Your teaching & research team' : 'Grow with your campus'}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`; }
function empty(title, message, action = '') { return `<div class="empty"><div class="empty-symbol" aria-hidden="true">↗</div><h2>${title}</h2><p>${escapeHtml(message)}</p>${action}</div>`; }
function renderNav() {
  const items = state.user?.role === 'ADMIN' ? [['users','♙','User management'],['manage','▤','My postings'],['opportunities','▦','Campus postings']] : state.user?.role === 'PROFESSOR' ? [['manage','▤','Applications & postings'],['opportunities','▦','Campus postings']] : [['opportunities','▦','Opportunities']];
  if (state.user?.role === 'STUDENT') items.push(['applications','▤','My applications'],['profile','◉','My profile']);
  const roleTitle = state.user?.role === 'ADMIN' ? 'Administration' : state.user?.role === 'PROFESSOR' ? 'Professor workspace' : 'Student workspace';
  $('.workspace').textContent = state.user ? roleTitle : 'THE CAMPUS CONNECTION';
  $('.topbar > span').textContent = state.user ? roleTitle : 'YOUR NEXT CHAPTER';
  $('.sidebar-note').innerHTML = isStaff() ? '<span class="little-star">✳</span><h3>' + (state.user.role === 'ADMIN' ? 'Keep your campus connected.' : 'Your next assistant starts here.') + '</h3><p>' + (state.user.role === 'ADMIN' ? 'Manage accounts and help people access the right workspace.' : 'Review applications and build your research or teaching team.') + '</p>' : '<span class="little-star">✳</span><h3>Good work starts<br>with a connection.</h3><p>Find your place in research<br>and the classroom.</p>';
  $('#navigation').innerHTML = items.map(([view, icon, title]) => `<button data-view="${view}" class="${state.view === view ? 'active' : ''}" ${state.view === view ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span>${title}</button>`).join('');
  $('#account').innerHTML = state.user ? `<div><strong>${escapeHtml(state.user.role[0] + state.user.role.slice(1).toLowerCase())}${state.user.devImpersonation ? ' · Local dev' : ''}</strong><span>${escapeHtml(state.user.name || (state.user.devImpersonation ? 'Impersonated role · not a saved assignment' : 'Campus workspace'))}</span></div><button data-action="logout">Sign out ↗</button>` : '<div><strong>Your campus. Your next step.</strong><button data-action="signin">Sign in to AssistLink ↗</button></div>';
}
function allowedView(view) {
  if (view === 'users') return state.user?.role === 'ADMIN';
  if (view === 'manage') return isStaff();
  if (view === 'profile' || view === 'applications') return state.user?.role === 'STUDENT';
  return view === 'opportunities';
}
async function refreshAccount() {
  const previous = state.user?.role;
  try { state.user = await api('/auth/me'); }
  catch (error) { if (error.status === 401) state.user = null; else throw error; }
  return previous !== state.user?.role;
}
async function recoverAccess(error) {
  if (![401, 403].includes(error.status)) return false;
  const changed = await refreshAccount();
  if (changed || !allowedView(state.view) || !state.user) {
    $('#dialog').close();
    await navigate(homeView(), true);
    notify(state.user ? 'Your access has changed. Your workspace is up to date.' : 'Please sign in to continue.');
    return true;
  }
  return false;
}
async function navigate(view, skipSession = false) {
  if (profileSaving && !skipSession) { notify('Your profile is saving. Please wait a moment.'); return; }
  if (profileDirty && state.view === 'profile' && !skipSession && !window.confirm('Leave your profile without saving your changes?')) return;
  const revision = ++state.revision;
  $('#main').innerHTML = '<div class="empty" role="status">Loading your workspace…</div>';
  try {
    if (!skipSession) {
      const changed = await refreshAccount();
      if (changed) { $('#dialog').close(); view = homeView(); }
    }
    if (revision !== state.revision) return;
    view = allowedView(view) ? view : homeView();
    profileDirty = false;
    state.view = view;
    renderNav();
    document.title = `AssistLink · ${{opportunities:'Opportunities',applications:'My applications',profile:'My profile',manage:'My postings',users:'Users'}[view]}`;
    if (!state.user) {
      state.users = []; state.posts = []; state.applications = [];
      $('#main').innerHTML = heading('Find your next opportunity.', 'Put your skills to work. Build experience that matters.') + '<section class="banner"><div><p class="eyebrow">Research & teaching</p><h2>A little curiosity goes a long way.</h2><p>Connect with professors, contribute to meaningful projects, and take your learning beyond the classroom.</p></div><span class="banner-icon" aria-hidden="true">↗</span></section>' + empty('Your next chapter starts here', 'Sign in with your university account to explore research and teaching roles, manage your profile, and follow your applications.', '<button class="button primary" data-action="signin">Sign in with Microsoft <span aria-hidden="true">↗</span></button>');
      return;
    }
    if (view === 'users') {
      const query = new URLSearchParams({ q: state.userQuery, page: String(state.userPage) });
      if (state.userRole) query.set('role', state.userRole);
      const [result, ...counts] = await Promise.all([api(`/users?${query}`), ...['STUDENT','PROFESSOR','ADMIN'].map(role => api(`/users?role=${role}&page=1`))]);
      if (revision === state.revision) { adminCounts = counts.map(result => result.pagination.total); state.users = result.users; state.userPagination = result.pagination; state.userPage = result.pagination.page; renderUsers(); }
    }
    else if (view === 'profile') { const profile = await api('/me/profile'); if (revision === state.revision) renderProfile(profile || {}); }
    else if (view === 'applications') { const applications = await api('/me/applications'); if (revision === state.revision) { state.applications = applications; renderApplications(); } }
    else { const posts = await api(view === 'manage' ? '/posts/workspace' : '/posts'); if (revision === state.revision) { state.posts = posts; if (view === 'manage') renderStaff(); else renderBoard(); } }
  } catch (error) {
    if (revision !== state.revision) return;
    if (await recoverAccess(error).catch(() => false)) return;
    renderNav();
    $('#main').innerHTML = empty('Unable to load this page', error.message, '<button class="button" data-action="retry">Try again</button>');
  }
}
window.addEventListener('focus', async () => {
  const revision = state.revision;
  try {
    const changed = await refreshAccount();
    if (revision !== state.revision) return;
    if (changed) {
      $('#dialog').close();
      await navigate(homeView(), true);
      notify(state.user ? 'Your role has changed. Your workspace is up to date.' : 'Please sign in to continue.');
    } else renderNav();
  } catch (error) { notify(error.message); }
});
const roleLabel = role => ({ STUDENT: 'Student', PROFESSOR: 'Professor', ADMIN: 'Admin' }[role]);
function metric(label, value, detail) { return `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`; }
function renderStaff() {
  const totals = state.posts.reduce((sum, post) => ({ pending: sum.pending + post.applicationCounts.pending, total: sum.total + post.applicationCounts.total, accepted: sum.accepted + post.applicationCounts.accepted }), { pending: 0, total: 0, accepted: 0 });
  $('#main').innerHTML = heading('Your applications, at a glance.', 'Review candidates, make decisions, and manage your opportunities.', '<button class="button primary" data-action="create">＋ Create posting</button>') +
    `<section class="metrics" aria-label="Your posting summary">${metric('Awaiting your review', totals.pending, 'Applications needing a decision')}${metric('Applications received', totals.total, 'Across all your postings')}${metric('Open postings', state.posts.filter(p => p.status === 'OPEN').length, 'Currently accepting applications')}${metric('Accepted', totals.accepted, 'Candidates you have selected')}</section>
    <div class="section-heading"><div><h2>Applications & postings</h2><p class="muted">${totals.pending ? 'Postings with pending applications appear first.' : 'You’re up to date. New applications will appear here.'}</p></div><button class="button" data-action="refresh-staff">Refresh</button></div>
    <div class="toolbar"><input class="search" id="staff-search" type="search" aria-label="Search your postings" placeholder="Search your postings…" value="${escapeHtml(state.search)}"><div class="filters" aria-label="Posting status">${[['ALL','All postings'],['PENDING','Needs review'],['OPEN','Open'],['CLOSED','Closed']].map(([value,label]) => `<button data-staff-filter="${value}" aria-pressed="${staffFilter === value}">${label}</button>`).join('')}</div></div>
    <div id="staff-results" role="status" class="results-label"></div><div id="staff-posts" class="posting-list"></div>`;
  renderStaffPosts();
}
function renderStaffPosts() {
  const posts = state.posts.filter(p => (staffFilter === 'ALL' || (staffFilter === 'PENDING' ? p.applicationCounts.pending > 0 : p.status === staffFilter)) && p.title.toLowerCase().includes(state.search.toLowerCase()));
  $('#staff-results').textContent = `${posts.length} posting${posts.length === 1 ? '' : 's'} · Pending applications first`;
  $('#staff-posts').innerHTML = posts.length ? posts.map(p => `<article class="posting-row ${p.applicationCounts.pending ? 'needs-review' : ''}"><div class="posting-content"><div class="card-head">${badge(p)}<span class="status">${p.status === 'OPEN' ? 'Open' : 'Closed'}${p.private ? ' · Private' : ''}</span></div><h3>${escapeHtml(p.title)}</h3><p class="muted">Posted ${date(p.createdAt)} · ${p.applicationCounts.total} applications · ${p.applicationCounts.accepted} accepted</p></div><div class="posting-actions"><span class="review-count">${p.applicationCounts.pending ? `${p.applicationCounts.pending} awaiting review` : 'No pending applications'}</span><div class="actions"><button class="button ${p.applicationCounts.pending ? 'primary' : ''}" data-applicants="${p.id}">${p.applicationCounts.pending ? 'Review applications' : 'View applicants'}</button><button class="button" data-edit="${p.id}">Edit<span class="sr-only"> ${escapeHtml(p.title)}</span></button><button class="link-button" data-post="${p.id}">Details ↗</button></div></div></article>`).join('') : empty(state.posts.length ? 'No matching postings' : 'Create your first opportunity', state.posts.length ? 'Try a different search or posting filter.' : 'Publish a research or teaching role. Your applicants and decisions will be organized here.', state.posts.length ? '<button class="button" data-action="clear-staff">Clear filters</button>' : '<button class="button primary" data-action="create">＋ Create posting</button>');
}
async function refreshStaff() {
  if (state.view !== 'manage') return;
  const revision = state.revision;
  const posts = await api('/posts/workspace');
  if (revision === state.revision) { state.posts = posts; renderStaff(); }
}
function renderUsers() {
  const p = state.userPagination;
  $('#main').innerHTML = heading('Campus administration', 'Manage accounts and give each person the access they need.') +
    `<section class="metrics" aria-label="Campus account summary">${metric('Total accounts', adminCounts.reduce((a,b) => a+b,0), 'Registered campus users')}${['STUDENT','PROFESSOR','ADMIN'].map((role,index) => `<button class="metric metric-button" data-user-role="${role}" aria-pressed="${state.userRole === role}"><span>${roleLabel(role)}s</span><strong>${adminCounts[index]}</strong><small>View ${roleLabel(role).toLowerCase()} accounts ↗</small></button>`).join('')}</section>
    ${lastRoleChange ? `<p class="feedback saved" role="status">${escapeHtml(lastRoleChange)}</p>` : ''}
    <div class="section-heading"><div><h2>User directory</h2><p class="muted">Search an account, choose a role, then confirm the change.</p></div><button class="button" data-action="clear-users">Show all users</button></div>` +
    `<p class="admin-help">New Microsoft accounts start as students. Assign Professor after the person has signed in once.${state.user.devImpersonation ? ' You are using development impersonation; the roles below are saved database assignments.' : ''}</p>
    <form id="users-search-form" class="toolbar users-toolbar">
      <div class="user-search-field"><label for="users-query">Find a user</label><input id="users-query" name="q" type="search" maxlength="200" placeholder="Search name or email…" value="${escapeHtml(state.userQuery)}"></div>
      <div><label for="users-role-filter">Current role</label><select id="users-role-filter" name="role"><option value="">All roles</option>${['STUDENT','PROFESSOR','ADMIN'].map(role => `<option value="${role}" ${role === state.userRole ? 'selected' : ''}>${roleLabel(role)}</option>`).join('')}</select></div>
      <button class="button primary" type="submit">Search</button><p class="form-error" role="alert"></p>
    </form>
    <div class="results-label"><span aria-live="polite">${p.total} matching ${p.total === 1 ? 'user' : 'users'}${state.userRole ? ' · ' + roleLabel(state.userRole) : ''}</span><span>Newest accounts first</span></div>
    ${state.users.length ? `<div class="user-table-wrap" role="region" aria-label="User role assignments" tabindex="0"><table class="user-table"><caption class="sr-only">Users and their saved roles</caption><thead><tr><th scope="col">User</th><th scope="col">Current role</th><th scope="col">Registered</th><th scope="col">Assign role</th></tr></thead><tbody>${state.users.map(user => `<tr><td><strong>${escapeHtml(user.name)}${user.id === state.user.userId ? ' (you)' : ''}</strong><span class="user-email">${escapeHtml(user.email)}</span></td><td><span class="role-badge role-${user.role.toLowerCase()}">${roleLabel(user.role)}</span></td><td>${date(user.createdAt)}</td><td>${user.id === state.user.userId ? '<span class="muted">Another admin must change your role.</span>' : `<div class="role-actions"><select id="role-${user.id}" aria-label="Assign role to ${escapeHtml(user.name)}" data-role-select="${user.id}">${['STUDENT','PROFESSOR','ADMIN'].map(role => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${roleLabel(role)}</option>`).join('')}</select><button class="button" data-save-role="${user.id}" disabled>Save<span class="sr-only"> role for ${escapeHtml(user.name)}</span></button></div>`}</td></tr>`).join('')}</tbody></table></div>` : empty('No users found', 'Try another name, email, or role filter.')}
    <div class="pagination"><span>Page ${p.page} of ${p.totalPages}</span><div class="actions"><button class="button" data-user-page="${p.page - 1}" ${p.page <= 1 ? 'disabled' : ''}>Previous</button><button class="button" data-user-page="${p.page + 1}" ${p.page >= p.totalPages ? 'disabled' : ''}>Next</button></div></div>`;
}
function confirmRole(id) {
  const user = state.users.find(user => user.id === id);
  const role = $(`#role-${id}`).value;
  if (!user || role === user.role) return;
  openDialog('Confirm role change', `<p>Change <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) from <strong>${roleLabel(user.role)}</strong> to <strong>${roleLabel(role)}</strong>?</p><p class="muted">The new permissions apply on their next request. Their existing work stays saved.</p><form id="role-form" data-id="${id}" data-role="${role}"><p class="form-error" role="alert"></p><div class="actions"><button class="button" type="button" data-action="close">Cancel</button><button class="button primary" type="submit">Confirm change</button></div></form>`);
}
function renderBoard() {
  const manage = state.view === 'manage';
  $('#main').innerHTML = heading(manage ? 'Make room for fresh talent.' : 'Find your next opportunity.', manage ? 'Create opportunities and connect with your next assistant.' : 'Explore research and teaching roles across your campus.', isStaff() ? '<button class="button primary" data-action="create">＋ Create posting</button>' : '') + (manage ? '' : '<section class="banner"><div><p class="eyebrow">Learn. Contribute. Connect.</p><h2>Your skills can make a difference.</h2><p>Discover a research project or teaching role that moves you forward.</p></div><span class="banner-icon" aria-hidden="true">↗</span></section>') + `<div class="toolbar"><input class="search" id="search" type="search" aria-label="Search opportunities" placeholder="Search by title, skill, or professor…" value="${escapeHtml(state.search)}"><div class="filters" aria-label="Opportunity type">${[['ALL','All opportunities'],['RA','Research'],['TA','Teaching']].map(([value,label]) => `<button data-category="${value}" aria-pressed="${state.category === value}">${label}</button>`).join('')}</div></div><div class="results-label"><span id="result-count" aria-live="polite"></span><span>Newest first</span></div><div id="post-grid" class="grid"></div>`;
  renderCards();
}
function renderCards() {
  const query = state.search.toLowerCase();
  const posts = state.posts.filter(p => (state.category === 'ALL' || p.jobCategory === state.category) && [p.title,p.details,p.author?.name,...p.requiredSkills].join(' ').toLowerCase().includes(query));
  $('#result-count').textContent = `${posts.length} ${state.view === 'manage' ? 'postings' : 'opportunities'}`;
  $('#post-grid').innerHTML = posts.length ? posts.map(p => `<article class="card"><div class="card-head">${badge(p)}<span class="status">${p.status === 'CLOSED' ? 'Closed' : 'Open'}${p.private ? ' · Private' : ''}</span></div><h2>${escapeHtml(p.title)}</h2><div class="author">${escapeHtml(p.author?.name || 'Professor')}</div><p class="description">${escapeHtml(p.details)}</p>${tags(p.requiredSkills)}<div class="card-bottom"><span>Posted ${date(p.createdAt)}</span><button class="link-button" data-post="${p.id}">${state.view === 'manage' ? 'Manage posting' : 'View opportunity'} ↗</button></div></article>`).join('') : empty('No opportunities found', state.search || state.category !== 'ALL' ? 'Try another search or choose a different category.' : 'New postings will appear here when professors publish them.');
}
function openDialog(title, content) { $('#dialog-content').innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="close" aria-label="Close dialog" data-action="close">×</button></div>${content}`; if (!$('#dialog').open) $('#dialog').showModal(); }
function signIn() {
  const demoForm = state.demoAuthEnabled ? '<form id="demo-login-form" class="demo-login-form"><div class="field"><label for="demo-email">Email</label><input id="demo-email" name="email" type="email" autocomplete="username" required maxlength="320"></div><div class="field"><label for="demo-passcode">Passcode</label><input id="demo-passcode" name="passcode" type="password" autocomplete="current-password" required maxlength="256"></div><p class="form-error" role="alert"></p><button class="button primary" type="submit">Sign in</button></form><div class="signin-divider"><span>or</span></div>' : '';
  openDialog('Welcome to AssistLink', demoForm + '<p class="muted">Use your university Microsoft account to access your campus workspace.</p><a class="button" href="/assistlink/api/auth/login?web=1">Continue with Microsoft ↗</a>');
}
async function showPost(id) {
  openDialog('Opportunity', '<p role="status">Loading opportunity…</p><p class="form-error" id="dialog-error" role="alert"></p>');
  const post = await api(`/posts/${id}`);
  if (!$('#dialog').open) return;
  openDialog(escapeHtml(post.title), `${badge(post)}<p class="author">${escapeHtml(post.author?.name)} · Posted ${date(post.createdAt)} · ${escapeHtml(post.status)}</p><p class="preserve">${escapeHtml(post.details)}</p><h3>Skills</h3>${tags(post.requiredSkills)}<div class="actions">${state.user?.role === 'STUDENT' && post.status === 'OPEN' ? `<button class="button primary" data-apply="${post.id}">Apply for this opportunity</button>` : ''}${owns(post) ? `<button class="button primary" data-applicants="${post.id}">Review applicants</button><button class="button" data-edit="${post.id}">Edit posting</button>${post.status === 'OPEN' ? `<button class="button danger" data-close-post="${post.id}">Close posting</button>` : ''}` : ''}</div><p class="form-error" id="dialog-error" role="alert"></p>`);
}
function field(label, name, value = '', type = 'text', attrs = '') { return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${attrs}></div>`; }
function area(label, name, value = '', attrs = '') { return `<div class="field"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" ${attrs}>${escapeHtml(value)}</textarea></div>`; }
function selectField(label, name, options, value = '', placeholder = 'Choose an option', disabled = false) { return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}" ${disabled ? 'disabled' : ''}><option value="">${placeholder}</option>${options.map(option => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></div>`; }
function renderProfile(p, justSaved = false) {
  profileExists = p.id != null;
  profileDirty = false;
  profileSaving = false;
  const faculty = p.faculty || '';
  const majors = majorsFor(faculty);
  const resumePanel = p.resume
    ? `<section class="panel resume-panel"><div class="section-heading"><div><h2>Résumé PDF</h2><p class="muted">Used as supporting evidence when professors rank applicants.</p></div><span class="role-badge">Uploaded</span></div><div class="resume-file"><div><strong>${escapeHtml(p.resume.fileName)}</strong><span>${formatBytes(p.resume.sizeBytes)} · Uploaded ${date(p.resume.uploadedAt)}</span></div><div class="actions"><a class="button" href="/assistlink/api/me/resume" target="_blank" rel="noopener">View PDF ↗</a><button class="button danger" data-action="delete-resume">Delete</button></div></div>${p.resumeText ? `<details><summary>Extracted résumé text</summary><p class="preserve resume-preview">${escapeHtml(p.resumeText)}</p></details>` : ''}<form id="resume-form" enctype="multipart/form-data"><div class="field"><label for="resume">Replace résumé</label><input id="resume" name="resume" type="file" accept="application/pdf,.pdf" required><small>Text-based PDF, maximum 5 MB and 10 pages.</small></div><p class="form-error" role="alert"></p><button class="button primary" type="submit">Upload replacement</button></form></section>`
    : `<section class="panel resume-panel"><div class="section-heading"><div><h2>Résumé PDF</h2><p class="muted">Upload a résumé so professors can review your experience and use it during ranking.</p></div></div><form id="resume-form" enctype="multipart/form-data"><div class="field"><label for="resume">Choose résumé PDF</label><input id="resume" name="resume" type="file" accept="application/pdf,.pdf" required ${profileExists ? '' : 'disabled'}><small>${profileExists ? 'Text-based PDF, maximum 5 MB and 10 pages.' : 'Save your student profile before uploading a résumé.'}</small></div><p class="form-error" role="alert"></p><button class="button primary" type="submit" ${profileExists ? '' : 'disabled'}>Upload résumé</button></form></section>`;
  $('#main').innerHTML = heading('Let your skills speak.', 'Build your student profile before applying to an opportunity.') + `<div class="profile-stack"><form id="profile-form" class="panel"><div class="section-heading"><h2>Student profile</h2><span class="role-badge">Student</span></div><p id="profile-status" class="feedback ${profileExists ? 'saved' : 'unsaved'}" role="status">${profileExists ? (justSaved ? '✓ Profile saved successfully. Your changes are stored.' : '✓ Saved profile · You are viewing your stored information.') : 'Profile not saved yet. Add your details and select Save profile.'}</p><div class="form-grid">${selectField('Faculty','faculty',facultyNames,faculty,'Choose your faculty')}${selectField('Major','major',majors,p.major || '','Choose your major',!faculty)}</div>${area('About you','bio',p.bio,'maxlength="2000"')}${field('Skills, separated by commas','skills',(p.skills || []).join(', '))}<div class="form-grid">${field('GPA (0–4)','gpa',p.gpa,'number','min="0" max="4" step="0.01"')}${field('Available hours per week','workHoursPerWeek',p.workHoursPerWeek,'number','min="0" max="80" step="1"')}</div><p class="form-error" role="alert"></p><div class="save-bar"><span id="save-hint">${profileExists ? 'All changes saved' : 'Your profile has not been saved'}</span><button id="save-profile" class="button primary" type="submit" ${profileExists ? 'disabled' : ''}>${profileExists ? 'Saved' : 'Save profile'}</button></div></form>${resumePanel}</div>`;
  profileBaseline = profileFingerprint();
}
function formatBytes(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function profileFingerprint() {
  const form = $('#profile-form');
  return form ? JSON.stringify(Object.fromEntries(new FormData(form))) : '';
}
function updateProfileStatus() {
  if (!$('#profile-form') || profileSaving) return;
  profileDirty = profileFingerprint() !== profileBaseline;
  const status = $('#profile-status');
  status.className = 'feedback ' + (profileDirty || !profileExists ? 'unsaved' : 'saved');
  status.textContent = profileDirty ? 'Unsaved changes · Save your profile to keep these updates.' : profileExists ? '✓ All changes saved.' : 'Profile not saved yet.';
  $('#save-hint').textContent = profileDirty ? 'Changes haven’t been saved' : profileExists ? 'All changes saved' : 'Save to create your profile';
  $('#save-profile').disabled = !profileDirty && profileExists;
  $('#save-profile').textContent = profileDirty ? 'Save changes' : profileExists ? 'Saved' : 'Save profile';
}
window.addEventListener('beforeunload', event => {
  if (profileDirty || profileSaving) { event.preventDefault(); event.returnValue = ''; }
});
function postForm(post = {}) {
  openDialog(post.id ? 'Edit opportunity' : 'Create an opportunity', `<form id="post-form" data-id="${post.id || ''}">${field('Opportunity title','title',post.title,'text','required minlength="3" maxlength="200"')}<div class="field"><label for="jobCategory">Opportunity type</label><select id="jobCategory" name="jobCategory"><option value="RA">Research assistant</option><option value="TA" ${post.jobCategory === 'TA' ? 'selected' : ''}>Teaching assistant</option></select></div>${area('Description','details',post.details,'required')}${field('Required skills, separated by commas','requiredSkills',(post.requiredSkills || []).join(', '))}<div class="field"><label class="checkbox"><input type="checkbox" name="private" ${post.private ? 'checked' : ''}>Private posting</label><small>Private postings are hidden from the opportunity board.</small></div><p class="form-error" role="alert"></p><button class="button primary" type="submit">${post.id ? 'Save changes' : 'Publish opportunity'}</button></form>`);
}
function renderApplications() {
  $('#main').innerHTML = heading('Keep your next step in sight.', 'Follow the progress of your research and teaching applications.') + `<div class="grid">${state.applications.length ? state.applications.map(a => `<article class="card"><div class="card-head">${badge(a.post)}<span class="status">${escapeHtml(a.status)}</span></div><h2>${escapeHtml(a.post.title)}</h2><p class="author">${escapeHtml(a.post.author.name)}</p>${tags(a.post.requiredSkills)}<div class="card-bottom"><span>Applied ${date(a.createdAt)}</span><button class="link-button" data-post="${a.postId}">View posting ↗</button></div></article>`).join('') : empty('Your next step is waiting', 'Explore the opportunity board and apply to a role that interests you.', '<button class="button primary" data-view="opportunities">Explore opportunities</button>')}</div>`;
}
async function applicants(id, feedback = '') {
  openDialog('Review applicants', '<p role="status">Loading applicants…</p><p class="form-error" id="dialog-error" role="alert"></p>');
  const list = await api(`/posts/${id}/applications`);
  if (!$('#dialog').open) return;
  const rankedAt = list.some(a => a.aiScore != null);
  const rankingAction = (feedback ? `<p class="feedback saved" role="status">✓ ${escapeHtml(feedback)}</p>` : '') + (list.length ? `<div class="rank-action"><button class="button primary" data-rank="${id}">${rankedAt ? 'Re-rank applicants' : 'Rank applicants with Gemini'}</button><span class="muted">AI scores are a review aid; decisions remain yours.</span></div>` : '');
  openDialog('Review applicants', rankingAction + (list.length ? list.map(a => `<article class="applicant"><div class="applicant-heading"><div><h3>${escapeHtml(a.student.user.name)}</h3><p class="author">${escapeHtml(a.student.user.email)} · ${escapeHtml(a.status)}</p><p class="author">${escapeHtml(a.student.user.department?.name || 'Faculty not provided')} · ${escapeHtml(a.student.major || 'Major not provided')}</p></div><div class="score">${a.aiScore != null ? `<strong>${escapeHtml(a.aiScore)}/100</strong><span>AI match score</span>` : '<span>Not ranked</span>'}</div></div><p class="preserve">${escapeHtml(a.student.bio)}</p>${tags(a.student.skills)}<p>GPA: ${a.student.gpa ?? 'Not provided'} · Hours/week: ${a.student.workHoursPerWeek ?? 'Not provided'}</p>${a.student.resumeFileName ? `<p><a href="/assistlink/api/posts/${id}/applications/${a.id}/resume" target="_blank" rel="noopener">View résumé PDF ↗</a> <span class="muted">${escapeHtml(a.student.resumeFileName)} · ${formatBytes(a.student.resumeSizeBytes)}</span></p>` : safeResume(a.student.resumeUrl)}${a.student.resumeText ? `<details><summary>Extracted résumé text</summary><p class="preserve resume-preview">${escapeHtml(a.student.resumeText)}</p></details>` : ''}${a.aiRationale ? `<p class="ai-rationale"><strong>Why this score:</strong> ${escapeHtml(a.aiRationale)}</p>` : ''}<div class="actions">${['ACCEPTED','REJECTED'].map(status => `<button class="button ${status === 'ACCEPTED' ? 'primary' : ''}" data-decision="${a.id}" data-status="${status}" data-parent="${id}" ${a.status === status ? 'disabled' : ''}>${status === 'ACCEPTED' ? 'Accept' : 'Reject'}</button>`).join('')}</div></article>`).join('') : '<p class="muted">No applications yet. Applicants will appear here after they apply.</p>') + '<p class="form-error" id="dialog-error" role="alert"></p>');
}
function safeResume(url) { try { const parsed = new URL(url); return ['https:','http:'].includes(parsed.protocol) ? `<p><a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">View résumé ↗</a></p>` : ''; } catch { return ''; } }
const splitSkills = value => [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))];
document.addEventListener('input', event => {
  if (event.target.id === 'search') { state.search = event.target.value; renderCards(); }
  if (event.target.id === 'staff-search') { state.search = event.target.value; renderStaffPosts(); }
  if (event.target.closest('#profile-form')) updateProfileStatus();
});
document.addEventListener('change', event => {
  if (event.target.dataset.roleSelect) { const id = Number(event.target.dataset.roleSelect); const user = state.users.find(user => user.id === id); $(`[data-save-role="${id}"]`).disabled = event.target.value === user.role; }
  if (event.target.id === 'faculty') { const major = $('#major'); if (major) { major.innerHTML = `<option value="">Choose your major</option>${majorsFor(event.target.value).map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}`; major.disabled = !event.target.value; } }
  if (event.target.closest('#profile-form')) updateProfileStatus();
});
document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  try {
    if (button.dataset.view) { state.search = ''; state.category = 'ALL'; await navigate(button.dataset.view); }
    else if (button.dataset.staffFilter) { staffFilter = button.dataset.staffFilter; renderStaff(); }
    else if (button.dataset.userRole) { state.userRole = button.dataset.userRole; state.userPage = 1; await navigate('users'); }
    else if (button.dataset.action === 'clear-users') { state.userRole = ''; state.userQuery = ''; state.userPage = 1; await navigate('users'); }
    else if (button.dataset.action === 'clear-staff') { state.search = ''; staffFilter = 'ALL'; renderStaff(); }
    else if (button.dataset.action === 'refresh-staff') { button.disabled = true; await refreshStaff(); notify('Application counts are up to date.'); }
    else if (button.dataset.userPage) { state.userPage = Number(button.dataset.userPage); await navigate('users'); }
    else if (button.dataset.saveRole) confirmRole(Number(button.dataset.saveRole));
    else if (button.dataset.category) { state.category = button.dataset.category; document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed', b.dataset.category === state.category)); renderCards(); }
    else if (button.dataset.post) await showPost(Number(button.dataset.post));
    else if (button.dataset.edit) postForm(await api(`/posts/${button.dataset.edit}`));
    else if (button.dataset.applicants) await applicants(Number(button.dataset.applicants));
    else if (button.dataset.rank) { button.disabled = true; button.textContent = 'Ranking applicants…'; await api(`/posts/${button.dataset.rank}/rank`, 'POST', {}); await applicants(Number(button.dataset.rank), 'Gemini ranking finished. Scores are up to date.'); }
    else if (button.dataset.apply) { button.disabled = true; await api(`/posts/${button.dataset.apply}/applications`, 'POST', {}); $('#dialog').close(); notify('Application submitted. Follow its progress in My applications.'); }
    else if (button.dataset.closePost) { const id = button.dataset.closePost; openDialog('Close this posting?', `<p>Students will no longer be able to apply. You can still review existing applicants in My postings.</p><button class="button danger" data-confirm-close="${id}">Close posting</button>`); }
    else if (button.dataset.confirmClose) { button.disabled = true; await api(`/posts/${button.dataset.confirmClose}/close`, 'PATCH', {}); $('#dialog').close(); notify('Posting closed.'); await navigate(state.view); }
    else if (button.dataset.decision) { button.disabled = true; await api(`/applications/${button.dataset.decision}`, 'PATCH', { status: button.dataset.status }); await applicants(Number(button.dataset.parent), 'Decision saved: ' + (button.dataset.status === 'ACCEPTED' ? 'applicant accepted.' : 'applicant rejected.')); await refreshStaff(); }
    else if (button.dataset.action === 'signin') signIn();
    else if (button.dataset.action === 'delete-resume') { if (!window.confirm('Delete your uploaded résumé and extracted text?')) return; button.disabled = true; await api('/me/resume', 'DELETE'); await navigate('profile'); notify('Résumé deleted.'); }
    else if (button.dataset.action === 'close') $('#dialog').close();
    else if (button.dataset.action === 'create') postForm();
    else if (button.dataset.action === 'retry') await navigate(state.view);
    else if (button.dataset.action === 'logout') { if (profileSaving) { notify('Please wait for your profile to finish saving.'); return; } if (profileDirty && !window.confirm('Sign out without saving your profile changes?')) return; await api('/auth/logout','POST'); profileDirty = false; lastRoleChange = ''; adminCounts = null; devUser = null; sessionStorage.removeItem('assistlink_dev'); state.user = null; state.posts = []; state.applications = []; await navigate(homeView()); }
  } catch (error) { if (await recoverAccess(error).catch(() => false)) return; if (button.dataset.rank) button.textContent = 'Retry ranking'; const output = $('#dialog-error'); if (output) output.textContent = error.message; else notify(error.message); }
  finally { if (button.isConnected && !button.dataset.saveRole) button.disabled = false; }
});
document.addEventListener('submit', async event => {
  const form = event.target; event.preventDefault();
  const submit = form.querySelector('[type=submit]'); if (!submit || submit.disabled) return;
  submit.disabled = true; form.querySelector('.form-error').textContent = '';
  const values = Object.fromEntries(new FormData(form));
  try {
    if (form.id === 'users-search-form') { state.userQuery = values.q.trim(); state.userRole = values.role; state.userPage = 1; await navigate('users'); }
    if (form.id === 'role-form') {
      const updated = await api(`/users/${form.dataset.id}/role`, 'PATCH', { role: form.dataset.role });
      lastRoleChange = `✓ Role saved · ${updated.name} is now a ${roleLabel(updated.role)}.`;
      $('#dialog').close();
      await navigate('users');
      notify(`${updated.name} is now a ${roleLabel(updated.role)}.`);
    }
    if (form.id === 'profile-form') {
      profileSaving = true;
      const revision = state.revision;
      $('#profile-status').className = 'feedback saving';
      $('#profile-status').textContent = 'Saving your profile…';
      submit.textContent = 'Saving…';
      form.querySelectorAll('input, select, textarea').forEach(input => input.disabled = true);
      try {
        const saved = await api('/me/profile','PUT', { ...values, faculty: values.faculty || null, major: values.major || null, skills: splitSkills(values.skills), gpa: values.gpa === '' ? null : Number(values.gpa), workHoursPerWeek: values.workHoursPerWeek === '' ? null : Number(values.workHoursPerWeek) });
        if (revision === state.revision) { renderProfile(saved, true); notify('Profile saved successfully.'); }
      } catch (error) {
        if (revision === state.revision) {
          $('#profile-status').className = 'feedback failed';
          $('#profile-status').textContent = 'Save failed. Your changes are still here. Please try again.';
          $('#save-hint').textContent = 'Changes not saved';
          submit.textContent = 'Retry save';
          profileDirty = true;
          form.querySelectorAll('input, select, textarea').forEach(input => input.disabled = false);
          $('#major').disabled = !$('#faculty').value;
        }
        throw error;
      } finally { profileSaving = false; }
    }
    if (form.id === 'resume-form') {
      submit.textContent = 'Uploading and reading PDF…';
      form.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
      try {
        await api('/me/resume', 'POST', new FormData(form));
        await navigate('profile');
        notify('Résumé uploaded and text extracted successfully.');
      } catch (error) {
        form.querySelectorAll('input, button').forEach(control => { control.disabled = false; });
        submit.textContent = 'Retry upload';
        throw error;
      }
    }
    if (form.id === 'post-form') { const id = form.dataset.id; await api(`/posts${id ? '/' + id : ''}`, id ? 'PATCH' : 'POST', { ...values, private: values.private === 'on', requiredSkills: splitSkills(values.requiredSkills) }); $('#dialog').close(); notify(id ? 'Posting updated.' : 'Opportunity published.'); await navigate('manage'); }
    if (form.id === 'demo-login-form') { const result = await api('/auth/demo-login', 'POST', { email: values.email, passcode: values.passcode }); state.user = result.user; $('#dialog').close(); await navigate(homeView()); }
  } catch (error) { if (form.id !== 'demo-login-form' && await recoverAccess(error).catch(() => false)) return; form.querySelector('.form-error').textContent = error.message; }
  finally { submit.disabled = false; }
});
(async function start() {
  try { const options = await api('/auth/options'); state.development = options.development; state.demoAuthEnabled = options.demoAuthEnabled; } catch { state.user = null; }
  await navigate('home');
})();
