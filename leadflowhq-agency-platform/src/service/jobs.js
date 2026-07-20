// src/service/jobs.js
// Shared "mark job complete -> send review request" logic used by both the
// agency dashboard and the client self-serve portal, so both surfaces stay
// in sync.
const { db } = require('../db');
const { sendSms, sendEmail } = require('../messaging');

async function completeJobAndRequestReview({ agency, client, job }) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE jobs SET status='completed', completed_at=?, review_requested_at=? WHERE id=?`)
    .run(now, now, job.id);

  const reviewLink = client.google_review_url || client.yelp_review_url ||
    'https://google.com/search?q=' + encodeURIComponent(client.business_name + ' reviews');
  const body = `Hi ${job.customer_name || 'there'}, thanks for choosing ${client.business_name}! Mind leaving us a quick review? ${reviewLink}`;

  if (job.customer_phone) {
    await sendSms({ agency, client, to: job.customer_phone, body });
  }
  if (job.customer_email) {
    await sendEmail({ agency, client, to: job.customer_email, subject: `How did we do, ${job.customer_name || ''}?`, body });
  }
}

module.exports = { completeJobAndRequestReview };
