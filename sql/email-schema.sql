-- Chainhost Email Schema
-- D1 Database for email metadata and user data

-- Email addresses mapped to chainhost names
CREATE TABLE IF NOT EXISTS email_addresses (
  id TEXT PRIMARY KEY,
  chainhost_name TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  custom_domain TEXT,
  encryption_public_key TEXT,  -- For encrypting incoming emails (base64)
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_name ON email_addresses(chainhost_name);
CREATE INDEX IF NOT EXISTS idx_email_owner ON email_addresses(owner_address);

-- Emails (metadata only, body stored in R2)
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL REFERENCES email_addresses(id),
  thread_id TEXT,
  message_id TEXT,
  in_reply_to TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT NOT NULL,
  cc_addresses TEXT,
  bcc_addresses TEXT,
  subaddress_tag TEXT,
  subject TEXT,
  snippet TEXT,
  r2_key TEXT NOT NULL,
  has_attachments INTEGER DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,
  is_read INTEGER DEFAULT 0,
  is_starred INTEGER DEFAULT 0,
  is_spam INTEGER DEFAULT 0,
  is_trash INTEGER DEFAULT 0,
  is_draft INTEGER DEFAULT 0,
  is_encrypted INTEGER DEFAULT 0,  -- Body is encrypted in R2
  folder TEXT DEFAULT 'inbox',
  received_at INTEGER,
  sent_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_emails_address_folder ON emails(address_id, folder, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);

-- Email threads (for grouping conversations)
CREATE TABLE IF NOT EXISTS email_threads (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL REFERENCES email_addresses(id),
  subject TEXT,
  participants TEXT,
  last_message_at INTEGER,
  message_count INTEGER DEFAULT 1,
  unread_count INTEGER DEFAULT 0,
  is_starred INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_threads_address ON email_threads(address_id, last_message_at DESC);

-- Contacts (auto-collected from emails)
CREATE TABLE IF NOT EXISTS email_contacts (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL REFERENCES email_addresses(id),
  email TEXT NOT NULL,
  name TEXT,
  last_contacted_at INTEGER,
  contact_count INTEGER DEFAULT 1,
  is_favorite INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique ON email_contacts(address_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_address ON email_contacts(address_id, last_contacted_at DESC);

-- API Keys for programmatic access
CREATE TABLE IF NOT EXISTS email_api_keys (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL REFERENCES email_addresses(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions TEXT DEFAULT 'send',
  rate_limit INTEGER DEFAULT 100,
  allowed_domains TEXT,
  last_used_at INTEGER,
  use_count INTEGER DEFAULT 0,
  revoked_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_api_keys_address ON email_api_keys(address_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON email_api_keys(key_prefix);

-- Verified custom domains
CREATE TABLE IF NOT EXISTS email_domains (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL REFERENCES email_addresses(id),
  domain TEXT NOT NULL,
  verified INTEGER DEFAULT 0,
  verification_token TEXT,
  verification_method TEXT DEFAULT 'dns',
  verified_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_unique ON email_domains(address_id, domain);

-- Audit logs
CREATE TABLE IF NOT EXISTS email_audit_logs (
  id TEXT PRIMARY KEY,
  address_id TEXT REFERENCES email_addresses(id),
  api_key_id TEXT REFERENCES email_api_keys(id),
  action TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  metadata TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_audit_address ON email_audit_logs(address_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON email_audit_logs(action, created_at DESC);

-- Rate limiting (sliding window)
CREATE TABLE IF NOT EXISTS email_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  window_start INTEGER,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Email attachments metadata
CREATE TABLE IF NOT EXISTS email_attachments (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL REFERENCES emails(id),
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  r2_key TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_attachments_email ON email_attachments(email_id);

-- Email labels/tags (user-defined)
CREATE TABLE IF NOT EXISTS email_labels (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL REFERENCES email_addresses(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#888888',
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_labels_unique ON email_labels(address_id, name);

-- Email-to-label mapping
CREATE TABLE IF NOT EXISTS email_label_map (
  email_id TEXT NOT NULL REFERENCES emails(id),
  label_id TEXT NOT NULL REFERENCES email_labels(id),
  PRIMARY KEY (email_id, label_id)
);

-- Webhook configurations for new email notifications
CREATE TABLE IF NOT EXISTS email_webhooks (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL REFERENCES email_addresses(id),
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT DEFAULT 'email.received',
  is_active INTEGER DEFAULT 1,
  last_triggered_at INTEGER,
  failure_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_webhooks_address ON email_webhooks(address_id);
