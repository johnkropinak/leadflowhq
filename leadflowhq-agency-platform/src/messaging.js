// src/messaging.js
// Sends SMS via Twilio's REST API and email via SendGrid's REST API using
// Node's built-in fetch -- no SDKs required. If an agency has not configured
// credentials yet, messages are "simulated": logged to console and stored in
// the messages table with status 'simulated' so the whole product works
// end-to-end in demos before you ever sign up for Twilio/SendGrid.
const { db } = require('./db');

async function sendSms({ agency, client, leadId = null, to, body }) {
  const hasTwilio = agency.twilio_account_sid && agency.twilio_auth_token && agency.twilio_from_number;
  let status = 'simulated';
  let providerId = null;

  if (hasTwilio) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${agency.twilio_account_sid}/Messages.json`;
      const auth = Buffer.from(`${agency.twilio_account_sid}:${agency.twilio_auth_token}`).toString('base64');
      const params = new URLSearchParams({ To: to, From: agency.twilio_from_number, Body: body });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const json = await res.json();
      if (res.ok) {
        status = 'sent';
        providerId = json.sid || null;
      } else {
        status = 'failed';
        providerId = json.code ? String(json.code) : null;
        console.error('[twilio] send failed:', json.message || json);
      }
    } catch (err) {
      status = 'failed';
      console.error('[twilio] error sending SMS:', err.message);
    }
  } else {
    console.log(`[SIMULATED SMS] to ${to}: ${body}`);
  }

  db.prepare(
    `INSERT INTO messages (client_id, lead_id, direction, channel, to_address, from_address, body, status, provider_id)
     VALUES (?, ?, 'outbound', 'sms', ?, ?, ?, ?, ?)`
  ).run(client.id, leadId, to, agency.twilio_from_number || 'SIMULATED', body, status, providerId);

  return { status, providerId };
}

async function sendEmail({ agency, client, leadId = null, to, subject, body }) {
  const hasSendGrid = agency.sendgrid_api_key && agency.sendgrid_from_email;
  let status = 'simulated';
  let providerId = null;

  if (hasSendGrid) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agency.sendgrid_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: agency.sendgrid_from_email },
          subject,
          content: [{ type: 'text/plain', value: body }],
        }),
      });
      if (res.ok) {
        status = 'sent';
        providerId = res.headers.get('x-message-id');
      } else {
        status = 'failed';
        const text = await res.text();
        console.error('[sendgrid] send failed:', text);
      }
    } catch (err) {
      status = 'failed';
      console.error('[sendgrid] error sending email:', err.message);
    }
  } else {
    console.log(`[SIMULATED EMAIL] to ${to}: ${subject}\n${body}`);
  }

  db.prepare(
    `INSERT INTO messages (client_id, lead_id, direction, channel, to_address, from_address, body, status, provider_id)
     VALUES (?, ?, 'outbound', 'email', ?, ?, ?, ?, ?)`
  ).run(client.id, leadId, to, agency.sendgrid_from_email || 'SIMULATED', `${subject}\n\n${body}`, status, providerId);

  return { status, providerId };
}

module.exports = { sendSms, sendEmail };
