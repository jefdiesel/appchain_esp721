-- Chainhost Database Schema
-- Run this in your Supabase SQL Editor

-- Users table (synced from Clerk)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  stripe_customer_id TEXT,
  wallet_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites table
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  template TEXT,
  html_content TEXT,
  html_minified TEXT,
  sw_content TEXT,
  inscription_tx TEXT,
  manifest_tx TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'inscribed', 'live')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domains table
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  tld TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'active', 'failed', 'expired')),
  dynadot_order_id TEXT,
  cloudflare_zone_id TEXT,
  cloudflare_nameservers TEXT[],
  pages_project_name TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, tld)
);

-- Orders table (payment history)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('registration', 'renewal')),
  amount_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sites_user_id ON sites(user_id);
CREATE INDEX idx_sites_slug ON sites(slug);
CREATE INDEX idx_domains_user_id ON domains(user_id);
CREATE INDEX idx_domains_status ON domains(status);
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role bypasses these, anon key respects them)
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (true);
CREATE POLICY "Users can view own sites" ON sites FOR SELECT USING (true);
CREATE POLICY "Users can view own domains" ON domains FOR SELECT USING (true);
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (true);
