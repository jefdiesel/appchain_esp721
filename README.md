# Chainhost

Host websites permanently on Ethereum calldata.

## Overview

Chainhost is a platform for building and hosting websites directly on the Ethereum blockchain. Sites are inscribed as calldata and served via service workers - no traditional hosting required.

## Features

- **Template-based site builder** - Choose from templates or paste custom HTML
- **Domain registration** - Register domains via Dynadot API
- **Automatic DNS/SSL** - Cloudflare Pages integration for seamless setup
- **Inscription helper** - Converts HTML to calldata, estimates gas
- **Permanent hosting** - Content lives forever on Ethereum

## Project Structure

```
chainhost/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page with hero, features, pricing
│   │   ├── layout.tsx            # Root layout with Clerk provider
│   │   ├── dashboard/
│   │   │   └── page.tsx          # User dashboard (sites, domains, stats)
│   │   ├── builder/
│   │   │   └── page.tsx          # 4-step site builder wizard
│   │   ├── sign-in/[[...sign-in]]/
│   │   │   └── page.tsx          # Clerk sign-in
│   │   ├── sign-up/[[...sign-up]]/
│   │   │   └── page.tsx          # Clerk sign-up
│   │   └── api/
│   │       ├── domains/
│   │       │   ├── search/route.ts    # Domain availability check
│   │       │   └── register/route.ts  # Stripe checkout -> registration
│   │       ├── sites/
│   │       │   ├── route.ts           # List/create sites
│   │       │   └── [id]/
│   │       │       ├── route.ts       # Get/update/delete site
│   │       │       └── calldata/route.ts  # Generate inscription calldata
│   │       └── webhooks/
│   │           └── stripe/route.ts    # Payment processing
│   ├── lib/
│   │   ├── supabase.ts           # DB client + TypeScript types
│   │   ├── stripe.ts             # Checkout sessions, pricing config
│   │   ├── dynadot.ts            # Domain registration, nameservers
│   │   ├── cloudflare.ts         # DNS zones, Pages deployment
│   │   └── inscription.ts        # HTML->calldata, gas estimation, SW generation
│   └── middleware.ts             # Clerk auth route protection
├── supabase-schema.sql           # Full database schema
├── .env.local.example            # Required environment variables
└── README.md
```

## Tech Stack

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| **Next.js 15** | React framework | - |
| **Clerk** | Authentication | 10,000 MAUs |
| **Supabase** | PostgreSQL database | 500MB, 50k MAUs |
| **Stripe** | Payment processing | Pay per transaction |
| **Dynadot** | Domain registration | Pre-fund account |
| **Cloudflare** | DNS, Pages, CDN | Unlimited |

## User Flow

```
1. Sign Up (Clerk)
       ↓
2. Choose Template or Paste HTML
       ↓
3. Customize Content
       ↓
4. Search/Register Domain (optional)
       ↓
   [Stripe Checkout]
       ↓
   [Webhook: Dynadot register -> CF zone -> CF Pages]
       ↓
5. Generate Calldata
       ↓
6. User Inscribes via Wallet
       ↓
7. Save TX Hash -> Site Goes Live
```

## Database Schema

**Tables:**
- `users` - Clerk ID, email, Stripe customer ID, wallet address
- `sites` - Name, slug, template, HTML content, inscription TX, status
- `domains` - Domain, TLD, status, Dynadot order, CF zone ID, expiration
- `orders` - Stripe session, payment type, amount, status
- `inscriptions` - TX hash, type, size, gas, cost
- `templates` - Pre-built site templates

## Setup

### 1. Clone and install

```bash
git clone https://github.com/yourusername/chainhost.git
cd chainhost
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

### 3. Set up Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run the contents of `supabase-schema.sql`
4. Copy keys from Settings -> API to `.env.local`

### 4. Set up Clerk

1. Create app at [clerk.com](https://clerk.com)
2. Copy Publishable Key and Secret Key to `.env.local`
3. Configure sign-in methods (email, Google, etc.)

### 5. Set up Stripe

1. Get API keys from [stripe.com](https://stripe.com)
2. Create webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Subscribe to `checkout.session.completed` event
4. Copy webhook secret to `.env.local`

### 6. Set up Dynadot

1. Create account at [dynadot.com](https://dynadot.com)
2. Fund account balance for domain purchases
3. Get API key from Account -> API
4. Add to `.env.local`

### 7. Set up Cloudflare

1. Create account at [cloudflare.com](https://cloudflare.com)
2. Get Account ID from dashboard URL
3. Create API token with Zone and Pages permissions
4. Add to `.env.local`

### 8. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

```bash
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Dynadot
DYNADOT_API_KEY=xxx

# Cloudflare
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## API Reference

### Domains

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/domains/search?domain=xxx` | GET | Check availability across TLDs |
| `/api/domains/register` | POST | Start Stripe checkout for domain |

### Sites

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sites` | GET | List user's sites |
| `/api/sites` | POST | Create new site |
| `/api/sites/[id]` | GET | Get site details |
| `/api/sites/[id]` | PATCH | Update site (content, TX hash) |
| `/api/sites/[id]` | DELETE | Delete site |
| `/api/sites/[id]/calldata` | GET | Generate inscription calldata |

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/stripe` | POST | Handle payment events |

## Domain Pricing

| TLD | Registration | Renewal | Our Cost |
|-----|--------------|---------|----------|
| .com | $14.99 | $14.99 | $9.99 |
| .xyz | $9.99 | $12.99 | $2.99 |
| .net | $14.99 | $14.99 | $10.99 |
| .org | $14.99 | $14.99 | $10.99 |
| .io | $49.99 | $49.99 | $34.99 |

## How Inscription Works

1. **Minify HTML** - Remove whitespace, compress
2. **Encode Base64** - `btoa(html)`
3. **Create Data URI** - `data:text/html;base64,{base64}`
4. **Convert to Hex** - Each character to hex bytes
5. **Send Transaction** - Calldata = hex, to = self, value = 0
6. **Service Worker** - Fetches TX, decodes, serves HTML

Gas estimate: ~16 gas per byte + 21000 base = ~$0.30 for 10KB page

## Key Files

### `src/lib/inscription.ts`

```typescript
// Convert HTML to calldata
htmlToCalldata(html: string): string

// Estimate gas cost
estimateGas(html: string): { bytes, gasUnits, estimatedCostUsd }

// Generate service worker for a site
generateServiceWorker(wallet: string, routes: Record<string, string>): string

// Validate HTML for inscription (check problematic chars)
validateForInscription(html: string): { valid: boolean, issues: string[] }
```

### `src/lib/dynadot.ts`

```typescript
// Check if domain is available
checkDomainAvailability(domain: string): Promise<{ available, price }>

// Register domain (requires funded account)
registerDomain(domain: string, years: number): Promise<{ success, expiration }>

// Point domain to Cloudflare
setNameservers(domain: string, nameservers: string[]): Promise<boolean>
```

### `src/lib/cloudflare.ts`

```typescript
// Add domain to Cloudflare
addZone(domain: string): Promise<{ zoneId, nameservers }>

// Create Pages project for hosting
createPagesProject(name: string): Promise<{ projectName, subdomain }>

// Connect custom domain to Pages
addCustomDomain(project: string, domain: string): Promise<{ success }>

// Deploy files to Pages
deployToPages(project: string, files: Record<string, string>): Promise<{ url }>
```

## Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Set environment variables in Vercel dashboard.

### Cloudflare Pages

1. Connect GitHub repo
2. Build command: `npm run build`
3. Output directory: `.next`
4. Set environment variables

## License

MIT
