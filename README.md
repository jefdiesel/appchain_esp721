# Chainhost

Host websites permanently on Ethereum. No servers, no subscriptions, forever yours.

## How It Works

Chainhost uses Ethereum calldata to store websites permanently on-chain. Your site lives as long as Ethereum exists.

```
1. Claim a name     →  Inscribe "data:,yourname" on Ethereum
2. Upload HTML      →  Inscribe your HTML as calldata (Ethereum or Base)
3. Create manifest  →  Link your routes to content with JSON
4. Go live          →  yourname.chainhost.online serves your site
```

### The Stack

| Layer | What | Where |
|-------|------|-------|
| **Name** | `data:,yourname` | Ethscription on Ethereum |
| **Content** | `data:text/html;base64,...` | Calldata on Ethereum or Base |
| **Manifest** | `{"chainhost":{"home":"0x..."}}` | JSON ethscription |
| **Gateway** | Cloudflare Worker | Reads chain, serves HTML |

### Name Ownership

Names are claimed via [Ethscriptions](https://ethscriptions.com). First to inscribe `data:,name` owns it forever.

```
data:,degenjef  →  SHA256  →  0x...  →  Lookup on Ethscriptions API
```

The owner of that ethscription controls what content appears at `name.chainhost.online`.

### Content Storage

HTML is stored as base64-encoded calldata:

```
data:text/html;base64,PCFET0NUWVBFIGh0bWw+...
```

You can inscribe on:
- **Ethereum** - Most permanent, ~$0.50-2 for small pages
- **Base** - Cheaper, a few cents, still permanent

### Manifest Format

A JSON ethscription linking routes to content:

```json
{
  "chainhost": {
    "home": "0x1234...abc",
    "about": "0x5678...def"
  }
}
```

The worker finds your latest manifest and serves the linked content.

## Name Portability

**Your name works on ANY gateway, not just chainhost.online.**

If someone else deploys the worker on `otherdomain.com`:
- `yourname.otherdomain.com` → same content as `yourname.chainhost.online`

The domain is just the gateway. Your name ownership and content are on-chain and work with any resolver running the open-source worker.

This means:
- You're not locked to chainhost.online
- Anyone can run a gateway
- Your site survives if any single gateway goes down
- True decentralization

## Self-Hosting

If chainhost.online ever disappears, recover your site in 4 steps:

### 1. Clone the repo

```bash
git clone https://github.com/jefdiesel/chainhost
```

### 2. Create a Cloudflare account

Free tier includes:
- 100 workers
- 100,000 requests/day
- No credit card required

### 3. Deploy the worker

```bash
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler deploy
```

### 4. Add your domain

In Cloudflare dashboard:
1. Add your domain to Cloudflare
2. Create a worker route: `*.yourdomain.com/*` → `chainhost-subdomain-router`

Now `anyname.yourdomain.com` resolves on-chain names.

## Project Structure

```
chainhost/
├── cloudflare-worker/
│   ├── subdomain-router.js   # The resolver - reads chain, serves sites
│   └── wrangler.toml         # Cloudflare config
├── src/
│   ├── app/
│   │   ├── page.tsx          # Landing page
│   │   ├── register/         # Name claiming UI
│   │   ├── upload/           # Content upload UI
│   │   └── builder/          # Template builder
│   └── lib/
│       ├── wallet.ts         # Wallet connection
│       └── templates.ts      # HTML templates
└── public/
    └── favicon.png
```

## Tech Stack

| Component | Purpose |
|-----------|---------|
| **Next.js** | Web app at chainhost.online |
| **Cloudflare Worker** | Subdomain routing (*.chainhost.online) |
| **Ethscriptions API** | Name ownership lookup |
| **Ethereum/Base RPC** | Fetch calldata content |
| **Wagmi/Viem** | Wallet connection |

No database. No auth. Everything reads from the blockchain.

## Routes

Each chainhost site has these routes:

| Route | Description |
|-------|-------------|
| `/` | Home page (from manifest "home") |
| `/about` | About page (from manifest "about") |
| `/previous` | History of all chainhost content |
| `/recovery` | Self-hosting instructions |

## Costs

| Action | Chain | Cost |
|--------|-------|------|
| Claim name | Ethereum | ~$0.01 (just "data:,name") |
| Upload HTML | Ethereum | ~$0.50-2 (depends on size) |
| Upload HTML | Base | ~$0.01-0.05 |
| Create manifest | Ethereum | ~$0.10 |

All costs are just gas fees. No platform fees, ever.

## Local Development

```bash
# Install dependencies
npm install

# Run Next.js app
npm run dev

# Deploy worker (requires wrangler login)
cd cloudflare-worker
npx wrangler deploy
```

## How the Worker Resolves Sites

```javascript
// 1. Extract name from subdomain
const name = hostname.split('.')[0];  // "degenjef" from "degenjef.chainhost.online"

// 2. Check if name is claimed
const nameSha = sha256(`data:,${name}`);
const nameData = await fetch(`ethscriptions.com/exists/${nameSha}`);
const owner = nameData.current_owner;

// 3. Find owner's chainhost manifest
const manifests = await fetch(`ethscriptions.com?owner=${owner}&type=json`);
const manifest = manifests.find(m => m.chainhost);

// 4. Get content for route
const txHash = manifest.chainhost[route];  // "home", "about", etc.

// 5. Fetch HTML from calldata
const tx = await rpc.getTransaction(txHash);
const html = decodeCalldata(tx.input);

// 6. Serve it
return new Response(html, { headers: { 'Content-Type': 'text/html' } });
```

## FAQ

**Q: What if Ethscriptions API goes down?**
A: The worker falls back to direct RPC calls to Ethereum and Base nodes.

**Q: Can I use my own domain?**
A: Yes! Deploy the worker and point your domain to it. Names work on any gateway.

**Q: How big can my site be?**
A: Technically unlimited, but gas costs scale with size. Keep it under 50KB for reasonable costs.

**Q: Can I update my site?**
A: Yes. Inscribe new content, then inscribe a new manifest pointing to it. The worker always uses your latest manifest.

**Q: What about images/CSS/JS?**
A: Inline everything into a single HTML file, or host assets elsewhere and reference them.

## Links

- **Live**: [chainhost.online](https://chainhost.online)
- **Example**: [degenjef.chainhost.online](https://degenjef.chainhost.online)
- **Ethscriptions**: [ethscriptions.com](https://ethscriptions.com)

## License

MIT - Do whatever you want with it.
