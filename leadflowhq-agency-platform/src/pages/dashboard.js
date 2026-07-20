// src/pages/dashboard.js
const { db } = require('../db');
const { layout, esc } = require('../render');

function overviewPage(ctx) {
  const agencyId = ctx.user.agency_id;
  const clients = db.prepare('SELECT * FROM clients WHERE agency_id = ?').all(agencyId);
  const clientIds = clients.map((c) => c.id);

  let leadCount = 0, messageCount = 0, missedCallsHandled = 0, reviewsSent = 0;
  let recent = [];

  if (clientIds.length) {
    const placeholders = clientIds.map(() => '?').join(',');
    leadCount = db.prepare(`SELECT COUNT(*) c FROM leads WHERE client_id IN (${placeholders})`).get(...clientIds).c;
    messageCount = db.prepare(`SELECT COUNT(*) c FROM messages WHERE client_id IN (${placeholders})`).get(...clientIds).c;
    missedCallsHandled = db.prepare(`SELECT COUNT(*) c FROM call_events WHERE client_id IN (${placeholders}) AND action_taken = 'text_back_sent'`).get(...clientIds).c;
    reviewsSent = db.prepare(`SELECT COUNT(*) c FROM jobs WHERE client_id IN (${placeholders}) AND review_requested_at IS NOT NULL`).get(...clientIds).c;

    recent = db.prepare(`
      SELECT m.*, c.business_name FROM messages m
      JOIN clients c ON c.id = m.client_id
      WHERE m.client_id IN (${placeholders})
      ORDER BY m.created_at DESC LIMIT 12
    `).all(...clientIds);
  }

  const statCard = (label, value) => `
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <p class="text-sm text-slate-500">${label}</p>
      <p class="text-3xl font-bold mt-1">${value}</p>
    </div>`;

  const activityRows = recent.length
    ? recent.map((m) => `
      <tr class="border-t border-slate-100">
        <td class="py-2 pr-4 text-slate-500 whitespace-nowrap">${esc(new Date(m.created_at).toLocaleString())}</td>
        <td class="py-2 pr-4 font-medium">${esc(m.business_name)}</td>
        <td class="py-2 pr-4"><span class="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100">${esc(m.channel)}</span></td>
        <td class="py-2 pr-4">${esc(m.to_address)}</td>
        <td class="py-2 pr-4 max-w-md truncate" title="${esc(m.body)}">${esc(m.body)}</td>
        <td class="py-2"><span class="inline-block px-2 py-0.5 rounded-full text-xs ${m.status === 'sent' ? 'bg-green-100 text-green-700' : m.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${esc(m.status)}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="py-6 text-center text-slate-400">No activity yet. Add a client and send a test lead to see it here.</td></tr>`;

  const body = `
  <h1 class="text-2xl font-bold mb-6">Overview</h1>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    ${statCard('Clients', clients.length)}
    ${statCard('Leads captured', leadCount)}
    ${statCard('Missed calls text-backed', missedCallsHandled)}
    ${statCard('Review requests sent', reviewsSent)}
  </div>

  <div class="bg-white border border-slate-200 rounded-xl p-5">
    <h2 class="font-semibold mb-3">Recent activity</h2>
    <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead><tr class="text-left text-slate-400">
        <th class="pb-2 font-medium">Time</th>
        <th class="pb-2 font-medium">Client</th>
        <th class="pb-2 font-medium">Channel</th>
        <th class="pb-2 font-medium">To</th>
        <th class="pb-2 font-medium">Message</th>
        <th class="pb-2 font-medium">Status</th>
      </tr></thead>
      <tbody>${activityRows}</tbody>
    </table>
    </div>
  </div>

  <div class="mt-8 flex gap-3">
    <a href="/dashboard/clients" class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700">Manage clients</a>
    <a href="/dashboard/settings" class="bg-white border border-slate-300 px-4 py-2 rounded-md text-sm font-semibold hover:bg-slate-50">Connect Twilio / SendGrid</a>
  </div>
  `;
  ctx.html(layout({ title: 'Overview', user: ctx.user, active: 'overview', body }));
}

module.exports = { overviewPage };
