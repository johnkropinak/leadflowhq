// src/pages/clients.js
const { db, genApiKey } = require('../db');
const { layout, esc } = require('../render');
const { sendSms, sendEmail } = require('../messaging');

function getAgency(agencyId) {
  return db.prepare('SELECT * FROM agencies WHERE id = ?').get(agencyId);
}

function requireOwnedClient(agencyId, clientId) {
  return db.prepare('SELECT * FROM clients WHERE id = ? AND agency_id = ?').get(clientId, agencyId);
}

function clientsListPage(ctx) {
  const clients = db.prepare('SELECT * FROM clients WHERE agency_id = ? ORDER BY created_at DESC').all(ctx.user.agency_id);
  const rows = clients.length
    ? clients.map((c) => `
      <tr class="border-t border-slate-100">
        <td class="py-3 pr-4 font-medium"><a href="/dashboard/clients/${c.id}" class="text-indigo-600 hover:underline">${esc(c.business_name)}</a></td>
        <td class="py-3 pr-4 text-slate-500">${esc(c.industry || '—')}</td>
        <td class="py-3 pr-4 text-slate-500">${esc(c.contact_phone || '—')}</td>
        <td class="py-3 pr-4"><span class="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">${esc(c.status)}</span></td>
        <td class="py-3"><a href="/dashboard/clients/${c.id}" class="text-sm text-indigo-600 hover:underline">Open →</a></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="py-6 text-center text-slate-400">No clients yet. Add your first one below.</td></tr>`;

  const body = `
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">Clients</h1>
  </div>

  <div class="bg-white border border-slate-200 rounded-xl p-5 mb-8">
    <table class="w-full text-sm">
      <thead><tr class="text-left text-slate-400">
        <th class="pb-2 font-medium">Business</th>
        <th class="pb-2 font-medium">Industry</th>
        <th class="pb-2 font-medium">Phone</th>
        <th class="pb-2 font-medium">Status</th>
        <th class="pb-2 font-medium"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="bg-white border border-slate-200 rounded-xl p-5 max-w-xl">
    <h2 class="font-semibold mb-4">Add a new client</h2>
    <form method="POST" action="/dashboard/clients" class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label class="text-sm font-medium">Business name</label>
        <input name="business_name" required class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Ace Plumbing Co." />
      </div>
      <div>
        <label class="text-sm font-medium">Industry</label>
        <input name="industry" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Plumbing" />
      </div>
      <div>
        <label class="text-sm font-medium">Contact name</label>
        <input name="contact_name" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium">Business phone (forward-to)</label>
        <input name="forward_to_number" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="+15551234567" />
      </div>
      <div>
        <label class="text-sm font-medium">Contact email</label>
        <input name="contact_email" type="email" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </div>
      <div class="col-span-2">
        <label class="text-sm font-medium">Google review link</label>
        <input name="google_review_url" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="https://g.page/r/.../review" />
      </div>
      <div class="col-span-2">
        <button class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700">Add client</button>
      </div>
    </form>
  </div>
  `;
  ctx.html(layout({ title: 'Clients', user: ctx.user, active: 'clients', body }));
}

function handleCreateClient(ctx) {
  const { business_name, industry, contact_name, contact_phone, contact_email, forward_to_number, google_review_url, yelp_review_url } = ctx.body;
  if (!business_name) return ctx.redirect('/dashboard/clients');
  const apiKey = genApiKey();
  const info = db.prepare(`
    INSERT INTO clients (agency_id, business_name, industry, contact_name, contact_phone, contact_email, forward_to_number, google_review_url, yelp_review_url, api_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ctx.user.agency_id, business_name, industry || null, contact_name || null, contact_phone || null, contact_email || null, forward_to_number || null, google_review_url || null, yelp_review_url || null, apiKey);
  ctx.redirect('/dashboard/clients/' + info.lastInsertRowid);
}

function clientDetailPage(ctx) {
  const client = requireOwnedClient(ctx.user.agency_id, ctx.params.id);
  if (!client) return ctx.html('<h1>Client not found</h1>', 404);

  const leads = db.prepare('SELECT * FROM leads WHERE client_id = ? ORDER BY created_at DESC LIMIT 25').all(client.id);
  const messages = db.prepare('SELECT * FROM messages WHERE client_id = ? ORDER BY created_at DESC LIMIT 30').all(client.id);
  const jobs = db.prepare('SELECT * FROM jobs WHERE client_id = ? ORDER BY created_at DESC LIMIT 20').all(client.id);
  const callEvents = db.prepare('SELECT * FROM call_events WHERE client_id = ? ORDER BY created_at DESC LIMIT 15').all(client.id);

  const host = ctx.req.headers.host;
  const proto = (ctx.req.headers['x-forwarded-proto'] || 'https');
  const base = `${proto}://${host}`;
  const leadWebhookUrl = `${base}/api/leads`;
  const voiceWebhookUrl = `${base}/webhooks/twilio/voice?client_api_key=${client.api_key}`;
  const smsWebhookUrl = `${base}/webhooks/twilio/inbound-sms?client_api_key=${client.api_key}`;

  const leadRows = leads.length ? leads.map((l) => `
    <tr class="border-t border-slate-100">
      <td class="py-2 pr-4 text-slate-500 whitespace-nowrap">${esc(new Date(l.created_at).toLocaleString())}</td>
      <td class="py-2 pr-4">${esc(l.name || '—')}</td>
      <td class="py-2 pr-4">${esc(l.phone || '—')}</td>
      <td class="py-2 pr-4">${esc(l.email || '—')}</td>
      <td class="py-2 pr-4">${esc(l.source)}</td>
      <td class="py-2"><span class="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">${esc(l.status)}</span></td>
    </tr>`).join('') : `<tr><td colspan="6" class="py-4 text-center text-slate-400">No leads yet.</td></tr>`;

  const msgRows = messages.length ? messages.map((m) => `
    <tr class="border-t border-slate-100">
      <td class="py-2 pr-4 text-slate-500 whitespace-nowrap">${esc(new Date(m.created_at).toLocaleString())}</td>
      <td class="py-2 pr-4">${esc(m.direction)}/${esc(m.channel)}</td>
      <td class="py-2 pr-4">${esc(m.to_address)}</td>
      <td class="py-2 pr-4 max-w-sm truncate" title="${esc(m.body)}">${esc(m.body)}</td>
      <td class="py-2"><span class="inline-block px-2 py-0.5 rounded-full text-xs ${m.status === 'sent' ? 'bg-green-100 text-green-700' : m.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${esc(m.status)}</span></td>
    </tr>`).join('') : `<tr><td colspan="5" class="py-4 text-center text-slate-400">No messages yet.</td></tr>`;

  const jobRows = jobs.length ? jobs.map((j) => `
    <tr class="border-t border-slate-100">
      <td class="py-2 pr-4">${esc(j.customer_name || '—')}</td>
      <td class="py-2 pr-4">${esc(j.description || '—')}</td>
      <td class="py-2 pr-4"><span class="inline-block px-2 py-0.5 rounded-full text-xs ${j.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}">${esc(j.status)}</span></td>
      <td class="py-2 pr-4">${j.review_requested_at ? 'Sent ' + esc(new Date(j.review_requested_at).toLocaleDateString()) : '—'}</td>
      <td class="py-2">${j.status !== 'completed' ? `
        <form method="POST" action="/dashboard/clients/${client.id}/jobs/${j.id}/complete">
          <button class="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Mark complete + request review</button>
        </form>` : ''}</td>
    </tr>`).join('') : `<tr><td colspan="5" class="py-4 text-center text-slate-400">No jobs logged yet.</td></tr>`;

  const callRows = callEvents.length ? callEvents.map((c) => `
    <tr class="border-t border-slate-100">
      <td class="py-2 pr-4 text-slate-500 whitespace-nowrap">${esc(new Date(c.created_at).toLocaleString())}</td>
      <td class="py-2 pr-4">${esc(c.caller_number || '—')}</td>
      <td class="py-2 pr-4">${esc(c.dial_status || '—')}</td>
      <td class="py-2">${esc(c.action_taken || '—')}</td>
    </tr>`).join('') : `<tr><td colspan="4" class="py-4 text-center text-slate-400">No calls logged yet. Point a Twilio number at the Voice Webhook URL below to start tracking missed calls.</td></tr>`;

  const body = `
  <div class="mb-6">
    <a href="/dashboard/clients" class="text-sm text-indigo-600 hover:underline">← All clients</a>
    <h1 class="text-2xl font-bold mt-1">${esc(client.business_name)}</h1>
    <p class="text-sm text-slate-500">${esc(client.industry || '')}</p>
  </div>

  <div class="grid md:grid-cols-3 gap-6 mb-8">
    <div class="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
      <h2 class="font-semibold mb-4">Client settings</h2>
      <form method="POST" action="/dashboard/clients/${client.id}" class="grid grid-cols-2 gap-4">
        <div><label class="text-xs font-medium text-slate-500">Contact name</label>
          <input name="contact_name" value="${esc(client.contact_name)}" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" /></div>
        <div><label class="text-xs font-medium text-slate-500">Contact phone</label>
          <input name="contact_phone" value="${esc(client.contact_phone)}" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" /></div>
        <div><label class="text-xs font-medium text-slate-500">Contact email</label>
          <input name="contact_email" value="${esc(client.contact_email)}" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" /></div>
        <div><label class="text-xs font-medium text-slate-500">Forward-to number (business line)</label>
          <input name="forward_to_number" value="${esc(client.forward_to_number)}" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" /></div>
        <div><label class="text-xs font-medium text-slate-500">Google review link</label>
          <input name="google_review_url" value="${esc(client.google_review_url)}" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" /></div>
        <div><label class="text-xs font-medium text-slate-500">Yelp review link</label>
          <input name="yelp_review_url" value="${esc(client.yelp_review_url)}" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" /></div>
        <div class="col-span-2"><button class="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-slate-700">Save</button></div>
      </form>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <h2 class="font-semibold mb-3">Integration</h2>
      <p class="text-xs text-slate-500 mb-1">Website lead form endpoint (POST):</p>
      <code class="block text-xs bg-slate-100 rounded p-2 mb-3 break-all">${esc(leadWebhookUrl)}</code>
      <p class="text-xs text-slate-500 mb-1">Include api_key = <code class="bg-slate-100 px-1 rounded">${esc(client.api_key)}</code></p>
      <p class="text-xs text-slate-500 mt-3 mb-1">Twilio Voice webhook:</p>
      <code class="block text-xs bg-slate-100 rounded p-2 mb-3 break-all">${esc(voiceWebhookUrl)}</code>
      <p class="text-xs text-slate-500 mb-1">Twilio inbound SMS webhook:</p>
      <code class="block text-xs bg-slate-100 rounded p-2 break-all">${esc(smsWebhookUrl)}</code>
      <form method="POST" action="/dashboard/clients/${client.id}/test-lead" class="mt-4">
        <button class="w-full bg-indigo-600 text-white px-3 py-2 rounded-md text-xs font-semibold hover:bg-indigo-700">Send test lead (demo instant follow-up)</button>
      </form>
    </div>
  </div>

  <div class="bg-white border border-slate-200 rounded-xl p-5 mb-8">
    <h2 class="font-semibold mb-3">Jobs / appointments &amp; review requests</h2>
    <form method="POST" action="/dashboard/clients/${client.id}/jobs" class="flex flex-wrap gap-2 mb-4">
      <input name="customer_name" placeholder="Customer name" class="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[140px]" />
      <input name="customer_phone" placeholder="Customer phone" class="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[140px]" />
      <input name="customer_email" placeholder="Customer email" class="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[160px]" />
      <input name="description" placeholder="Job description" class="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[160px]" />
      <button class="bg-slate-900 text-white px-3 py-2 rounded-md text-sm font-semibold hover:bg-slate-700">Log job</button>
    </form>
    <table class="w-full text-sm">
      <thead><tr class="text-left text-slate-400">
        <th class="pb-2 font-medium">Customer</th><th class="pb-2 font-medium">Description</th>
        <th class="pb-2 font-medium">Status</th><th class="pb-2 font-medium">Review request</th><th class="pb-2 font-medium"></th>
      </tr></thead>
      <tbody>${jobRows}</tbody>
    </table>
  </div>

  <div class="grid md:grid-cols-2 gap-6">
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <h2 class="font-semibold mb-3">Leads</h2>
      <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-400">
          <th class="pb-2 font-medium">Time</th><th class="pb-2 font-medium">Name</th><th class="pb-2 font-medium">Phone</th>
          <th class="pb-2 font-medium">Email</th><th class="pb-2 font-medium">Source</th><th class="pb-2 font-medium">Status</th>
        </tr></thead>
        <tbody>${leadRows}</tbody>
      </table>
    </div>
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <h2 class="font-semibold mb-3">Missed calls</h2>
      <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-400">
          <th class="pb-2 font-medium">Time</th><th class="pb-2 font-medium">Caller</th><th class="pb-2 font-medium">Dial status</th><th class="pb-2 font-medium">Action</th>
        </tr></thead>
        <tbody>${callRows}</tbody>
      </table>
    </div>
  </div>

  <div class="bg-white border border-slate-200 rounded-xl p-5 mt-6">
    <h2 class="font-semibold mb-3">Message log</h2>
    <table class="w-full text-sm">
      <thead><tr class="text-left text-slate-400">
        <th class="pb-2 font-medium">Time</th><th class="pb-2 font-medium">Type</th><th class="pb-2 font-medium">To</th>
        <th class="pb-2 font-medium">Message</th><th class="pb-2 font-medium">Status</th>
      </tr></thead>
      <tbody>${msgRows}</tbody>
    </table>
  </div>
  `;
  ctx.html(layout({ title: client.business_name, user: ctx.user, active: 'clients', body }));
}

function handleUpdateClient(ctx) {
  const client = requireOwnedClient(ctx.user.agency_id, ctx.params.id);
  if (!client) return ctx.html('Not found', 404);
  const { contact_name, contact_phone, contact_email, forward_to_number, google_review_url, yelp_review_url } = ctx.body;
  db.prepare(`
    UPDATE clients SET contact_name=?, contact_phone=?, contact_email=?, forward_to_number=?, google_review_url=?, yelp_review_url=?
    WHERE id = ?
  `).run(contact_name || null, contact_phone || null, contact_email || null, forward_to_number || null, google_review_url || null, yelp_review_url || null, client.id);
  ctx.redirect('/dashboard/clients/' + client.id);
}

function handleAddJob(ctx) {
  const client = requireOwnedClient(ctx.user.agency_id, ctx.params.id);
  if (!client) return ctx.html('Not found', 404);
  const { customer_name, customer_phone, customer_email, description } = ctx.body;
  db.prepare(`
    INSERT INTO jobs (client_id, customer_name, customer_phone, customer_email, description) VALUES (?, ?, ?, ?, ?)
  `).run(client.id, customer_name || null, customer_phone || null, customer_email || null, description || null);
  ctx.redirect('/dashboard/clients/' + client.id);
}

async function handleCompleteJob(ctx) {
  const client = requireOwnedClient(ctx.user.agency_id, ctx.params.id);
  if (!client) return ctx.html('Not found', 404);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND client_id = ?').get(ctx.params.jobId, client.id);
  if (!job) return ctx.html('Job not found', 404);

  const agency = getAgency(ctx.user.agency_id);
  const now = new Date().toISOString();
  db.prepare(`UPDATE jobs SET status='completed', completed_at=?, review_requested_at=? WHERE id=?`).run(now, now, job.id);

  const reviewLink = client.google_review_url || client.yelp_review_url || 'https://google.com/search?q=' + encodeURIComponent(client.business_name + ' reviews');
  const smsBody = `Hi ${job.customer_name || 'there'}, thanks for choosing ${client.business_name}! Mind leaving us a quick review? ${reviewLink}`;

  if (job.customer_phone) {
    await sendSms({ agency, client, to: job.customer_phone, body: smsBody });
  }
  if (job.customer_email) {
    await sendEmail({ agency, client, to: job.customer_email, subject: `How did we do, ${job.customer_name || ''}?`, body: smsBody });
  }
  ctx.redirect('/dashboard/clients/' + client.id);
}

async function handleSendTestLead(ctx) {
  const client = requireOwnedClient(ctx.user.agency_id, ctx.params.id);
  if (!client) return ctx.html('Not found', 404);
  const agency = getAgency(ctx.user.agency_id);

  const info = db.prepare(`INSERT INTO leads (client_id, source, name, phone, email, message) VALUES (?, 'test', 'Test Lead', '+15555550123', 'test-lead@example.com', 'This is a test lead generated from the dashboard.')`).run(client.id);
  const leadId = info.lastInsertRowid;

  const replyBody = `Hi Test Lead, thanks for reaching out to ${client.business_name}! We got your message and someone will call you back shortly.`;
  await sendSms({ agency, client, leadId, to: '+15555550123', body: replyBody });
  if (client.contact_phone) {
    await sendSms({ agency, client, leadId, to: client.contact_phone, body: `New lead for ${client.business_name}: Test Lead, +15555550123. "This is a test lead generated from the dashboard."` });
  }
  ctx.redirect('/dashboard/clients/' + client.id);
}

module.exports = {
  clientsListPage, handleCreateClient, clientDetailPage, handleUpdateClient,
  handleAddJob, handleCompleteJob, handleSendTestLead,
};
