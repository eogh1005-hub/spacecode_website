CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'password',
  provider_id TEXT,
  photo_url TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS users_provider_identity ON users(provider, provider_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlements (
  user_id TEXT NOT NULL,
  product TEXT NOT NULL,
  status TEXT NOT NULL,
  until TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product)
);

CREATE TABLE IF NOT EXISTS auth_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  email TEXT,
  event TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interest_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '출시 예정',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interest_hearts (
  item_id TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (item_id, visitor_key)
);

CREATE TABLE IF NOT EXISTS interest_alerts (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  email TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  utm_source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (item_id, email)
);

CREATE TABLE IF NOT EXISTS interest_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  visitor_key TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
