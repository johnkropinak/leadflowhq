// src/seed.js -- run with `npm run seed`
// Creates a demo agency, login, and a couple of sample clients with leads,
// messages, and jobs so the dashboard isn't empty on first run.
const { db, genApiKey } = require('./db');
const { createUser, findUserByEmail } = require('./auth');

function run() {
  let agencyId;
  const existingUser = findUserByEmail('demo@leadflowhq.test');
  if (existingUser) {
    console.log('Demo data already seeded. Login: demo@leadflowhq.test / demo1234');
    return;
  }

  const agencyInfo = db.prepare('INSERT INTO agencies (name) VALUES (?)').run('Northstar Marketing (Demo Agency)');
  agencyId = agencyInfo.lastInsertRowid;
  createUser({ agencyId, name: 'Demo Owner', email: 'demo@leadflowhq.test', password: 'demo1234' });

  const clientsData = [
    {
      business_name: 'Ace Plumbing Co.',
      industry: 'Plumbing',
      contact_name: 'Marco Reyes',
      contact_phone: '+15555550111',
      contact_email: 'marco@aceplumbing.test',
      forward_to_number: '+15555550111',
      google_review_url: 'https://g.page/r/example-ace-plumbing/review',
    },
    {
      business_name: 'Bright Smile Dental',
      industry: 'Dental',
      contact_name: 'Dr. Priya Nair',
      contact_phone: '+15555550222',
      contact_email: 'front-desk@brightsmile.test',
      forward_to_number: '+15555550222',
      google_review_url: 'https://g.page/r/example-bright-smile/review',
    },
  ];

  for (const c of clientsData) {
    const info = db.prepare(`
      INSERT INTO clients (agency_id, business_name, industry, contact_name, contact_phone, contact_email, forward_to_number, google_review_url, api_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agencyId, c.business_name, c.industry, c.contact_name, c.contact_phone, c.contact_email, c.forward_to_number, c.google_review_url, genApiKey());
    const clientId = info.lastInsertRowid;

    const leadInfo = db.prepare(`
      INSERT INTO leads (client_id, source, name, phone, email, message, status)
      VALUES (?, 'website', 'Jamie Chen', '+15555550999', 'jamie@example.com', 'Do you have any openings this week?', 'new')
    `).run(clientId);

    db.prepare(`
      INSERT INTO messages (client_id, lead_id, direction, channel, to_address, from_address, body, status)
      VALUES (?, ?, 'outbound', 'sms', '+15555550999', 'SIMULATED', ?, 'simulated')
    `).run(clientId, leadInfo.lastInsertRowid, `Hi Jamie, thanks for reaching out to ${c.business_name}! We got your message and will be in touch shortly.`);

    db.prepare(`
      INSERT INTO jobs (client_id, customer_name, customer_phone, customer_email, description, status)
      VALUES (?, 'Alex Rivera', '+15555550888', 'alex@example.com', 'Routine appointment', 'scheduled')
    `).run(clientId);

    db.prepare(`
      INSERT INTO call_events (client_id, caller_number, dial_status, action_taken)
      VALUES (?, '+15555550777', 'no-answer', 'text_back_sent')
    `).run(clientId);
  }

  console.log('Seed complete.');
  console.log('Login at /login with: demo@leadflowhq.test / demo1234');
}

run();
