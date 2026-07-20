// src/auth.js
const crypto = require('node:crypto');
const { db } = require('./db');

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';
const SESSION_DAYS = 14;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createUser({ agencyId, name, email, password }) {
  const { hash, salt } = hashPassword(password);
  const stmt = db.prepare(
    `INSERT INTO users (agency_id, name, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)`
  );
  const info = stmt.run(agencyId, name, email.toLowerCase().trim(), hash, salt);
  return info.lastInsertRowid;
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
  return `${token}.${sig}`;
}

function verifySessionCookie(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return null;
  const [token, sig] = cookieValue.split('.');
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  return user || null;
}

function destroySessionToken(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return;
  const [token] = cookieValue.split('.');
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function currentUser(req) {
  const cookies = parseCookies(req);
  return verifySessionCookie(cookies.session);
}

module.exports = {
  hashPassword,
  verifyPassword,
  createUser,
  findUserByEmail,
  createSession,
  verifySessionCookie,
  destroySessionToken,
  parseCookies,
  currentUser,
};
