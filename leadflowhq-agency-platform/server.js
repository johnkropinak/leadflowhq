// server.js
// Entry point. Pure Node http server -- no Express, no build step.
// Minimal .env loader (no dependency). Safe no-op if .env doesn't exist.
(function loadDotEnv() {
  const fs = require('node:fs');
  const path = require('node:path');
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
})();

const http = require('node:http');
const { URL } = require('node:url');
const querystring = require('node:querystring');

const { Router } = require('./src/router');
const { currentUser } = require('./src/auth');

const authPages = require('./src/pages/auth');
const dashboardPages = require('./src/pages/dashboard');
const clientPages = require('./src/pages/clients');
const settingsPages = require('./src/pages/settings');
const leadsApi = require('./src/api/leads');
const twilioApi = require('./src/api/twilio');

const PORT = process.env.PORT || 3000;
const router = new Router();

// ---- Auth pages ----
router.get('/', (ctx) => ctx.redirect(ctx.user ? '/dashboard' : '/login'));
router.get('/login', authPages.loginPage);
router.post('/login', authPages.handleLogin);
router.get('/signup', authPages.signupPage);
router.post('/signup', authPages.handleSignup);
router.get('/logout', authPages.handleLogout);

// ---- Dashboard ----
router.get('/dashboard', requireAuth(dashboardPages.overviewPage));
router.get('/dashboard/clients', requireAuth(clientPages.clientsListPage));
router.post('/dashboard/clients', requireAuth(clientPages.handleCreateClient));
router.get('/dashboard/clients/:id', requireAuth(clientPages.clientDetailPage));
router.post('/dashboard/clients/:id', requireAuth(clientPages.handleUpdateClient));
router.post('/dashboard/clients/:id/jobs', requireAuth(clientPages.handleAddJob));
router.post('/dashboard/clients/:id/jobs/:jobId/complete', requireAuth(clientPages.handleCompleteJob));
router.post('/dashboard/clients/:id/test-lead', requireAuth(clientPages.handleSendTestLead));
router.get('/dashboard/settings', requireAuth(settingsPages.settingsPage));
router.post('/dashboard/settings', requireAuth(settingsPages.handleUpdateSettings));

// ---- Public API (called by client websites) ----
router.post('/api/leads', leadsApi.handleLeadCapture);

// ---- Twilio webhooks (called by Twilio, not by browsers) ----
router.post('/webhooks/twilio/voice', twilioApi.handleVoiceWebhook);
router.post('/webhooks/twilio/voice-status', twilioApi.handleVoiceStatus);
router.post('/webhooks/twilio/inbound-sms', twilioApi.handleInboundSms);

function requireAuth(handler) {
  return (ctx) => {
    if (!ctx.user) return ctx.redirect('/login');
    return handler(ctx);
  };
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5_000_000) req.destroy();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseBody(raw, contentType = '') {
  if (!raw) return {};
  if (contentType.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return querystring.parse(raw);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method.toUpperCase();
    const match = router.match(method, url.pathname);

    const user = currentUser(req);
    const raw = method === 'POST' ? await readBody(req) : '';
    const body = parseBody(raw, req.headers['content-type'] || '');
    const query = Object.fromEntries(url.searchParams.entries());

    const ctx = {
      req, res, params: match ? match.params : {}, query, body, user,
      redirect(location) {
        res.writeHead(302, { Location: location });
        res.end();
      },
      html(str, status = 200) {
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(str);
      },
      json(obj, status = 200) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      },
      xml(str, status = 200) {
        res.writeHead(status, { 'Content-Type': 'text/xml; charset=utf-8' });
        res.end(str);
      },
      setCookie(name, value, opts = {}) {
        const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
        if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
        if (opts.clear) parts.push('Max-Age=0');
        res.setHeader('Set-Cookie', parts.join('; '));
      },
    };

    if (!match) {
      ctx.html('<h1>404 Not Found</h1>', 404);
      return;
    }
    await match.handler(ctx);
  } catch (err) {
    console.error('Unhandled error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n  LeadFlowHQ running: http://localhost:${PORT}`);
  console.log(`  Run "npm run seed" first if you haven't already.\n`);
});
