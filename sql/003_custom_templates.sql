-- Custom templates table for paid users
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'custom',
  version TEXT DEFAULT '1.0',
  css TEXT,
  html TEXT NOT NULL,
  fields TEXT[] DEFAULT '{}',
  tx_hash TEXT, -- Set after template is inscribed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_custom_templates_clerk_id ON custom_templates(clerk_id);
CREATE INDEX IF NOT EXISTS idx_custom_templates_tx_hash ON custom_templates(tx_hash);

-- Enable RLS
ALTER TABLE custom_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see their own templates
CREATE POLICY "Users can view own templates" ON custom_templates
  FOR SELECT USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own templates" ON custom_templates
  FOR INSERT WITH CHECK (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own templates" ON custom_templates
  FOR UPDATE USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access" ON custom_templates
  FOR ALL USING (auth.role() = 'service_role');
