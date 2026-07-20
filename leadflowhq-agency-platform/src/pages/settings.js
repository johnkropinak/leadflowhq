// src/pages/settings.js
const { db } = require('../db');
const { layout, esc } = require('../render');

function settingsPage(ctx) {
  const agency = db.prepare('SELECT * FROM agencies WHERE id = ?').get(ctx.user.agency_id);
  const twilioConnected = !!(agency.twilio_account_sid && agency.twilio_auth_token && agency.twilio_from_number);
  const sendgridConnected = !!(agency.sendgrid_api_key && agency.sendgrid_from_email);

  const body = `
  <h1 class="text-2xl font-bold mb-2">Settings</h1>
  <p class="text-sm text-slate-500 mb-6">Connect Twilio and SendGrid so messages actually send. Until you do, all SMS/email sends are simulated (logged, not delivered) so you can demo the product safely.</p>

  <div class="grid md:grid-cols-2 gap-6">
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold">Twilio (SMS &amp; calls)</h2>
        <span class="text-xs px-2 py-0.5 rounded-full ${twilioConnected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">${twilioConnected ? 'Connected' : 'Simulated'}</span>
      </div>
      <form method="POST" action="/dashboard/settings" class="space-y-3">
        <input type="hidden" name="form" value="twilio" />
        <div>
          <label class="text-xs font-medium text-slate-500">Account SID</label>
          <input name="twilio_account_sid" value="${esc(agency.twilio_account_sid)}" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500">Auth Token</label>
          <input name="twilio_auth_token" value="${esc(agency.twilio_auth_token)}" type="password" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500">From number</label>
          <input name="twilio_from_number" value="${esc(agency.twilio_from_number)}" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="+15551234567" />
        </div>
        <button class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700">Save Twilio settings</button>
      </form>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold">SendGrid (Email)</h2>
        <span class="text-xs px-2 py-0.5 rounded-full ${sendgridConnected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">${sendgridConnected ? 'Connected' : 'Simulated'}</span>
      </div>
      <form method="POST" action="/dashboard/settings" class="space-y-3">
        <input type="hidden" name="form" value="sendgrid" />
        <div>
          <label class="text-xs font-medium text-slate-500">API Key</label>
          <input name="sendgrid_api_key" value="${esc(agency.sendgrid_api_key)}" type="password" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="SG.xxxxxxxx" />
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500">From email</label>
          <input name="sendgrid_from_email" value="${esc(agency.sendgrid_from_email)}" class="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="reviews@youragency.com" />
        </div>
        <button class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700">Save SendGrid settings</button>
      </form>
    </div>
  </div>

  <p class="text-xs text-slate-400 mt-6">See README.md for step-by-step instructions on creating a Twilio account, buying a tracking number, and wiring up webhooks.</p>
  `;
  ctx.html(layout({ title: 'Settings', user: ctx.user, active: 'settings', body }));
}

function handleUpdateSettings(ctx) {
  const agencyId = ctx.user.agency_id;
  if (ctx.body.form === 'twilio') {
    const { twilio_account_sid, twilio_auth_token, twilio_from_number } = ctx.body;
    db.prepare('UPDATE agencies SET twilio_account_sid=?, twilio_auth_token=?, twilio_from_number=? WHERE id=?')
      .run(twilio_account_sid || null, twilio_auth_token || null, twilio_from_number || null, agencyId);
  } else if (ctx.body.form === 'sendgrid') {
    const { sendgrid_api_key, sendgrid_from_email } = ctx.body;
    db.prepare('UPDATE agencies SET sendgrid_api_key=?, sendgrid_from_email=? WHERE id=?')
      .run(sendgrid_api_key || null, sendgrid_from_email || null, agencyId);
  }
  ctx.redirect('/dashboard/settings');
}

module.exports = { settingsPage, handleUpdateSettings };
