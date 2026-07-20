// src/pages/auth.js
const { db } = require('../db');
const { layout, esc } = require('../render');
const { createUser, findUserByEmail, verifyPassword, createSession, destroySessionToken, parseCookies } = require('../auth');

function loginPage(ctx) {
  if (ctx.user) return ctx.redirect('/dashboard');
  const error = ctx.query.error ? '<p class="text-red-600 text-sm mb-3">' + esc(ctx.query.error) + '</p>' : '';
  const body = `
  <div class="max-w-sm mx-auto mt-16 bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
    <h1 class="text-xl font-bold mb-1">Welcome back</h1>
    <p class="text-sm text-slate-500 mb-6">Log in to your agency dashboard.</p>
    ${error}
    <form method="POST" action="/login" class="space-y-4">
      <div>
        <label class="text-sm font-medium">Email</label>
        <input name="email" type="email" required class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value="demo@leadflowhq.test" />
      </div>
      <div>
        <label class="text-sm font-medium">Password</label>
        <input name="password" type="password" required class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value="demo1234" />
      </div>
      <button class="w-full bg-indigo-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-indigo-700">Log in</button>
    </form>
    <p class="text-xs text-slate-400 mt-4">Demo login is pre-filled. New agency? <a href="/signup" class="text-indigo-600">Create one</a>.</p>
  </div>`;
  ctx.html(layout({ title: 'Log in', user: null, body }));
}

function handleLogin(ctx) {
  const { email, password } = ctx.body;
  const user = email && findUserByEmail(email);
  if (!user || !verifyPassword(password || '', user.password_salt, user.password_hash)) {
    return ctx.redirect('/login?error=' + encodeURIComponent('Invalid email or password.'));
  }
  const cookie = createSession(user.id);
  ctx.setCookie('session', cookie, { maxAge: 60 * 60 * 24 * 14 });
  ctx.redirect('/dashboard');
}

function signupPage(ctx) {
  if (ctx.user) return ctx.redirect('/dashboard');
  const error = ctx.query.error ? '<p class="text-red-600 text-sm mb-3">' + esc(ctx.query.error) + '</p>' : '';
  const body = `
  <div class="max-w-sm mx-auto mt-16 bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
    <h1 class="text-xl font-bold mb-1">Create your agency</h1>
    <p class="text-sm text-slate-500 mb-6">Spin up a new white-label workspace.</p>
    ${error}
    <form method="POST" action="/signup" class="space-y-4">
      <div>
        <label class="text-sm font-medium">Agency name</label>
        <input name="agency_name" required class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Northstar Marketing" />
      </div>
      <div>
        <label class="text-sm font-medium">Your name</label>
        <input name="name" required class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Email</label>
        <input name="email" type="email" required class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Password</label>
        <input name="password" type="password" required minlength="6" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </div>
      <button class="w-full bg-indigo-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-indigo-700">Create agency</button>
    </form>
    <p class="text-xs text-slate-400 mt-4">Already have an account? <a href="/login" class="text-indigo-600">Log in</a>.</p>
  </div>`;
  ctx.html(layout({ title: 'Sign up', user: null, body }));
}

function handleSignup(ctx) {
  const { agency_name, name, email, password } = ctx.body;
  if (!agency_name || !name || !email || !password) {
    return ctx.redirect('/signup?error=' + encodeURIComponent('All fields are required.'));
  }
  if (findUserByEmail(email)) {
    return ctx.redirect('/signup?error=' + encodeURIComponent('That email is already registered.'));
  }
  const agencyInfo = db.prepare('INSERT INTO agencies (name) VALUES (?)').run(agency_name);
  const userId = createUser({ agencyId: agencyInfo.lastInsertRowid, name, email, password });
  const cookie = createSession(userId);
  ctx.setCookie('session', cookie, { maxAge: 60 * 60 * 24 * 14 });
  ctx.redirect('/dashboard');
}

function handleLogout(ctx) {
  const cookies = parseCookies(ctx.req);
  destroySessionToken(cookies.session);
  ctx.setCookie('session', '', { clear: true });
  ctx.redirect('/login');
}

module.exports = { loginPage, handleLogin, signupPage, handleSignup, handleLogout };
