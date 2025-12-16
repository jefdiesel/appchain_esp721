-- Chainhost Database Schema
-- Run this in Supabase SQL Editor

-- Users table (synced from Clerk)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  wallet_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites table
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  template TEXT, -- template name or null for custom
  html_content TEXT, -- the actual HTML
  html_minified TEXT, -- minified version for inscription
  inscription_tx TEXT, -- ethereum tx hash of inscribed content
  manifest_tx TEXT, -- tx hash of manifest update
  sw_content TEXT, -- generated service worker
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'inscribed', 'live')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Domains table
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  domain TEXT NOT NULL, -- just the name part (e.g., "mysite")
  tld TEXT NOT NULL, -- e.g., "com", "xyz"
  full_domain TEXT GENERATED ALWAYS AS (domain || '.' || tld) STORED,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'active', 'expired', 'failed')),
  dynadot_order_id TEXT,
  cloudflare_zone_id TEXT,
  cloudflare_nameservers TEXT[], -- assigned CF nameservers
  pages_project_name TEXT, -- CF Pages project name
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, tld)
);

-- Payments/Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  type TEXT NOT NULL CHECK (type IN ('registration', 'renewal')),
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inscriptions log
CREATE TABLE inscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('content', 'manifest', 'asset')),
  content_size_bytes INTEGER,
  gas_used INTEGER,
  cost_eth DECIMAL(18, 8),
  cost_usd DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  html_content TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO templates (name, description, html_content, category) VALUES
('minimal', 'Clean single-page portfolio', '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{SITE_NAME}}</title><style>:root{--bg:#000;--text:#888;--accent:#C3FF00}*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{max-width:600px;padding:40px;text-align:center}h1{color:#fff;font-size:2.5rem;margin-bottom:1rem}p{line-height:1.6;margin-bottom:1.5rem}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.links{display:flex;gap:20px;justify-content:center;flex-wrap:wrap}.links a{padding:12px 24px;border:1px solid #222;border-radius:8px}.links a:hover{border-color:var(--accent)}</style></head><body><div class="container"><h1>{{SITE_NAME}}</h1><p>{{TAGLINE}}</p><div class="links"><a href="{{LINK_1_URL}}">{{LINK_1_TEXT}}</a><a href="{{LINK_2_URL}}">{{LINK_2_TEXT}}</a></div></div></body></html>', 'portfolio'),

('links', 'Link-in-bio style page', '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{SITE_NAME}}</title><style>:root{--bg:#000;--card:#111;--border:#222;--text:#888;--accent:#C3FF00}*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;min-height:100vh;padding:40px 20px}.container{max-width:400px;margin:0 auto;text-align:center}.avatar{width:80px;height:80px;border-radius:50%;background:var(--card);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:2rem;border:2px solid var(--border)}h1{color:#fff;font-size:1.5rem;margin-bottom:8px}p{margin-bottom:24px}.links{display:flex;flex-direction:column;gap:12px}.link{display:block;padding:16px;background:var(--card);border:1px solid var(--border);border-radius:12px;color:#fff;text-decoration:none;transition:all .2s}.link:hover{border-color:var(--accent);transform:translateY(-2px)}</style></head><body><div class="container"><div class="avatar">{{AVATAR}}</div><h1>{{SITE_NAME}}</h1><p>{{TAGLINE}}</p><div class="links"><a href="{{LINK_1_URL}}" class="link">{{LINK_1_TEXT}}</a><a href="{{LINK_2_URL}}" class="link">{{LINK_2_TEXT}}</a><a href="{{LINK_3_URL}}" class="link">{{LINK_3_TEXT}}</a></div></div></body></html>', 'links'),

('blog', 'Simple blog/article page', '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{TITLE}} - {{SITE_NAME}}</title><style>:root{--bg:#000;--text:#aaa;--accent:#C3FF00}*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:Georgia,serif;line-height:1.8;padding:60px 20px}article{max-width:650px;margin:0 auto}h1{color:#fff;font-size:2rem;margin-bottom:16px;font-weight:normal}time{color:#555;font-size:.9rem}hr{border:none;border-top:1px solid #222;margin:32px 0}p{margin-bottom:1.5rem}a{color:var(--accent)}</style></head><body><article><h1>{{TITLE}}</h1><time>{{DATE}}</time><hr><p>{{CONTENT}}</p></article></body></html>', 'blog');

-- Indexes
CREATE INDEX idx_sites_user ON sites(user_id);
CREATE INDEX idx_sites_status ON sites(status);
CREATE INDEX idx_domains_user ON domains(user_id);
CREATE INDEX idx_domains_status ON domains(status);
CREATE INDEX idx_domains_expires ON domains(expires_at);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_inscriptions_site ON inscriptions(site_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER domains_updated_at BEFORE UPDATE ON domains FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_own ON users FOR ALL USING (clerk_id = current_setting('app.clerk_id', true));
CREATE POLICY sites_own ON sites FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', true)));
CREATE POLICY domains_own ON domains FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', true)));
CREATE POLICY orders_own ON orders FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', true)));
CREATE POLICY inscriptions_own ON inscriptions FOR ALL USING (site_id IN (SELECT id FROM sites WHERE user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', true))));

-- Templates are public read
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_read ON templates FOR SELECT USING (is_active = true);
