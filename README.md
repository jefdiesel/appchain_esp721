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

## Tech Stack

- **Next.js 15** - React framework
- **Clerk** - Authentication (10k free MAUs)
- **Supabase** - Database (free tier)
- **Stripe** - Payments
- **Dynadot** - Domain registration
- **Cloudflare** - DNS, Pages, CDN

## Setup

1. Clone and install:
```bash
git clone https://github.com/yourusername/chainhost.git
cd chainhost
npm install
```

2. Copy env file and fill in keys:
```bash
cp .env.local.example .env.local
```

3. Set up Supabase:
   - Create a new project at supabase.com
   - Run the SQL in `supabase-schema.sql`
   - Copy your keys to `.env.local`

4. Set up Clerk:
   - Create an app at clerk.com
   - Copy your keys to `.env.local`

5. Set up Stripe:
   - Get API keys from stripe.com
   - Set up webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`

6. Run dev server:
```bash
npm run dev
```

## Environment Variables

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Dynadot
DYNADOT_API_KEY=

# Cloudflare
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## API Routes

- `GET /api/domains/search?domain=xxx` - Search domain availability
- `POST /api/domains/register` - Start domain registration checkout
- `GET /api/sites` - List user's sites
- `POST /api/sites` - Create new site
- `GET /api/sites/[id]` - Get site details
- `PATCH /api/sites/[id]` - Update site
- `DELETE /api/sites/[id]` - Delete site
- `GET /api/sites/[id]/calldata` - Generate inscription calldata
- `POST /api/webhooks/stripe` - Stripe webhook handler

## How It Works

1. User builds site (template or custom HTML)
2. HTML is minified and encoded as base64 data URI
3. Data URI is converted to hex calldata
4. User sends transaction with calldata to themselves
5. Transaction hash is saved to site record
6. Service worker fetches and serves content from Ethereum

## License

MIT
