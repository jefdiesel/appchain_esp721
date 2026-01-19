# Base Ethscriptions - Implementation Plan

## Overview

Build the first ethscriptions indexer for Base L2. Same protocol as Ethereum ethscriptions but on Base - drastically cheaper gas (~$0.001) and unclaimed namespace.

## Protocol Rules (same as Ethereum)

1. Valid ethscription = self-transfer (`to === from`) with `data:,` prefixed UTF-8 calldata
2. Content hash = SHA256 of calldata (e.g., `sha256("data:,hello")`)
3. First valid inscription of a content hash = creation, creator is owner
4. Transfer = send tx TO another address with the content hash as calldata
5. No smart contracts needed - pure calldata

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Base Chain    │────▶│    Indexer      │────▶│   PostgreSQL    │
│   (RPC/WS)      │     │   (Node.js)     │     │   (Supabase)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                        ┌─────────────────┐             │
                        │   API Server    │◀────────────┘
                        │   (Hono/CF)     │
                        └─────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Register UI   │     │   Explorer      │     │   ChainHost     │
│   (Next.js)     │     │   (Next.js)     │     │   Integration   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Phase 1: Indexer Core

### 1.1 Database Schema (Supabase)

```sql
-- Ethscriptions table
CREATE TABLE base_ethscriptions (
  id TEXT PRIMARY KEY,                    -- sha256 hash (0x...)
  content_uri TEXT NOT NULL,              -- raw content (data:,hello)
  content_type TEXT DEFAULT 'text/plain', -- mime type
  creator TEXT NOT NULL,                  -- address
  current_owner TEXT NOT NULL,            -- address
  creation_tx TEXT NOT NULL,              -- tx hash
  creation_block BIGINT NOT NULL,
  creation_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transfers table
CREATE TABLE base_transfers (
  id SERIAL PRIMARY KEY,
  ethscription_id TEXT REFERENCES base_ethscriptions(id),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexer state
CREATE TABLE indexer_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ethscriptions_owner ON base_ethscriptions(current_owner);
CREATE INDEX idx_ethscriptions_creator ON base_ethscriptions(creator);
CREATE INDEX idx_ethscriptions_block ON base_ethscriptions(creation_block);
CREATE INDEX idx_transfers_ethscription ON base_transfers(ethscription_id);
CREATE INDEX idx_transfers_from ON base_transfers(from_address);
CREATE INDEX idx_transfers_to ON base_transfers(to_address);
```

### 1.2 Indexer Script

Location: `scripts/base-indexer.js`

```javascript
// Pseudocode structure
async function indexBlock(blockNumber) {
  const block = await provider.getBlock(blockNumber, true);

  for (const tx of block.transactions) {
    // Skip if not self-transfer
    if (tx.from.toLowerCase() !== tx.to?.toLowerCase()) continue;

    // Skip if no calldata
    if (!tx.data || tx.data === '0x') continue;

    // Decode calldata to UTF-8
    const content = hexToUtf8(tx.data);
    if (!content) continue;

    // Check if valid ethscription format
    if (!content.startsWith('data:,')) continue;

    // Compute content hash
    const hash = '0x' + sha256(content);

    // Check if already exists
    const exists = await db.query('SELECT id FROM base_ethscriptions WHERE id = $1', [hash]);

    if (!exists.rows.length) {
      // New ethscription!
      await db.query(`
        INSERT INTO base_ethscriptions (id, content_uri, creator, current_owner, creation_tx, creation_block, creation_timestamp)
        VALUES ($1, $2, $3, $3, $4, $5, $6)
      `, [hash, content, tx.from.toLowerCase(), tx.hash, blockNumber, block.timestamp]);
    }
  }
}

async function processTransfers(blockNumber) {
  const block = await provider.getBlock(blockNumber, true);

  for (const tx of block.transactions) {
    // Transfer = sending TO someone else with ethscription hash as data
    if (tx.from.toLowerCase() === tx.to?.toLowerCase()) continue;
    if (!tx.data || tx.data.length !== 66) continue; // 0x + 64 hex chars = sha256

    const hash = tx.data.toLowerCase();

    // Check if this hash is a valid ethscription owned by sender
    const ethscription = await db.query(
      'SELECT id FROM base_ethscriptions WHERE id = $1 AND current_owner = $2',
      [hash, tx.from.toLowerCase()]
    );

    if (ethscription.rows.length) {
      // Valid transfer!
      await db.query('UPDATE base_ethscriptions SET current_owner = $1 WHERE id = $2',
        [tx.to.toLowerCase(), hash]);

      await db.query(`
        INSERT INTO base_transfers (ethscription_id, from_address, to_address, tx_hash, block_number, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [hash, tx.from.toLowerCase(), tx.to.toLowerCase(), tx.hash, blockNumber, block.timestamp]);
    }
  }
}
```

### 1.3 Historical Backfill

- Base mainnet launched: Block 0 (June 2023)
- Current block: ~25M+
- Strategy: Batch process 1000 blocks at a time
- Estimated time: Few hours with parallel processing

## Phase 2: API

### 2.1 Endpoints (Cloudflare Worker or Hono)

```
GET /v1/ethscriptions/exists/:hash
  → { exists: boolean, ethscription?: {...} }

GET /v1/ethscriptions/:hash
  → { id, content_uri, creator, current_owner, creation_tx, ... }

GET /v1/ethscriptions/check/:content
  → Compute hash of "data:,{content}" and check existence

GET /v1/ethscriptions/owned/:address
  → [{ id, content_uri, ... }, ...]

GET /v1/ethscriptions/created/:address
  → [{ id, content_uri, ... }, ...]

GET /v1/names/:name
  → Check if "data:,{name}" exists, return owner

GET /v1/stats
  → { total_ethscriptions, total_transfers, latest_block }
```

### 2.2 API Location

Option A: Cloudflare Worker connecting to Supabase
Option B: Vercel Edge Function
Option C: Self-hosted on same server as indexer

## Phase 3: Frontend Integration

### 3.1 Register Page (`/base/register`)

- Same UI as Ethereum register page
- Connect to Base network (chainId: 8453)
- Show gas estimate (~$0.001)
- Link to explorer after claiming

### 3.2 Explorer (`/base/explore`)

- Browse all Base ethscriptions
- Search by name, owner, creator
- View transfer history

### 3.3 ChainHost Integration

- Support `*.base.chainhost.online` subdomains
- Cloudflare worker checks Base ethscriptions API
- Same hosting flow but for Base names

## Phase 4: Launch Strategy

### 4.1 Pre-Launch (Before Announcing)

1. Register valuable names yourself:
   - Single letters: a-z, 0-9
   - Two-letter combos: aa, ab, ... (1,296 total)
   - Common words: bitcoin, ethereum, base, coinbase, etc.
   - Valuable Chinese chars
   - Premium symbols

2. Get indexer fully synced from genesis

### 4.2 Launch

1. Announce Base ethscriptions protocol
2. Open source the indexer
3. Launch explorer + register UI
4. Integrate with ChainHost

## File Structure

```
chainhost/
├── scripts/
│   ├── base-indexer.js        # Main indexer
│   ├── base-backfill.js       # Historical sync
│   └── base-register.js       # Batch registration script
├── src/
│   ├── app/
│   │   ├── base/
│   │   │   ├── register/page.tsx
│   │   │   ├── explore/page.tsx
│   │   │   └── [name]/page.tsx
│   └── lib/
│       └── base-ethscriptions.ts
├── cloudflare-worker/
│   └── subdomain-router.js    # Add Base support
└── supabase/
    └── migrations/
        └── 001_base_ethscriptions.sql
```

## Tech Stack

- **Indexer**: Node.js + ethers.js
- **Database**: Supabase (PostgreSQL)
- **API**: Cloudflare Workers or Hono
- **Frontend**: Next.js (existing ChainHost)
- **RPC**: Base public RPC or Alchemy/QuickNode

## Timeline

1. Database schema + indexer core: 2-3 hours
2. Historical backfill: Run overnight
3. API endpoints: 2 hours
4. Frontend pages: 3-4 hours
5. ChainHost integration: 1-2 hours
6. Testing + polish: 2-3 hours

**Total: ~1-2 days to MVP**

## Risk Considerations

1. **Competition**: Someone else could launch first
2. **Protocol differences**: May want to add Base-specific features
3. **RPC limits**: Need reliable Base RPC for indexing
4. **Storage**: Images/larger content could grow DB quickly

## Open Questions

1. Should transfers require the full content or just the hash?
2. Support images/binary content or text-only initially?
3. Separate subdomain (base.chainhost.online) or same namespace?
4. Charge for premium names or first-come-first-served only?
