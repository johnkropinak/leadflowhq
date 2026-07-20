// src/pages/portal.js
// The client-facing self-serve portal. A client_user is always scoped to
// exactly one client_id (set at login, taken from the session -- never
// from a URL/body param) so a business owner can only ever see their own
// data, never another agency client's.
const { db } = require('../db');
const { portalLayout, esc } = require('../render');
const { findClientUserByEmail, verifyPassword, createClientSession, destroyClientSessionToken, parseCookies } = require('../auth');
const { completeJobAndRequestReview } = require('../service/jobs');

function getClient(clientId) {
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
}
function getAgency(agencyId) {
  return db.prepare('SELECT * FROM agencies WHERE id = ?').get(agencyId);
}

function loginPage(ctx) {
  if (ctx.clientUser) return ctx.redirect('/portal');
  const error = ctx.query.error ? `<p class="text-red-600 text-sm mb-3">${esc(ctx.query.error)}</p>` : '';
  const body = `
  <div class="max-w-sm mx-auto mt-16 bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
    <h1 class="text-xl font-bold mb-1">Client portal</h1>
    <p class="text-sm text-slate-500 mb-6">Log in to see your leads, messages, and jobs.</p>
    ${error}
    <form method="POST" action="/portal/login" class="space-y-4">
      <div>
        <label class="text-sm font-medium">Email</label>
        <input name="email" type="email" required class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Password</label>
        <input name="password" type="password" required class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </div>
      <button class="w-full bg-indigo-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-indigo-700">Log in</button>
    </form>
    <p class="text-xs text-slate-400 mt-4">Don't have a login yet? Ask your marketing agency to set one up for you.</p>
  </div>`;
  ctx.html(portalLayout({ title: 'Log in', clientUser: null, body }));
}

function handleLogin(ctx) {
  const { email, password } = ctx.body;
  const clientUser = email && findClientUserByEmail(email);
  if (!clientUser || !verifyPassword(password || '', clientUser.password_salt, clientUser.password_hash)) {
    return ctx.redirect('/portal/login?error=' + encodeURIComponent('Invalid email or password.'));
  }
  const cookie = createClientSession(clientUser.id);
  ctx.setCookie('client_session', cookie, { maxAge: 60 * 60 * 24 * 14 });
  ctx.redirect('/portal');
}

function handleLogout(ctx) {
  const cookies = parseCookies(ctx.req);
  destroySessionTokenSafe(cookies.client_session);
  ctx.setCookie('client_session', '', { clear: true });
  ctx.redirect('/portal/login');
}
function destroySessionTokenSafe(cookie) { destroyClientSessionToken(cookie); }

function homePage(ctx) {
  const client = getClient(ctx.clientUser.client_id);
  if (!client) return ctx.html('Client not found', 404);

  const leads = db.prepare('SELECT * FROM leads WHERE client_id = ? ORDER BY created_at DESC LIMIT 25').all(client.id);
  const jobs = db.prepare('SELECT * FROM jobs WHERE client_id = ? ORDER BY created_at DESC LIMIT 20').all(client.id);
  const messages = db.prepare('SELECT * FROM messages WHERE client_id = ? ORDER BY created_at DESC LIMIT 20').all(client.id);
  const missedCalls = db.prepare(`SELECT COUNT(*) c FROM call_events WHERE client_id = ? AND action_taken = 'text_back_sent'`).get(client.id).c;

  const statCard = (label, value) => `
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <p class="text-sm text-slate-500">${label}</p>
      <p class="text-3xl font-bold mt-1">${value}</p>
    </div>`;

  const leadRows = leads.length ? leads.map((l) => `
    <tr class="border-t border-slate-100">
      <td class="py-2 pr-4 text-slate-500 whitespace-nowrap">${esc(new Date(l.created_at).toLocaleString())}</td>
      <td class="py-2 pr-4">${esc(l.name || '—')}</td>
      <td class="py-2 pr-4">${esc(l.phone || '—')}</td>
      <td class="py-2 pr-4">${esc(l.email || '—')}</td>
      <td class="py-2">${esc(l.status)}</td>
    </tr>`).join('') : `<tr><td colspan="5" class="py-4 text-center text-slate-400">No leads yet.</td></tr>`;

  const jobRows = jobs.length ? jobs.map((j) => `
    <tr class="border-t border-slate-100">
      <td class="py-2 pr-4">${esc(j.customer_name || '—')}</td>
      <td class="py-2 pr-4">${esc(j.description || '—')}</td>
      <td class="py-2 pr-4"><span class="inline-block px-2 py-0.5 rounded-full text-xs ${j.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}">${esc(j.status)}</span></td>
      <td class="py-2">${j.status !== 'completed' ? `
        <form method="POST" action="/portal/jobs/${j.id}/complete">
          <button class="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Mark complete + request review</button>
        </form>` : (j.review_requested_at ? 'Review requested' : '')}</td>
    </tr>`).join('') : `<tr><td colspan="4" class="py-4 text-center text-slate-400">No jobs logged yet.</td></tr>`;

  const msgRows = messages.length ? messages.map((m) => `
    <tr class="border-t border-slate-100">
      <td class="py-2 pr-4 text-slate-500 whitespace-nowrap">${esc(new Date(m.created_at).toLocaleString())}</td>
      <td class="py-2 pr-4">${esc(m.direction)}/${esc(m.channel)}</td>
      <td class="py-2 pr-4">${esc(m.to_address)}</td>
      <td class="py-2 pr-4 max-w-sm truncate" title="${esc(m.body)}">${esc(m.body)}</td>
    </tr>`).join('') : `<tr><td colspan="4" class="py-4 text-center text-slate-400">No messages yet.</td></tr>`;

  const body = `
  <h1 class="text-2xl font-bold mb-1">Welcome back${ctx.clientUser.name ? ', ' + esc(ctx.clientUser.name.split(' ')[0]) : ''}</h1>
  <p class="text-sm text-slate-500 mb-6">${esc(client.business_name)}</p>

  <div class="grid grid-cols-3 gap-4 mb-8">
    ${statCard('Leads', leads.length)}
    ${statCard('Missed calls texted back', missedCalls)}
    ${statCard('Open jobs', jobs.filter((j) => j.status !== 'completed').length)}
  </div>

  <div class="bg-white border border-slate-200 rounded-xl p-5 mb-6">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-semibold">Jobs</h2>
    </div>
    <form method="POST" action="/portal/jobs" class="flex flex-wrap gap-2 mb-4">
      <input name="customer_name" placeholder="Customer name" class="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[140px]" />
      <input name="customer_phone" placeholder="Customer phone" class="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[140px]" />
      <input name="customer_email" placeholder="Customer email" class="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[160px]" />
      <input name="description" placeholder="Job description" class="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[160px]" />
      <button class="bg-slate-900 text-white px-3 py-2 rounded-md text-sm font-semibold hover:bg-slate-700">Log job</button>
    </form>
    <table class="w-full text-sm">
      <thead><tr class="text-left text-slate-400">
        <th class="pb-2 font-medium">Customer</th><th class="pb-2 font-medium">Description</th><th class="pb-2 font-medium">Status</th><th class="pb-2 font-medium"></th>
      </tr></thead>
      <tbody>${jobRows}</tbody>
    </table>
  </div>

  <div class="grid md:grid-cols-2 gap-6">
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <h2 class="font-semibold mb-3">Recent leads</h2>
      <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-400">
          <th class="pb-2 font-medium">Time</th><th class="pb-2 font-medium">Name</th><th class="pb-2 font-medium">Phone</th><th class="pb-2 font-medium">Email</th><th class="pb-2 font-medium">Status</th>
        </tr></thead>
        <tbody>${leadRows}</tbody>
      </table>
    </div>
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <h2 class="font-semibold mb-3">Message log</h2>
      <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-400">
          <th class="pb-2 font-medium">Time</th><th class="pb-2 font-medium">Type</th><th class="pb-2 font-medium">To</th><th class="pb-2 font-medium">Message</th>
        </tr></thead>
        <tbody>${msgRows}</tbody>
      </table>
    </div>
  </div>
  `;
  ctx.html(portalLayout({ title: 'Portal', clientUser: ctx.clientUser, businessName: client.business_name, body }));
}

function handleAddJob(ctx) {
  const client = getClient(ctx.clientUser.client_id);
  if (!client) return ctx.html('Not found', 404);
  const { customer_name, customer_phone, customer_email, description } = ctx.body;
  db.prepare(`INSERT INTO jobs (client_id, customer_name, customer_phone, customer_email, description) VALUES (?, ?, ?, ?, ?)`)
    .run(client.id, customer_name || null, customer_phone || null, customer_email || null, description || null);
  ctx.redirect('/portal');
}

async function handleCompleteJob(ctx) {
  const client = getClient(ctx.clientUser.client_id);
  if (!client) return ctx.html('Not found', 404);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND client_id = ?').get(ctx.params.jobId, client.id);
  if (!job) return ctx.html('Job not found', 404);
  const agency = getAgency(client.agency_id);
  await completeJobAndRequestReview({ agency, client, job });
  ctx.redirect('/portal');
}

module.exports = { loginPage, handleLogin, handleLogout, homePage, handleAddJob, handleCompleteJob };
