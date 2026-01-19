# Chainhost Setup Skill

Use this prompt to help set up a new chainhost mirror domain.

## What You Need

- A domain name (e.g., `yourdomain.com`)
- Cloudflare account (free tier works)
- Domain nameservers pointed to Cloudflare

## Setup Steps

### 1. Clone and Deploy Worker

```bash
git clone https://github.com/jefdiesel/chainhost
cd chainhost/cloudflare-worker
npx wrangler login
npx wrangler deploy
```

### 2. Add Routes to wrangler.toml

```toml
[[routes]]
pattern = "*.yourdomain.com/*"
zone_name = "yourdomain.com"

[[routes]]
pattern = "yourdomain.com/*"
zone_name = "yourdomain.com"
```

### 3. Update Worker Code

In `subdomain-router.js`, add domain detection:

```javascript
const isYourDomain = parts.length >= 3 && parts[parts.length - 2] === 'yourdomain';

if (!isChainhost && !isChost && !isYourDomain) {
  return new Response('Invalid hostname', { status: 400 });
}

const baseDomain = isYourDomain ? 'yourdomain.com' : (isChost ? 'chost.app' : 'chainhost.online');
```

Add landing page for root domain:

```javascript
if (hostname === 'yourdomain.com' || hostname === 'www.yourdomain.com') {
  // Serve from inscription or static HTML
  return new Response(YOUR_LANDING, {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

### 4. Configure DNS in Cloudflare

Add these records with Proxy ON (orange cloud):

| Type | Name | Content |
|------|------|---------|
| A | @ | 192.0.2.1 |
| A | * | 192.0.2.1 |

### 5. Deploy

```bash
npx wrangler deploy
```

## Serve Landing Page from Inscription

To serve your root domain from an on-chain inscription:

```javascript
if (hostname === 'yourdomain.com' || hostname === 'www.yourdomain.com') {
  const HOME_TX = '0x...your-inscription-tx-hash...';
  const content = await fetchTxContentRaw(HOME_TX);
  if (content?.decoded || content?.dataUri) {
    let html = content.decoded || content.dataUri;
    // Inject favicon and OG tags
    const tags = `
<link rel="icon" href="https://chainhost.online/favicon.png">
<meta property="og:title" content="Your Site Title">
<meta property="og:description" content="Your description">
`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', tags + '</head>');
    }
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
```

## Cache Clear Endpoint

After setup, clear cache for any name:

```
https://anyname.yourdomain.com/_clear?name=SITENAME&key=YOUR_CACHE_KEY
```

Set the key in wrangler.toml:

```toml
[vars]
CACHE_CLEAR_KEY = "your-secret-key"
```

## Current Mirrors

- chainhost.online (main)
- chost.app
- immutable.church
