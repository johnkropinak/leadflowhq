// src/db.js
// Zero-dependency SQLite layer using Node's built-in node:sqlite (Node >= 22.5).
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'agency.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_from_number TEXT,
  sendgrid_api_key TEXT,
  sendgrid_from_email TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  business_name TEXT NOT NULL,
  industry TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  tracking_phone_number TEXT,
  forward_to_number TEXT,
  google_review_url TEXT,
  yelp_review_url TEXT,
  api_key TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  source TEXT NOT NULL DEFAULT 'website',
  name TEXT,
  phone TEXT,
  email TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  lead_id INTEGER REFERENCES leads(id),
  direction TEXT NOT NULL,
  channel TEXT NOT NULL,
  to_address TEXT,
  from_address TEXT,
  body TEXT,
  status TEXT NOT NULL,
  provider_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  caller_number TEXT,
  call_sid TEXT,
  dial_status TEXT,
  action_taken TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  lead_id INTEGER REFERENCES leads(id),
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  description TEXT,
  status TEXT DEFAULT 'scheduled',
  completed_at TEXT,
  review_requested_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function genApiKey() {
  return require('node:crypto').randomBytes(16).toString('hex');
}

module.exports = { db, genApiKey };
