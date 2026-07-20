# Deploying LeadFlowHQ to Railway

This is a step-by-step runbook to get the app live at a real URL, on your
own GitHub + Railway accounts, with your Cloudflare domain pointed at it.

A note on why this is a runbook and not something done automatically: my
tools run in a sandboxed environment with no general internet access (it
can't reach npm, GitHub, or Railway directly), and separately, creating
accounts or entering passwords on your behalf isn't something I do even
when I can reach a browser — that has to be you, in your own browser, with
your own credentials. Everything below is copy-paste-able and should take
15–20 minutes total.

## 1. Get the code onto your machine

Unzip `leadflowhq-agency-platform.zip` (from the chat) somewhere on your
computer, e.g. `~/leadflowhq`. Open a terminal there.

Confirm you have Node 22.5+ and git:
```bash
node -v     # should print v22.5.0 or higher
git --version
```
If Node is older, install it from [nodejs.org](https://nodejs.org) or with
`nvm install 22 && nvm use 22`.

## 2. Create a GitHub repo and push the code

1. Go to [github.com/signup](https://github.com/signup) and create an
   account if you don't have one.
2. Once logged in, go to [github.com/new](https://github.com/new). Name it
   `leadflowhq` (or anything you like), leave it **empty** (don't add a
   README/.gitignore — we already have one), and click **Create repository**.
3. Back in your terminal, in the unzipped `agency-platform` folder:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/leadflowhq.git
git push -u origin main
```
   Replace `YOUR_USERNAME` with your actual GitHub username — GitHub shows
   you this exact URL right after creating the repo.

## 3. Create a Railway account and deploy

1. Go to [railway.app](https://railway.app) and sign up — "Sign in with
   GitHub" is the easiest option and lets Railway see your new repo.
2. Click **New Project → Deploy from GitHub repo**, and pick the repo you
   just pushed.
3. Railway will detect it's a Node app and deploy automatically (there's no
   build step — it just runs `npm install` and `npm start`). Watch the
   **Deploy Logs** tab; you should see `LeadFlowHQ running: http://...`.

## 4. Add persistent storage for the database

Without this, your data resets every time you redeploy.

1. In your Railway project, click your service → **Settings → Volumes**.
2. Click **Add Volume**. Set the mount path to `/app/data`.
3. Redeploy (Railway usually does this automatically after adding a
   volume). This makes `data/agency.db` persist across deploys.

## 5. Set your session secret

1. Go to **Variables** on your service.
2. Add `SESSION_SECRET` with a long random value. Generate one locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
3. Save — Railway redeploys automatically when you change variables.

## 6. Get a public URL and log in

1. Go to **Settings → Networking → Generate Domain**. You'll get something
   like `leadflowhq-production.up.railway.app`.
2. Visit that URL. Click **"Create one"** on the login page to create your
   real agency account (skip `npm run seed`'s demo data in production —
   that's only meant for local testing).

## 7. Point your Cloudflare domain at it

1. In Railway, go to **Settings → Networking → Custom Domain**, and enter
   something like `app.youragency.com`. Railway will show you a CNAME
   target (something like `xyz.up.railway.app`).
2. In the Cloudflare dashboard for your domain, go to **DNS → Records**,
   add a **CNAME** record: name `app`, target the value Railway gave you.
3. Set the Cloudflare proxy status to **DNS only** (grey cloud, not
   orange) at first — Railway needs to issue its own TLS certificate for
   the domain, and Cloudflare's proxy can interfere with that step. Once
   Railway shows the custom domain as active/verified, you can try turning
   the proxy (orange cloud) back on if you want Cloudflare's CDN/DDoS
   protection in front of it — test that the site still loads over HTTPS
   afterward.
4. Give DNS a few minutes to propagate, then visit `https://app.youragency.com`.

## 8. Connect Twilio and SendGrid

Once you're live, log in and go to **Settings** in the app to add your
Twilio and SendGrid credentials (see README.md for how to get those). Until
you do, everything runs in simulate mode — safe to leave that way while
you're testing.

## Shipping updates later

Any time you change the code, just commit and push:
```bash
git add .
git commit -m "describe your change"
git push
```
Railway redeploys automatically on every push to `main`.

## Setting up client portal logins

Once a client exists in your dashboard (Clients → open a client), scroll
to **Client portal access** and create a login (name, email, temporary
password) for the business owner. Give them that email/password and the
portal URL shown on that page (`https://your-domain/portal/login`) — they
log in there and only ever see their own leads, messages, and jobs, never
your other clients'.
