// src/api/leads.js
// Public endpoint that a client's website contact form (or any lead source)
// posts to. Creates the lead and fires an instant SMS/email follow-up to
// the lead AND a notification to the business -- this is the "instant lead
// follow-up" feature. Works with plain HTML forms or fetch()/JSON.
const { db } = require('../db');
const { sendSms, sendEmail } = require('../messaging');

function getAgencyForClient(client) {
  return db.prepare('SELECT * FROM agencies WHERE id = ?').get(client.agency_id);
}

async function handleLeadCapture(ctx) {
  const { api_key, name, phone, email, message, source } = ctx.body;
  if (!api_key) return ctx.json({ error: 'api_key is required' }, 400);

  const client = db.prepare('SELECT * FROM clients WHERE api_key = ?').get(api_key);
  if (!client) return ctx.json({ error: 'invalid api_key' }, 404);
  if (!phone && !email) return ctx.json({ error: 'phone or email is required' }, 400);

  const info = db.prepare(`
    INSERT INTO leads (client_id, source, name, phone, email, message) VALUES (?, ?, ?, ?, ?, ?)
  `).run(client.id, source || 'website', name || null, phone || null, email || null, message || null);
  const leadId = info.lastInsertRowid;

  const agency = getAgencyForClient(client);
  const firstName = (name || '').split(' ')[0] || 'there';

  // Instant reply to the lead
  if (phone) {
    await sendSms({
      agency, client, leadId, to: phone,
      body: `Hi ${firstName}, thanks for reaching out to ${client.business_name}! We got your message and will be in touch shortly.`,
    });
  }
  if (email) {
    await sendEmail({
      agency, client, leadId, to: email,
      subject: `Thanks for contacting ${client.business_name}`,
      body: `Hi ${firstName},\n\nThanks for reaching out to ${client.business_name}. We received your message and will be in touch shortly.\n\n${message ? 'Your message: "' + message + '"' : ''}`,
    });
  }

  // Notify the business owner instantly
  if (client.contact_phone) {
    await sendSms({
      agency, client, leadId, to: client.contact_phone,
      body: `New lead for ${client.business_name}: ${name || 'Unknown'} ${phone || email || ''}. "${(message || '').slice(0, 140)}"`,
    });
  }

  ctx.json({ ok: true, lead_id: leadId });
}

module.exports = { handleLeadCapture };
