-- Chainhost Marketplace Schema
-- Run this in Supabase SQL editor

-- Marketplace listings table
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ethscription_id TEXT NOT NULL UNIQUE,  -- 0x{sha256} of data:,{name}
  name TEXT NOT NULL,                     -- the actual name (lowercase)
  seller_address TEXT NOT NULL,           -- wallet address
  price_wei TEXT NOT NULL,                -- stored as string for bigint
  price_eth DECIMAL(18, 8) GENERATED ALWAYS AS (
    CAST(price_wei AS DECIMAL) / 1000000000000000000
  ) STORED,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  deposit_tx TEXT,                        -- tx hash that deposited to escrow
  chain TEXT NOT NULL DEFAULT 'eth' CHECK (chain IN ('eth', 'base')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Offers on listings
CREATE TABLE IF NOT EXISTS marketplace_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  ethscription_id TEXT NOT NULL,          -- for offers on unlisted items
  buyer_address TEXT NOT NULL,
  offer_wei TEXT NOT NULL,
  offer_eth DECIMAL(18, 8) GENERATED ALWAYS AS (
    CAST(offer_wei AS DECIMAL) / 1000000000000000000
  ) STORED,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  offer_tx TEXT,                          -- tx hash of offer (ETH sent to contract)
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Completed sales history
CREATE TABLE IF NOT EXISTS marketplace_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id),
  ethscription_id TEXT NOT NULL,
  name TEXT NOT NULL,
  seller_address TEXT NOT NULL,
  buyer_address TEXT NOT NULL,
  sale_price_wei TEXT NOT NULL,
  sale_price_eth DECIMAL(18, 8) GENERATED ALWAYS AS (
    CAST(sale_price_wei AS DECIMAL) / 1000000000000000000
  ) STORED,
  fee_wei TEXT,
  purchase_tx TEXT NOT NULL,              -- tx hash of purchase
  chain TEXT NOT NULL DEFAULT 'eth',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON marketplace_listings(seller_address);
CREATE INDEX IF NOT EXISTS idx_listings_name ON marketplace_listings(name);
CREATE INDEX IF NOT EXISTS idx_listings_price ON marketplace_listings(price_eth);
CREATE INDEX IF NOT EXISTS idx_listings_created ON marketplace_listings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offers_listing ON marketplace_offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_offers_buyer ON marketplace_offers(buyer_address);
CREATE INDEX IF NOT EXISTS idx_offers_status ON marketplace_offers(status);

CREATE INDEX IF NOT EXISTS idx_sales_seller ON marketplace_sales(seller_address);
CREATE INDEX IF NOT EXISTS idx_sales_buyer ON marketplace_sales(buyer_address);
CREATE INDEX IF NOT EXISTS idx_sales_created ON marketplace_sales(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sales ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read listings" ON marketplace_listings
  FOR SELECT USING (true);

CREATE POLICY "Public read offers" ON marketplace_offers
  FOR SELECT USING (true);

CREATE POLICY "Public read sales" ON marketplace_sales
  FOR SELECT USING (true);

-- Insert/update policies (via service role from API)
CREATE POLICY "Service insert listings" ON marketplace_listings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update listings" ON marketplace_listings
  FOR UPDATE USING (true);

CREATE POLICY "Service insert offers" ON marketplace_offers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update offers" ON marketplace_offers
  FOR UPDATE USING (true);

CREATE POLICY "Service insert sales" ON marketplace_sales
  FOR INSERT WITH CHECK (true);

-- Helper view for active listings with stats
CREATE OR REPLACE VIEW marketplace_active_listings AS
SELECT
  l.*,
  (SELECT COUNT(*) FROM marketplace_offers o WHERE o.listing_id = l.id AND o.status = 'pending') as offer_count,
  (SELECT MAX(offer_eth) FROM marketplace_offers o WHERE o.listing_id = l.id AND o.status = 'pending') as highest_offer
FROM marketplace_listings l
WHERE l.status = 'active'
ORDER BY l.created_at DESC;

-- Helper view for marketplace stats
CREATE OR REPLACE VIEW marketplace_stats AS
SELECT
  (SELECT COUNT(*) FROM marketplace_listings WHERE status = 'active') as active_listings,
  (SELECT COUNT(*) FROM marketplace_sales) as total_sales,
  (SELECT COALESCE(SUM(sale_price_eth), 0) FROM marketplace_sales) as total_volume_eth,
  (SELECT AVG(sale_price_eth) FROM marketplace_sales) as avg_sale_price_eth,
  (SELECT COUNT(DISTINCT seller_address) FROM marketplace_listings) as unique_sellers,
  (SELECT COUNT(DISTINCT buyer_address) FROM marketplace_sales) as unique_buyers;
