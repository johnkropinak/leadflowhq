// src/api/twilio.js
// Twilio webhooks. Point a Twilio phone number's "A call comes in" webhook
// at /webhooks/twilio/voice?client_api_key=... to enable missed-call
// text-back: we dial the business's real phone, and if nobody answers we
// instantly text the caller instead of losing the lead.
const { db } = require('../db');
const { sendSms } = require('../messaging');

function getClientByApiKey(apiKey) {
  return db.prepare('SELECT * FROM clients WHERE api_key = ?').get(apiKey);
}
function getAgencyForClient(client) {
  return db.prepare('SELECT * FROM agencies WHERE id = ?').get(client.agency_id);
}

function handleVoiceWebhook(ctx) {
  const apiKey = ctx.query.client_api_key;
  const client = apiKey && getClientByApiKey(apiKey);
  const from = ctx.body.From || ctx.body.Caller || 'unknown';

  if (!client || !client.forward_to_number) {
    // No client / no forwarding number configured -- apologize and hang up.
    return ctx.xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry, this number is not fully configured yet. Please try again later.</Say></Response>`);
  }

  db.prepare(`INSERT INTO call_events (client_id, caller_number, call_sid, dial_status, action_taken) VALUES (?, ?, ?, 'ringing', 'call_started')`)
    .run(client.id, from, ctx.body.CallSid || null);

  const statusCallback = `/webhooks/twilio/voice-status?client_api_key=${encodeURIComponent(apiKey)}&caller=${encodeURIComponent(from)}`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20" action="${statusCallback}" callerId="${ctx.body.To || ''}">
    <Number>${client.forward_to_number}</Number>
  </Dial>
</Response>`;
  ctx.xml(twiml);
}

async function handleVoiceStatus(ctx) {
  const apiKey = ctx.query.client_api_key;
  const client = apiKey && getClientByApiKey(apiKey);
  const caller = ctx.query.caller || ctx.body.From || 'unknown';
  const dialStatus = ctx.body.DialCallStatus || 'unknown';

  if (!client) return ctx.xml('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

  const missed = dialStatus !== 'completed';
  let action = 'call_completed';

  if (missed && caller !== 'unknown') {
    const agency = getAgencyForClient(client);
    const body = `Hi, sorry we missed your call to ${client.business_name}! We'll call you right back. If it's urgent, reply here and we'll respond ASAP.`;
    await sendSms({ agency, client, to: caller, body });
    action = 'text_back_sent';
  }

  db.prepare(`INSERT INTO call_events (client_id, caller_number, dial_status, action_taken) VALUES (?, ?, ?, ?)`)
    .run(client.id, caller, dialStatus, action);

  ctx.xml('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

function handleInboundSms(ctx) {
  const apiKey = ctx.query.client_api_key;
  const client = apiKey && getClientByApiKey(apiKey);
  if (client) {
    db.prepare(`
      INSERT INTO messages (client_id, direction, channel, to_address, from_address, body, status)
      VALUES (?, 'inbound', 'sms', ?, ?, ?, 'received')
    `).run(client.id, ctx.body.To || '', ctx.body.From || '', ctx.body.Body || '');
  }
  ctx.xml('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

module.exports = { handleVoiceWebhook, handleVoiceStatus, handleInboundSms };
