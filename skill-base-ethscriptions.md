# Base Ethscriptions Skill

Build and operate the first ethscriptions indexer for Base L2.

## Protocol Rules

```
CREATION:  tx.from === tx.to && calldata.startsWith("data:,")
           → id = sha256(calldata), owner = tx.from

TRANSFER:  tx.from !== tx.to && calldata === ethscription_id
           → owner = tx.to (if tx.from was previous owner)
```

## Quick Commands

### Check if name is available on Base
```javascript
const crypto = require('crypto');
const name = 'hello';
const hash = '0x' + crypto.createHash('sha256').update(`data:,${name}`).digest('hex');
// Query: SELECT * FROM base_ethscriptions WHERE id = $1
```

### Register a name on Base
```javascript
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const content = `data:,${name}`;
const data = ethers.hexlify(ethers.toUtf8Bytes(content));

await wallet.sendTransaction({
  to: wallet.address,  // self-transfer
  data: data,
  value: 0,
});
```

### Run the indexer
```bash
# Start from last indexed block
node scripts/base-indexer.js

# Backfill from genesis
node scripts/base-backfill.js --from 0 --to latest
```

## Database (Supabase)

### Tables
- `base_ethscriptions` - All ethscriptions (id, content_uri, creator, current_owner, creation_tx, creation_block)
- `base_transfers` - Transfer history (ethscription_id, from, to, tx_hash, block)
- `indexer_state` - Track last indexed block

### Key Queries
```sql
-- Check if name exists
SELECT * FROM base_ethscriptions
WHERE id = '0x' || encode(sha256('data:,' || $name), 'hex');

-- Get owned names
SELECT * FROM base_ethscriptions WHERE current_owner = $address;

-- Get recent inscriptions
SELECT * FROM base_ethscriptions ORDER BY creation_block DESC LIMIT 100;
```

## API Endpoints

```
GET /v1/exists/:hash        → { exists, ethscription? }
GET /v1/check/:name         → { available, owner? }
GET /v1/ethscription/:hash  → full ethscription data
GET /v1/owned/:address      → array of owned ethscriptions
GET /v1/stats               → { total, latest_block }
```

## Frontend Routes

```
/base/register   → Claim names on Base
/base/explore    → Browse all Base ethscriptions
/base/[name]     → View specific ethscription
```

## ChainHost Integration

Cloudflare worker routing for `*.base.chainhost.online`:

```javascript
// In subdomain-router.js
if (hostname.endsWith('.base.chainhost.online')) {
  const name = hostname.split('.')[0];
  // Check Base ethscriptions API instead of Ethereum
  const res = await fetch(`https://api.baseethscriptions.com/v1/check/${name}`);
  // ... serve content
}
```

## Base Chain Info

- Chain ID: 8453
- RPC: https://mainnet.base.org
- Block Explorer: https://basescan.org
- Gas: ~$0.001 per inscription

## File Locations

```
scripts/base-indexer.js      # Main indexer loop
scripts/base-backfill.js     # Historical sync
scripts/base-register.js     # Batch registration
src/app/base/register/       # Register UI
src/app/base/explore/        # Explorer UI
src/lib/base-ethscriptions.ts # API client
```

## Priority Names to Register

### Single characters (36)
a-z, 0-9

### Two-letter (1,296)
aa, ab, ac, ... zz, 00, 01, ... 99

### Valuable words
bitcoin, ethereum, base, coinbase, wallet, nft, defi, crypto, web3, dao, degen, gm, wagmi, ngmi, fren, ser, anon, ape, moon, hodl, rekt

### Chinese premium
Same list as Ethereum scanner - valuable single chars

## Environment Variables

```bash
BASE_RPC_URL=https://mainnet.base.org
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
PRIVATE_KEY=0x...  # For registration only
```
