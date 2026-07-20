# LeadFlowHQ

A white-label platform for running a local marketing agency: missed-call
text-back, instant lead follow-up, automated review requests, a client
CRM/dashboard, and SEO-optimized website templates you can sell and deploy
for small business clients.

**Zero npm dependencies.** It's a plain Node.js app (built-in `http`
server, built-in `node:sqlite` database, built-in `fetch` for the
Twilio/SendGrid REST APIs). There is no `npm install` step and nothing to
compile — clone it, run it. This also means it's easy to read, audit, and
customize even if you're not a full-time developer.

## What's included

- **Missed-call text-back** — give each client a tracking phone number.
  When a call comes in, we dial their real business line; if nobody
  answers, the caller instantly gets a text so the lead isn't lost.
- **Instant lead follow-up** — a `/api/leads` endpoint your client's
  website contact form posts to. The lead gets an immediate SMS/email
  reply, and the business owner gets an instant new-lead alert.
- **Review request automation** — mark a job "complete" in the dashboard
  and the customer automatically gets a text/email with a link to leave a
  Google or Yelp review.
- **Client CRM/dashboard** — one login per agency, with all of your
  clients, their leads, message history, missed calls, and jobs in one
  place.
- **Two SEO-optimized website templates** — responsive, fast, JSON-LD
  local-business schema, meta tags, sitemap/robots.txt, and a contact form
  that's pre-wired to the instant-lead-follow-up API. A generator script
  spins up a new client site from a JSON config in seconds.
- **Simulate mode** — until you connect Twilio/SendGrid, every send is
  logged instead of delivered, so you can demo the whole product safely
  with $0 spent and no live accounts.

## Requirements

- Node.js **22.5 or newer** (for the built-in `node:sqlite` module).
  Check with `node -v`. If you're on an older Node, upgrade via
  [nodejs.org](https://nodejs.org) or `nvm install 22`.

## Quick start (local)

```bash
cd agency-platform
npm run seed     # creates a demo agency + 2 demo clients with sample data
npm start         # starts the server on http://localhost:3000
```

Log in at `http://localhost:3000/login` with:
- Email: `demo@leadflowhq.test`
- Password: `demo1234`

Or click "Create one" on the login page to spin up your own agency account
instead of using the demo data.

Use `npm run dev` instead of `npm start` while developing — it restarts
automatically on file changes.

## How the pieces fit together

**Agency → Clients → Leads/Messages/Jobs.** You (the agency) log in once
and manage every client business underneath your account. Each client gets:
- a unique **API key** (for the lead-capture endpoint)
- a **tracking phone number** you buy in Twilio and point at this app
- a **forward-to number** (their real business line)
- Google/Yelp review links for the review-request automation

All of this is visible on each client's detail page in the dashboard,
along with the exact webhook URLs to paste into Twilio and the exact
snippet to use in the website contact form.

## Connecting Twilio (SMS + missed-call text-back)

1. Create a free trial account at [twilio.com](https://www.twilio.com).
2. Buy a phone number with Voice + SMS capability (Console → Phone
   Numbers → Buy a Number).
3. In your app, go to **Settings** and paste in your Account SID, Auth
   Token, and the Twilio number you bought as the "From number." This
   turns off simulate mode for your whole agency.
4. For **each client**, open their client page and copy:
   - the **Voice webhook URL** → paste into the Twilio number's
     "A call comes in" webhook (as a POST request)
   - the **inbound SMS webhook URL** → paste into "A message comes in"
     (optional, just logs replies into the message timeline)
5. Set the client's **forward-to number** to their real business line on
   the client detail page — that's who we dial when the tracking number
   rings.
6. Call the tracking number and don't answer — you should see a missed
   call logged and a text-back sent (check the message log, or your own
   phone if you used a real number as the caller).

You only pay Twilio for what you use — a phone number is roughly
$1.15/month plus a few cents per SMS/call, so your margin on a client
subscription is very high.

## Connecting SendGrid (email)

1. Create a free account at [sendgrid.com](https://sendgrid.com) (100
   emails/day free tier is enough to start).
2. Verify a sender email address (Settings → Sender Authentication).
3. Create an API key (Settings → API Keys → Restricted Access → Mail Send).
4. Paste the API key and verified sender email into **Settings** in the
   app.

## Wiring up a client's website (instant lead follow-up)

Any contact form can POST JSON to:

```
POST https://your-deployed-domain.com/api/leads
Content-Type: application/json

{
  "api_key": "the client's api key from their dashboard page",
  "name": "Jane Doe",
  "phone": "+15551234567",
  "email": "jane@example.com",
  "message": "Need a quote for a water heater"
}
```

If you use the included website templates, this is already wired up in
the contact form's JavaScript — you only need to fill in `lead_api_url`
and `lead_api_key` in the site config.

## Deploying

This is a normal long-running Node process (not a static site or
serverless function), so it needs a host that runs Node continuously.
Good low-cost options: **Railway**, **Render**, or **Fly.io** (all have
free/cheap tiers and a "deploy from GitHub" flow), or a small VPS
(DigitalOcean, Linode) if you want full control.

1. Push this folder to a GitHub repo (or deploy directly from your
   machine, depending on the host).
2. Set the start command to `npm start` and make sure the host's Node
   version is **22.5+**.
3. Set environment variables: `SESSION_SECRET` (a long random string —
   generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   and optionally `PORT` (most hosts inject this automatically).
4. The SQLite database lives in `data/agency.db` inside the app's own
   filesystem. Make sure your host has a **persistent disk/volume**
   mounted at `data/` (Railway/Render/Fly all support this) — without it,
   your data resets on every redeploy.
5. Point your Cloudflare-managed domain at the host: add a `CNAME` (or
   `A`) record for something like `app.youragency.com` to the hostname/IP
   your provider gives you. Keep Cloudflare's proxy ("orange cloud") on
   for free SSL and DDoS protection.

## Deploying a client website (the templates)

```bash
cd website-templates
cp example-config.json ace-plumbing.json   # edit with the client's info
node generate-site.js local-service-pro ace-plumbing.json ./output/ace-plumbing
```

This produces a plain folder of `index.html` / `styles.css` /
`robots.txt` / `sitemap.xml` — no build step. Deploy it to **Cloudflare
Pages** (drag-and-drop the folder, or connect a repo), then point the
client's domain at it in Cloudflare DNS. Two templates ship today —
`local-service-pro` (home services / trades) and `contractor-clean`
(contractors / professional services) — and you can duplicate a template
folder to create more variations as your agency grows.

## Project structure

```
agency-platform/
  server.js              entry point / router wiring
  src/
    db.js                 SQLite schema + connection (node:sqlite)
    auth.js                password hashing + session cookies
    router.js               tiny path router
    render.js                 HTML layout helper
    messaging.js               Twilio/SendGrid senders (with simulate fallback)
    seed.js                     demo data
    pages/                       dashboard HTML pages
    api/                          public API + Twilio webhooks
  website-templates/
    local-service-pro/            template 1 (HTML/CSS)
    contractor-clean/              template 2 (HTML/CSS)
    generate-site.js                 config -> static site generator
    example-config.json
  data/                                SQLite database lives here (gitignored)
```

## Security notes before you sell this to real clients

- Change `SESSION_SECRET` in production — never use the default.
- `node:sqlite` is still an experimental Node API; it has worked reliably
  in testing here, but for a larger multi-client production deployment
  consider migrating to Postgres (the schema in `src/db.js` is a
  straightforward starting point) once you outgrow a single SQLite file.
- Add rate limiting to `/api/leads` before exposing it on a high-traffic
  client site (e.g. a small in-memory token bucket keyed by IP).
- Validate Twilio's `X-Twilio-Signature` header on the webhook routes if
  you want to be strict about only accepting requests from Twilio.
- Back up `data/agency.db` regularly (it's a single file — a simple cron
  job that copies it to cloud storage is enough at small scale).
