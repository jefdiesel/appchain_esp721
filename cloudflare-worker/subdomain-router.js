/**
 * Cloudflare Worker: Chainhost Registry Router
 *
 * Routes:
 *   / or /home  → user's home page from manifest
 *   /about      → user's about page from manifest
 *   /previous   → auto-generated history page
 *   /recovery   → universal recovery page with git link
 *   /sw.js      → service worker
 *   /_og/:name.png → OG screenshot image
 */

import puppeteer from '@cloudflare/puppeteer';

const ETHSCRIPTIONS_API = 'https://api.ethscriptions.com/v2';
const BASE_RPC = 'https://mainnet.base.org';
const ETH_RPC = 'https://eth.llamarpc.com';
const BONDING_FACTORY = '0x72B23955FFeEb864589D94C0661D6BCcEB44e49d';
const SEPOLIA_RPC = 'https://rpc.sepolia.org';
const GIT_REPO = 'https://github.com/jefdiesel/chainhost';
const FAVICON = 'https://chainhost.online/favicon.png';

// Cache TTL in seconds (1 hour for manifests)
const MANIFEST_CACHE_TTL = 3600;

// RPC proxy configuration - ethscription names mapped to chain endpoints
const RPC_PROXY_MAP = {
  'mainnetrpc': {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcs: ['https://eth.llamarpc.com', 'https://eth.drpc.org', 'https://rpc.ankr.com/eth', 'https://ethereum-rpc.publicnode.com']
  },
  '137polygon': {
    chainId: 137,
    name: 'Polygon',
    rpcs: ['https://polygon-rpc.com', 'https://rpc-mainnet.matic.quiknode.pro']
  },
  '42161': {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcs: ['https://arbitrum.drpc.org', 'https://public-arb-mainnet.fastnode.io']
  },
  '8453base': {
    chainId: 8453,
    name: 'Base',
    rpcs: ['https://mainnet.base.org', 'https://base.drpc.org']
  },
  '11155111': {
    chainId: 11155111,
    name: 'Sepolia',
    rpcs: ['https://sepolia.drpc.org', 'https://0xrpc.io/sep']
  },
};

// chost.app landing page
const CHOST_LANDING = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>chost.app - Fork Your Own Mirror</title>
  <link rel="icon" href="${FAVICON}">
  <meta property="og:title" content="chost.app">
  <meta property="og:description" content="Fork your own on-chain hosting mirror">
  <meta property="og:url" content="https://chost.app">
  <meta property="og:site_name" content="ChainHost">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #e8e8e8;
      min-height: 100vh;
      line-height: 1.7;
    }
    .header {
      padding: 60px 20px;
      text-align: center;
      border-bottom: 1px solid #222;
    }
    .logo {
      width: 64px;
      height: 64px;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 2.5rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }
    h1 .highlight { color: #C3FF00; }
    .tagline {
      color: #888;
      font-size: 1.125rem;
    }
    main {
      max-width: 700px;
      margin: 0 auto;
      padding: 60px 20px;
    }
    h2 {
      color: #C3FF00;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 1rem;
      margin-top: 3rem;
    }
    h2:first-of-type { margin-top: 0; }
    p {
      margin-bottom: 1.5rem;
      color: #aaa;
    }
    .steps {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 1.5rem 0;
    }
    .step {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 12px;
      padding: 20px;
    }
    .num {
      width: 32px;
      height: 32px;
      background: #C3FF00;
      color: #000;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      flex-shrink: 0;
    }
    .step-content { flex: 1; }
    .step-content strong {
      color: #fff;
      display: block;
      margin-bottom: 4px;
    }
    .step-content span { color: #666; font-size: 0.9rem; }
    code {
      background: #111;
      border: 1px solid #333;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
      color: #C3FF00;
    }
    .links {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 2rem;
    }
    .link {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 12px;
      color: #fff;
      text-decoration: none;
      transition: border-color 0.2s;
    }
    .link:hover { border-color: #C3FF00; }
    .link span { color: #C3FF00; }
    footer {
      text-align: center;
      padding: 40px 20px;
      border-top: 1px solid #222;
      color: #444;
      font-size: 0.875rem;
    }
    footer a {
      color: #C3FF00;
      text-decoration: none;
    }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header class="header">
    <img src="${FAVICON}" alt="" class="logo">
    <h1><span class="highlight">chost</span>.app</h1>
    <p class="tagline">Fork your own on-chain hosting mirror</p>
  </header>

  <main>
    <h2>What is this?</h2>
    <p>
      This is a mirror of ChainHost, serving websites stored permanently on Ethereum.
      The entire system is open source. You can run your own mirror in minutes.
    </p>
    <p>
      Your content lives on-chain forever. Mirrors just make it accessible via
      normal URLs. If one mirror goes down, spin up another. The data is immortal.
    </p>

    <h2>Run Your Own Mirror</h2>
    <div class="steps">
      <div class="step">
        <div class="num">1</div>
        <div class="step-content">
          <strong>Clone the repository</strong>
          <span><code>git clone ${GIT_REPO}</code></span>
        </div>
      </div>
      <div class="step">
        <div class="num">2</div>
        <div class="step-content">
          <strong>Create a free Cloudflare account</strong>
          <span>Workers free tier: 100k requests/day</span>
        </div>
      </div>
      <div class="step">
        <div class="num">3</div>
        <div class="step-content">
          <strong>Deploy the worker</strong>
          <span><code>cd cloudflare-worker && npx wrangler deploy</code></span>
        </div>
      </div>
      <div class="step">
        <div class="num">4</div>
        <div class="step-content">
          <strong>Add your domain</strong>
          <span>Point <code>*.yourdomain.com</code> to the worker</span>
        </div>
      </div>
    </div>

    <h2>Links</h2>
    <div class="links">
      <a href="https://chainhost.online" class="link">
        ChainHost - Main Site
        <span>&rarr;</span>
      </a>
      <a href="${GIT_REPO}" class="link">
        GitHub Repository
        <span>&rarr;</span>
      </a>
      <a href="https://twitter.com/jefdiesel" class="link">
        @jefdiesel on Twitter
        <span>&rarr;</span>
      </a>
    </div>
  </main>

  <footer>
    <p>Permanent hosting powered by <a href="https://ethscriptions.com">Ethscriptions</a></p>
  </footer>
</body>
</html>`;

// immutable.church landing page
const IMMUTABLE_LANDING = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>immutable.church - Permanent On-Chain Hosting</title>
  <link rel="icon" href="${FAVICON}">
  <meta property="og:title" content="immutable.church">
  <meta property="og:description" content="Permanent websites on Ethereum">
  <meta property="og:url" content="https://immutable.church">
  <meta property="og:site_name" content="ChainHost">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #e8e8e8;
      min-height: 100vh;
      line-height: 1.7;
    }
    .header {
      padding: 60px 20px;
      text-align: center;
      border-bottom: 1px solid #222;
    }
    .logo {
      width: 64px;
      height: 64px;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 2.5rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }
    h1 .highlight { color: #C3FF00; }
    .tagline {
      color: #888;
      font-size: 1.125rem;
    }
    main {
      max-width: 700px;
      margin: 0 auto;
      padding: 60px 20px;
    }
    h2 {
      color: #C3FF00;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 1rem;
      margin-top: 3rem;
    }
    h2:first-of-type { margin-top: 0; }
    p {
      margin-bottom: 1.5rem;
      color: #aaa;
    }
    .links {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 2rem;
    }
    .link {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 12px;
      color: #fff;
      text-decoration: none;
      transition: border-color 0.2s;
    }
    .link:hover { border-color: #C3FF00; }
    .link span { color: #C3FF00; }
    footer {
      text-align: center;
      padding: 40px 20px;
      border-top: 1px solid #222;
      color: #444;
      font-size: 0.875rem;
    }
    footer a {
      color: #C3FF00;
      text-decoration: none;
    }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header class="header">
    <img src="${FAVICON}" alt="" class="logo">
    <h1><span class="highlight">immutable</span>.church</h1>
    <p class="tagline">Permanent websites on Ethereum</p>
  </header>

  <main>
    <h2>What is this?</h2>
    <p>
      This is a mirror of ChainHost, serving websites stored permanently on Ethereum.
      Your content lives on-chain forever. No servers. No renewals. No takedowns.
    </p>
    <p>
      Every site hosted here is immutable. Once inscribed, it cannot be changed or removed.
      The blockchain is your church of permanence.
    </p>

    <h2>Get Started</h2>
    <p>
      Register a name, upload your HTML, and your site lives forever.
      All for the cost of a single Ethereum transaction.
    </p>

    <h2>Links</h2>
    <div class="links">
      <a href="https://chainhost.online" class="link">
        ChainHost - Register a Name
        <span>&rarr;</span>
      </a>
      <a href="${GIT_REPO}" class="link">
        GitHub - Self-Host Your Own Mirror
        <span>&rarr;</span>
      </a>
      <a href="https://twitter.com/jefdiesel" class="link">
        @jefdiesel on Twitter
        <span>&rarr;</span>
      </a>
    </div>
  </main>

  <footer>
    <p>Permanent hosting powered by <a href="https://ethscriptions.com">Ethscriptions</a></p>
  </footer>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Redirect HTTP to HTTPS
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const hostname = url.hostname;
    const path = url.pathname;

    // Serve landing pages for root domains
    if (hostname === 'chost.app' || hostname === 'www.chost.app') {
      return new Response(CHOST_LANDING, {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    if (hostname === 'immutable.church' || hostname === 'www.immutable.church') {
      // Serve from inscription
      const IMMUTABLE_HOME_TX = '0xfc5e9976018b6b663c0182ea5388b308d74b8282fe2dfc23a54bb86098eaabc0';
      const content = await fetchTxContentRaw(IMMUTABLE_HOME_TX);
      if (content?.decoded || content?.dataUri) {
        let html = content.decoded || content.dataUri;
        // Inject SEO, OG tags and favicon
        const seoTags = `
<link rel="icon" href="${FAVICON}">
<meta name="description" content="From the void came the Chain. No gods, no masters—only mathematics and consensus. That which is written to the eternal ledger cannot be unwritten.">
<meta property="og:title" content="The Church of Immutable Truth">
<meta property="og:description" content="From the void came the Chain. No gods, no masters—only mathematics and consensus. That which is written to the eternal ledger cannot be unwritten. That which is verified by proof cannot be denied.">
<meta property="og:url" content="https://immutable.church">
<meta property="og:site_name" content="immutable.church">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="The Church of Immutable Truth">
<meta name="twitter:description" content="We who inscribe these words trust not in faith but in cryptographic certainty.">
`;
        if (html.includes('</head>')) {
          html = html.replace('</head>', seoTags + '</head>');
        }
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      }
      // Fallback to static landing if fetch fails
      return new Response(IMMUTABLE_LANDING, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Robots.txt - allow all crawlers
    if (path === '/robots.txt') {
      const sitemapDomain = hostname.includes('immutable') ? 'immutable.church' :
                            hostname.includes('chost') ? 'chost.app' : 'chainhost.online';
      return new Response(`User-agent: *\nAllow: /\nSitemap: https://${sitemapDomain}/sitemap.xml\n`, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Sitemap with featured sites
    if (path === '/sitemap.xml') {
      const baseDomain = hostname.includes('immutable') ? 'immutable.church' :
                         hostname.includes('chost') ? 'chost.app' : 'chainhost.online';
      const featured = ['degenjef', 'gmerrychristmas', 'lemmings', 'emulator', 'dkc', 'starfox2', 'supermarioworld'];
      const urls = featured.map(name =>
        `  <url><loc>https://${name}.${baseDomain}/</loc><changefreq>monthly</changefreq></url>`
      ).join('\n');
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${baseDomain}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
${urls}
</urlset>`;
      return new Response(sitemap, {
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    // Serve OG screenshot images from R2 (with SVG fallback)
    if (path.startsWith('/_og/') && path.endsWith('.png')) {
      const ogName = path.slice(5, -4); // extract name from /_og/{name}.png
      try {
        const obj = await env.R2.get(`screenshots/${ogName}/home.png`);
        if (obj) {
          const headers = {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          };
          if (obj.size) headers['Content-Length'] = String(obj.size);
          return new Response(obj.body, { headers });
        }
      } catch (e) {
        // R2 fetch failed, fall through to default
      }
      // Fallback: render branded SVG as PNG via Browser Rendering
      try {
        const bondingAddr = await getBondingToken(ogName);
        const svg = bondingAddr ? bondingOgSvg(ogName) : defaultOgSvg(ogName);
        const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}</style></head><body>${svg}</body></html>`;
        const browser = await puppeteer.launch(env.BROWSER);
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1200, height: 630 });
          await page.setContent(html, { waitUntil: 'load' });
          const png = await page.screenshot({ type: 'png' });
          // Cache it in R2 so we don't re-render next time
          await env.R2.put(`screenshots/${ogName}/home.png`, png, {
            httpMetadata: { contentType: 'image/png' },
          });
          await page.close();
          return new Response(png, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        } finally {
          await browser.close();
        }
      } catch (e) {
        // If browser rendering fails, serve SVG as last resort
        const fallbackBonding = await getBondingToken(ogName).catch(() => null);
        return new Response(fallbackBonding ? bondingOgSvg(ogName) : defaultOgSvg(ogName), {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=300',
          },
        });
      }
    }

    // Manual screenshot capture: /_screenshot?name=X&key=SECRET
    if (path === '/_screenshot') {
      const name = url.searchParams.get('name');
      const key = url.searchParams.get('key');
      if (key !== env.CACHE_CLEAR_KEY) {
        return new Response('Unauthorized', { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (!name) {
        return new Response('Missing name parameter', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      try {
        await captureScreenshot(env, name);
        return new Response(`Screenshot captured for ${name}`, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
      } catch (e) {
        return new Response(`Screenshot failed: ${e.message}`, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }

    // Backfill screenshots for multiple names: /_screenshot-all?key=SECRET&names=a,b,c
    if (path === '/_screenshot-all') {
      const key = url.searchParams.get('key');
      if (key !== env.CACHE_CLEAR_KEY) {
        return new Response('Unauthorized', { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      const namesParam = url.searchParams.get('names');
      if (!namesParam) {
        return new Response('Missing names parameter (comma-separated)', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      const names = namesParam.split(',').map(n => n.trim()).filter(Boolean);
      const results = {};
      const startTime = Date.now();
      const MAX_TIME_MS = 25000; // stop before worker timeout
      let browser;
      try {
        browser = await puppeteer.launch(env.BROWSER);
        for (const name of names) {
          // Stop if running out of time
          if (Date.now() - startTime > MAX_TIME_MS) {
            for (const n of names) {
              if (!results[n]) results[n] = 'skipped: timeout';
            }
            break;
          }
          try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1200, height: 630 });
            await page.goto(`https://${name}.chainhost.online`, {
              waitUntil: 'networkidle0',
              timeout: 10000,
            });
            // Skip placeholder pages (no manifest / not claimed)
            const bodyText = await page.evaluate(() => document.body.innerText);
            if (bodyText.includes('not claimed') || bodyText.includes('no site is uploaded')) {
              await page.close();
              results[name] = 'skipped';
              continue;
            }
            const screenshot = await page.screenshot({ type: 'png' });
            await env.R2.put(`screenshots/${name}/home.png`, screenshot, {
              httpMetadata: { contentType: 'image/png' },
            });
            await page.close();
            results[name] = 'ok';
          } catch (e) {
            results[name] = `error: ${e.message}`;
          }
        }
      } catch (e) {
        for (const name of names) {
          if (!results[name]) results[name] = `error: ${e.message}`;
        }
      } finally {
        if (browser) await browser.close().catch(() => {});
      }
      return new Response(JSON.stringify(results, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Cache clear endpoint: /_clear?name=foo&key=SECRET
    if (path === '/_clear') {
      const name = url.searchParams.get('name');
      const key = url.searchParams.get('key');

      // Simple auth - check against env secret
      if (key !== env.CACHE_CLEAR_KEY) {
        return new Response('Unauthorized', { status: 401 });
      }

      if (!name) {
        return new Response('Missing name parameter', { status: 400 });
      }

      // Find owner of the name
      const nameSha = await sha256(`data:,${name}`);
      const nameRes = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/exists/0x${nameSha}`);
      const nameData = await nameRes.json();

      if (!nameData?.result?.exists) {
        return new Response(`Name "${name}" not found`, { status: 404 });
      }

      const owner = nameData.result.ethscription.current_owner;
      const cacheKey = `manifest:${owner.toLowerCase()}:${name}`;

      if (env.CACHE) {
        await env.CACHE.delete(cacheKey);
      }

      // Capture OG screenshot in the background (don't block response)
      ctx.waitUntil(
        captureScreenshot(env, name).catch(e => console.error('Screenshot failed:', e.message))
      );

      return new Response(`Cache cleared for ${name}. Screenshot queued.`, { status: 200 });
    }

    // Extract subdomain - support chainhost.online, chost.app, immutable.church
    const parts = hostname.split('.');
    const isChainhost = parts.length >= 3 && parts[parts.length - 2] === 'chainhost';
    const isChost = parts.length >= 3 && parts[parts.length - 2] === 'chost';
    const isImmutable = parts.length >= 3 && parts[parts.length - 2] === 'immutable';

    if (!isChainhost && !isChost && !isImmutable) {
      return new Response('Invalid hostname', { status: 400 });
    }

    // Decode punycode for internationalized domain names (e.g., xn--kpry57d -> 梦)
    let name = decodePunycode(parts[0].toLowerCase());
    const baseDomain = isImmutable ? 'immutable.church' : (isChost ? 'chost.app' : 'chainhost.online');

    // Skip reserved subdomains
    const reserved = ['www', 'api', 'app', 'dashboard', 'admin', 'mail', 'ftp'];
    if (reserved.includes(name)) {
      return Response.redirect(`https://${baseDomain}` + path, 302);
    }

    // RPC proxy - handle ethscription names that map to chain RPCs
    const rpcConfig = RPC_PROXY_MAP[name];
    if (rpcConfig) {
      // CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      // POST = JSON-RPC proxy with failover + caching + rate limiting
      if (request.method === 'POST') {
        // Rate limiting: 60 requests per minute per IP per chain
        try {
          const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
          const rateLimitKey = `rpc-rl:${name}:${clientIP}:${Math.floor(Date.now() / 60000)}`;
          if (env.CACHE) {
            const count = parseInt(await env.CACHE.get(rateLimitKey) || '0');
            if (count >= 60) {
              return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32005, message: 'Rate limit exceeded. 60 requests/min per IP.' } }), {
                status: 429,
                headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders },
              });
            }
            await env.CACHE.put(rateLimitKey, String(count + 1), { expirationTtl: 120 });
          }
        } catch (e) { /* rate limit KV failure - allow request through */ }

        const body = await request.text();
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = null; }

        // Cache read-only methods (12s TTL for block-dependent, 300s for static)
        const CACHEABLE_SHORT = ['eth_blockNumber', 'eth_gasPrice', 'eth_getBlockByNumber'];
        const CACHEABLE_LONG = ['eth_call', 'eth_getBalance', 'eth_getCode', 'eth_getTransactionCount', 'eth_getStorageAt', 'eth_chainId', 'net_version'];
        const method = parsed?.method;
        const cacheableTtl = CACHEABLE_SHORT.includes(method) ? 12
          : CACHEABLE_LONG.includes(method) ? 300
          : 0;

        // Check cache for read-only calls
        if (cacheableTtl > 0 && env.CACHE) {
          try {
            const rpcCacheKey = `rpc:${name}:${method}:${JSON.stringify(parsed?.params || [])}`;
            const cached = await env.CACHE.get(rpcCacheKey);
            if (cached) {
              return new Response(cached, {
                headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders },
              });
            }
          } catch (e) { /* cache read failure - fall through to RPC */ }
        }

        // Try each backend RPC with failover
        let lastError = null;
        for (const rpc of rpcConfig.rpcs) {
          try {
            const res = await fetch(rpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
            });
            if (res.ok) {
              const data = await res.json();
              if (data.result !== undefined) {
                const responseBody = JSON.stringify(data);

                // Cache the result (best effort)
                if (cacheableTtl > 0 && env.CACHE) {
                  try {
                    const rpcCacheKey = `rpc:${name}:${method}:${JSON.stringify(parsed?.params || [])}`;
                    env.CACHE.put(rpcCacheKey, responseBody, { expirationTtl: cacheableTtl });
                  } catch (e) { /* cache write failure - ignore */ }
                }

                return new Response(responseBody, {
                  headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders },
                });
              }
              lastError = data.error;
            }
          } catch (e) { lastError = e.message; }
        }
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: parsed?.id || null, error: lastError || { code: -32000, message: 'All RPC endpoints failed' } }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /endpoints - return raw RPC list
      if (path === '/endpoints') {
        return new Response(JSON.stringify(rpcConfig.rpcs), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET / - landing page
      return new Response(rpcLandingPage(name, rpcConfig, baseDomain), {
        headers: { 'Content-Type': 'text/html', ...corsHeaders },
      });
    }

    try {
      // 1. Check if name is claimed (data:,name exists) - lowercase only
      const nameSha = await sha256(`data:,${name}`);
      const nameRes = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/exists/0x${nameSha}`);
      const nameData = await nameRes.json();

      if (!nameData?.result?.exists) {
        // Name not claimed as ethscription, but check if bonding token exists
        const tokenAddr = await getBondingToken(name);
        if (tokenAddr) {
          return new Response(bondingTradePage(name, tokenAddr, baseDomain), {
            headers: { 'Content-Type': 'text/html' },
          });
        }
        return new Response(notClaimedPage(name, baseDomain), {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const owner = nameData.result.ethscription.current_owner;

      // 2. Handle special routes
      if (path === '/recovery') {
        return new Response(recoveryPage(name, owner, baseDomain), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      if (path === '/previous') {
        const history = await getInscriptionHistory(owner, name);
        return new Response(previousPage(name, owner, history, baseDomain), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Handle /tx/0x... route for viewing transaction content
      if (path.startsWith('/tx/')) {
        const txHash = path.slice(4); // Remove '/tx/'
        if (!txHash.startsWith('0x') || txHash.length < 10) {
          return new Response('Invalid transaction hash', { status: 400 });
        }
        const pixelArt = url.searchParams.get('pixel') === '1';
        return await serveTxContent(txHash, pixelArt, name);
      }

      // Handle /mail/* routes for email functionality
      if (path === '/mail' || path.startsWith('/mail/')) {
        // Dynamically import mail routes (or inline if bundled)
        const { handleMailRoute } = await import('./mail-routes.js');
        return await handleMailRoute(request, env, name, owner, baseDomain);
      }

      // 3. Find owner's chainhost manifest for this specific name (with caching)
      const manifest = await findManifestCached(env, owner, name);

      if (!manifest) {
        // Check if a bonding curve token exists for this name
        const tokenAddr = await getBondingToken(name);
        if (tokenAddr) {
          return new Response(bondingTradePage(name, tokenAddr, baseDomain), {
            headers: { 'Content-Type': 'text/html' },
          });
        }
        return new Response(noManifestPage(name, owner, baseDomain), {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // 4. Resolve route
      const route = path === '/' || path === '' ? 'home' : path.slice(1);
      const txHash = manifest[route];

      if (!txHash) {
        // If home route missing, check if bonding curve token exists
        if (route === 'home') {
          const tokenAddr = await getBondingToken(name);
          if (tokenAddr) {
            return new Response(bondingTradePage(name, tokenAddr, baseDomain), {
              headers: { 'Content-Type': 'text/html' },
            });
          }
        }
        return new Response(notFoundPage(name, route), {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // 5. Fetch content (use raw version to detect type)
      const rawContent = await fetchTxContentRaw(txHash);

      if (!rawContent) {
        return new Response(contentErrorPage(name, txHash), {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Check if it's an image
      const isImage = rawContent.dataUri && rawContent.dataUri.startsWith('data:image/');
      const pixelArt = manifest.pixel === true || manifest.pixel === 'true';

      if (isImage) {
        // Serve image wrapped in HTML
        const html = imagePageHtml(name, rawContent.dataUri, txHash, pixelArt, manifest, baseDomain);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // 6. For HTML, inject OG tags and footer
      let content = rawContent.decoded || rawContent.dataUri || '';
      content = injectOgTags(content, name, baseDomain);
      content = injectFooter(content, name, manifest, baseDomain);

      return new Response(content, {
        headers: { 'Content-Type': 'text/html' },
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(errorPage(error.message), {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      });
    }
  },

  // Scheduled trigger to keep Supabase active
  async scheduled(event, env, ctx) {
    try {
      // Ping the Vercel keepalive endpoint
      const response = await fetch('https://chainhost.online/api/cron/keepalive');
      const data = await response.json();
      console.log('Supabase keepalive:', data);
    } catch (error) {
      console.error('Keepalive failed:', error);
    }
  },
};

// ============ Helpers ============

function defaultOgSvg(name) {
  // Lime/black branded fallback — chain link pattern with logo
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#000"/>
  <!-- Chain link pattern -->
  <g opacity="0.08" stroke="#C3FF00" stroke-width="2" fill="none">
    ${Array.from({length: 8}, (_, i) =>
      `<ellipse cx="${150 * i + 75}" cy="315" rx="60" ry="30"/>
       <ellipse cx="${150 * i + 150}" cy="315" rx="60" ry="30"/>`
    ).join('')}
  </g>
  <!-- Site name -->
  <text x="600" y="280" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="72" font-weight="bold" fill="#fff">${escapeXml(name)}</text>
  <text x="600" y="340" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="28" fill="#888">.chainhost.online</text>
  <!-- Branding -->
  <text x="600" y="520" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="20" fill="#C3FF00">Permanent on-chain hosting</text>
  <text x="600" y="555" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="16" fill="#555">Powered by Ethscriptions</text>
  <!-- Top accent line -->
  <rect x="0" y="0" width="1200" height="4" fill="#C3FF00"/>
</svg>`;
}

function bondingOgSvg(name) {
  const esc = escapeXml(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0f"/>
  <rect x="0" y="0" width="1200" height="4" fill="#C3FF00"/>
  <!-- Curve visualization -->
  <path d="M100,480 Q300,470 500,400 T900,150" stroke="#C3FF00" stroke-width="3" fill="none" opacity="0.3"/>
  <path d="M100,480 Q300,470 500,400 T900,150 L900,480 Z" fill="#C3FF00" opacity="0.05"/>
  <!-- Token name -->
  <text x="600" y="240" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="96" font-weight="bold" fill="#C3FF00">$${esc}</text>
  <!-- Subtitle -->
  <text x="600" y="305" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="22" fill="#888">Ethereum bonding token on a gentler polynomial curve</text>
  <text x="600" y="340" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#555">Token names tied to ethscriptions — SHA256 secured</text>
  <!-- Info pills -->
  <rect x="200" y="380" width="240" height="44" rx="22" fill="#1e1e2e"/>
  <text x="320" y="408" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#e0e0e0">Uniswap V2 at 69%</text>
  <rect x="480" y="380" width="240" height="44" rx="22" fill="#1e1e2e"/>
  <text x="600" y="408" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#e0e0e0">LP burned forever</text>
  <rect x="760" y="380" width="200" height="44" rx="22" fill="#1e1e2e"/>
  <text x="860" y="408" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#e0e0e0">0.69% sell fee</text>
  <!-- Footer -->
  <text x="600" y="540" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="20" fill="#C3FF00">${esc}.chainhost.online</text>
  <text x="600" y="575" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="16" fill="#555">fafo</text>
</svg>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function captureScreenshot(env, name) {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.goto(`https://${name}.chainhost.online`, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });
    const screenshot = await page.screenshot({ type: 'png' });
    await env.R2.put(`screenshots/${name}/home.png`, screenshot, {
      httpMetadata: { contentType: 'image/png' },
    });
  } finally {
    await browser.close();
  }
}

// Punycode decoder for internationalized domain names (IDN)
// Decodes "xn--kpry57d" back to "梦"
function decodePunycode(input) {
  if (!input.startsWith('xn--')) return input;

  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const initialBias = 72;
  const initialN = 128;

  function adapt(delta, numPoints, firstTime) {
    delta = firstTime ? Math.floor(delta / damp) : Math.floor(delta / 2);
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > ((base - tMin) * tMax) / 2) {
      delta = Math.floor(delta / (base - tMin));
      k += base;
    }
    return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
  }

  function decodeDigit(cp) {
    if (cp - 48 < 10) return cp - 22;
    if (cp - 65 < 26) return cp - 65;
    if (cp - 97 < 26) return cp - 97;
    return base;
  }

  const encoded = input.slice(4);
  const output = [];
  let i = 0;
  let n = initialN;
  let bias = initialBias;

  const delimPos = encoded.lastIndexOf('-');
  const basicPart = delimPos > 0 ? encoded.slice(0, delimPos) : '';
  for (const char of basicPart) {
    output.push(char.charCodeAt(0));
  }

  let index = delimPos > 0 ? delimPos + 1 : 0;

  while (index < encoded.length) {
    const oldi = i;
    let w = 1;
    let k = base;

    while (true) {
      if (index >= encoded.length) break;
      const digit = decodeDigit(encoded.charCodeAt(index++));
      if (digit >= base) break;
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      w *= base - t;
      k += base;
    }

    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    n += Math.floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }

  return String.fromCodePoint(...output);
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function serveTxContent(txHash, pixelArt, name) {
  // Fetch the raw content from the transaction
  const content = await fetchTxContentRaw(txHash);

  if (!content) {
    return new Response('Content not found', { status: 404 });
  }

  // Check if it's an image data URI
  const isImage = content.dataUri && content.dataUri.startsWith('data:image/');

  if (isImage) {
    // Extract mime type
    const mimeMatch = content.dataUri.match(/^data:([^;,]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    if (pixelArt) {
      // Wrap in HTML with pixel art scaling
      const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pixel Art - ${name}</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
img{
  image-rendering:pixelated;
  image-rendering:crisp-edges;
  max-width:100%;
  max-height:90vh;
  width:auto;
  height:auto;
}
.container{text-align:center}
.tx{font-family:monospace;color:#555;font-size:0.75rem;margin-top:1rem}
.tx a{color:#C3FF00}
</style>
</head><body>
<div class="container">
<img src="${content.dataUri}" alt="Pixel Art">
<p class="tx"><a href="https://etherscan.io/tx/${txHash}" target="_blank">${txHash.slice(0,20)}...</a></p>
</div>
</body></html>`;
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    } else {
      // Serve image directly
      const base64Match = content.dataUri.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        const binary = atob(base64Match[1]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new Response(bytes, {
          headers: { 'Content-Type': mimeType },
        });
      }
      // Non-base64 image, redirect to data URI isn't possible, wrap in HTML
      const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Image - ${name}</title>
</head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh">
<img src="${content.dataUri}" style="max-width:100%;max-height:100vh">
</body></html>`;
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }

  // For HTML content
  if (content.dataUri && content.dataUri.includes('text/html')) {
    return new Response(content.decoded || content.dataUri, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // For other content, show as text
  return new Response(content.decoded || content.dataUri || 'Unknown content', {
    headers: { 'Content-Type': 'text/plain' },
  });
}

async function fetchTxContentRaw(txHash) {
  // Try Ethscriptions API first
  try {
    const res = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/${txHash}`);
    const data = await res.json();

    if (data.result?.content_uri) {
      const uri = data.result.content_uri;
      return { dataUri: uri, decoded: decodeDataUri(uri) };
    }
  } catch (e) {
    // Try RPC
  }

  // Try Ethereum RPC
  const ethResult = await fetchFromRPCRaw(ETH_RPC, txHash);
  if (ethResult) return ethResult;

  // Try Base RPC
  const baseResult = await fetchFromRPCRaw(BASE_RPC, txHash);
  if (baseResult) return baseResult;

  // Try Sepolia RPC (testnet - free inscriptions)
  const sepoliaResult = await fetchFromRPCRaw(SEPOLIA_RPC, txHash);
  if (sepoliaResult) return sepoliaResult;

  return null;
}

async function fetchFromRPCRaw(rpcUrl, txHash) {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [txHash],
        id: 1,
      }),
    });
    const data = await res.json();

    if (!data.result?.input) return null;

    const hex = data.result.input;
    if (!hex || hex === '0x') return null;

    const bytes = [];
    for (let i = 2; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    const decoded = new TextDecoder().decode(new Uint8Array(bytes));

    if (decoded.startsWith('data:')) {
      return { dataUri: decoded, decoded: decodeDataUri(decoded) };
    }
    return { dataUri: null, decoded };
  } catch (e) {
    return null;
  }
}

function decodeDataUri(uri) {
  if (!uri || !uri.startsWith('data:')) return null;
  const match = uri.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
  if (match) {
    if (uri.includes(';base64,')) return atob(match[2]);
    return decodeURIComponent(match[2]);
  }
  return null;
}

async function findManifestCached(env, owner, name) {
  const cacheKey = `manifest:${owner.toLowerCase()}:${name}`;

  // Try cache first
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey, 'json');
      if (cached !== null && cached._manifestTx) {
        // Quick check: is there a newer manifest?
        const newestTx = await getNewestManifestTx(owner, name);
        if (newestTx && newestTx !== cached._manifestTx) {
          // Newer manifest exists - invalidate cache
          await env.CACHE.delete(cacheKey);
        } else {
          // Cache is current
          const { _manifestTx, ...manifest } = cached;
          return Object.keys(manifest).length > 0 ? manifest : null;
        }
      } else if (cached !== null) {
        return cached; // Legacy cache format
      }
    } catch (e) {
      console.error('Cache read error:', e);
    }
  }

  // Cache miss or invalidated - fetch from API
  const { manifest, manifestTx } = await findManifest(owner, name);

  // Cache the result with manifest tx for version checking
  if (env.CACHE) {
    try {
      const toCache = manifest ? { ...manifest, _manifestTx: manifestTx } : { _manifestTx: manifestTx };
      await env.CACHE.put(cacheKey, JSON.stringify(toCache), {
        expirationTtl: MANIFEST_CACHE_TTL,
      });
    } catch (e) {
      console.error('Cache write error:', e);
    }
  }

  return manifest;
}

// Quick lookup to get newest manifest tx hash (no content fetch)
async function getNewestManifestTx(owner, name) {
  try {
    const res = await fetch(
      `${ETHSCRIPTIONS_API}/ethscriptions?current_owner=${owner}&mime_subtype=json&per_page=20`
    );
    const data = await res.json();
    if (!data.result?.length) return null;

    for (const eth of data.result) {
      try {
        const content = await fetchEthscriptionContent(eth.transaction_hash);
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.chainhost && parsed.chainhost[name]) {
            return eth.transaction_hash;
          }
        }
      } catch (e) {}
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function findManifest(owner, name) {
  try {
    const res = await fetch(
      `${ETHSCRIPTIONS_API}/ethscriptions?current_owner=${owner}&mime_subtype=json&per_page=50`
    );
    const data = await res.json();

    if (!data.result?.length) return { manifest: null, manifestTx: null };

    // Look for name-specific manifests only (new format)
    // Old format without name key is no longer supported
    for (const eth of data.result) {
      try {
        const content = await fetchEthscriptionContent(eth.transaction_hash);
        if (content) {
          const parsed = JSON.parse(content);
          // Format: {"chainhost": {"sitename": {"home": "0x..."}}}
          if (parsed.chainhost && parsed.chainhost[name]) {
            return { manifest: parsed.chainhost[name], manifestTx: eth.transaction_hash };
          }
        }
      } catch (e) {
        // Not valid JSON or not chainhost manifest
      }
    }

    return { manifest: null, manifestTx: null };
  } catch (e) {
    console.error('Manifest lookup error:', e);
    return { manifest: null, manifestTx: null };
  }
}

async function fetchEthscriptionContent(txHash) {
  // Try Ethscriptions API first (Ethereum)
  try {
    const res = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/${txHash}`);
    const data = await res.json();

    if (data.result?.content_uri) {
      const uri = data.result.content_uri;
      if (uri.startsWith('data:')) {
        const match = uri.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
        if (match) {
          if (uri.includes(';base64,')) return atob(match[2]);
          return decodeURIComponent(match[2]);
        }
      }
      return uri;
    }
  } catch (e) {
    // Ethscriptions API failed, try RPC
  }

  // Try Ethereum RPC
  const ethContent = await fetchFromRPC(ETH_RPC, txHash);
  if (ethContent) return ethContent;

  // Try Base RPC
  const baseContent = await fetchFromRPC(BASE_RPC, txHash);
  if (baseContent) return baseContent;

  // Try Sepolia RPC (testnet - free inscriptions)
  const sepoliaContent = await fetchFromRPC(SEPOLIA_RPC, txHash);
  if (sepoliaContent) return sepoliaContent;

  return null;
}

async function fetchFromRPC(rpcUrl, txHash) {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [txHash],
        id: 1,
      }),
    });
    const data = await res.json();

    if (!data.result?.input) return null;

    // Decode calldata to string
    const hex = data.result.input;
    if (!hex || hex === '0x') return null;

    const bytes = [];
    for (let i = 2; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    const decoded = new TextDecoder().decode(new Uint8Array(bytes));

    // Parse data URI
    if (decoded.startsWith('data:')) {
      const match = decoded.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
      if (match) {
        if (decoded.includes(';base64,')) return atob(match[2]);
        return decodeURIComponent(match[2]);
      }
    }
    return decoded;
  } catch (e) {
    console.error(`RPC fetch error (${rpcUrl}):`, e);
    return null;
  }
}

async function getInscriptionHistory(owner, name) {
  try {
    // Get all chainhost manifests from this owner
    const res = await fetch(
      `${ETHSCRIPTIONS_API}/ethscriptions?current_owner=${owner}&mime_subtype=json&per_page=50`
    );
    const data = await res.json();

    if (!data.result?.length) return [];

    const history = [];

    // Extract tx hashes from chainhost manifests for this specific name
    for (const eth of data.result) {
      try {
        const content = await fetchEthscriptionContent(eth.transaction_hash);
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.chainhost) {
            // New format: {"chainhost": {"degenjef": {"home": "0x..."}}}
            if (parsed.chainhost[name]) {
              for (const [route, txHash] of Object.entries(parsed.chainhost[name])) {
                history.push({
                  txHash,
                  route,
                  manifestTx: eth.transaction_hash,
                  timestamp: eth.block_timestamp,
                });
              }
            }
            // Old format fallback: {"chainhost": {"home": "0x..."}}
            else if (parsed.chainhost.home && !Object.keys(parsed.chainhost).some(k => typeof parsed.chainhost[k] === 'object')) {
              for (const [route, txHash] of Object.entries(parsed.chainhost)) {
                history.push({
                  txHash,
                  route,
                  manifestTx: eth.transaction_hash,
                  timestamp: eth.block_timestamp,
                });
              }
            }
          }
        }
      } catch (e) {
        // Not valid JSON or not chainhost manifest
      }
    }

    return history;
  } catch (e) {
    console.error('History lookup error:', e);
    return [];
  }
}

function imagePageHtml(name, dataUri, txHash, pixelArt, manifest, baseDomain = 'chainhost.online') {
  const hasAbout = !!manifest.about;

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:title" content="${name}">
<meta property="og:description" content="${name} — permanent on-chain site powered by ChainHost">
<meta property="og:url" content="https://${name}.${baseDomain}">
<meta property="og:site_name" content="ChainHost">
<meta property="og:type" content="website">
<meta property="og:image" content="https://${name}.${baseDomain}/_og/${name}.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${name}">
<meta name="twitter:description" content="${name} — permanent on-chain site powered by ChainHost">
<meta name="twitter:image" content="https://${name}.${baseDomain}/_og/${name}.png">
<title>${name}</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;padding-bottom:60px}
img{
  ${pixelArt ? 'image-rendering:pixelated;image-rendering:crisp-edges;min-width:50vw;min-height:50vh;object-fit:contain;' : ''}
  max-width:100%;
  max-height:calc(100vh - 80px);
  width:auto;
  height:auto;
}
</style>
</head><body>
<img src="${dataUri}" alt="${name}">
<nav id="chainhost-footer" style="position:fixed;bottom:0;left:0;right:0;background:#000;border-top:1px solid #333;padding:10px 20px;display:flex;justify-content:center;align-items:center;gap:24px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;z-index:99999">
  ${hasAbout ? `<a href="/about" style="color:#888;text-decoration:none" onmouseover="this.style.color='#C3FF00'" onmouseout="this.style.color='#888'">About</a>` : ''}
  <a href="/previous" style="color:#888;text-decoration:none" onmouseover="this.style.color='#C3FF00'" onmouseout="this.style.color='#888'">Previous</a>
  <a href="/recovery" style="color:#888;text-decoration:none" onmouseover="this.style.color='#C3FF00'" onmouseout="this.style.color='#888'">Recovery</a>
  <span style="color:#333">|</span>
  <a href="https://etherscan.io/tx/${txHash}" target="_blank" style="color:#555;text-decoration:none;font-size:11px">${txHash.slice(0,10)}...</a>
  <span style="color:#333">|</span>
  <a href="https://chainhost.online" target="_blank" style="color:#555;text-decoration:none;font-size:11px">chainhost</a>
</nav>
</body></html>`;
}

function injectOgTags(html, name, baseDomain = 'chainhost.online') {
  const ogImage = `https://${name}.${baseDomain}/_og/${name}.png`;
  const ogDesc = `${name} — permanent on-chain site powered by ChainHost`;
  const ogTags = `
<link rel="icon" href="${FAVICON}">
<meta property="og:title" content="${name}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:url" content="https://${name}.${baseDomain}">
<meta property="og:site_name" content="ChainHost">
<meta property="og:type" content="website">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${name}">
<meta name="twitter:description" content="${ogDesc}">
<meta name="twitter:image" content="${ogImage}">
`;

  // Inject after <head> or before </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', ogTags + '</head>');
  } else if (html.includes('<head>')) {
    return html.replace('<head>', '<head>' + ogTags);
  }
  // No <head> tag at all — prepend one
  if (html.includes('<html')) {
    return html.replace(/<html([^>]*)>/, `<html$1><head>${ogTags}</head>`);
  }
  return `<head>${ogTags}</head>${html}`;
}

function injectFooter(html, name, manifest, baseDomain = 'chainhost.online') {
  const hasAbout = !!manifest.about;

  const footer = `
<nav id="chainhost-footer" style="position:fixed;bottom:0;left:0;right:0;background:#000;border-top:1px solid #333;padding:10px 20px;display:flex;justify-content:center;align-items:center;gap:24px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;z-index:99999">
  ${hasAbout ? `<a href="/about" style="color:#888;text-decoration:none;transition:color 0.2s" onmouseover="this.style.color='#C3FF00'" onmouseout="this.style.color='#888'">About</a>` : ''}
  <a href="/previous" style="color:#888;text-decoration:none;transition:color 0.2s" onmouseover="this.style.color='#C3FF00'" onmouseout="this.style.color='#888'">Previous</a>
  <a href="/recovery" style="color:#888;text-decoration:none;transition:color 0.2s" onmouseover="this.style.color='#C3FF00'" onmouseout="this.style.color='#888'">Recovery</a>
  <span style="color:#333">|</span>
  <a href="https://${baseDomain}" target="_blank" style="color:#555;text-decoration:none;font-size:11px">${baseDomain.split('.')[0]}</a>
</nav>
</body>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', footer);
  }
  return html; // Skip injection if no </body>
}

// ============ Pages ============

function notClaimedPage(name, baseDomain = 'chainhost.online') {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} - Available</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.c{text-align:center;max-width:500px}
h1{font-size:2.5rem;color:#C3FF00;margin-bottom:0.5rem}
.name{font-family:monospace;background:#111;padding:12px 20px;border-radius:8px;display:inline-block;margin:1.5rem 0;font-size:1.25rem;border:1px solid #333}
.desc{color:#888;margin-bottom:2rem;line-height:1.6}
.btn{display:inline-block;background:#C3FF00;color:#000;padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;font-size:1rem;margin-bottom:2rem}
.btn:hover{background:#d4ff4d}
.how{background:#111;border:1px solid #222;border-radius:12px;padding:24px;text-align:left;margin-top:1rem}
.how h3{color:#C3FF00;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:1rem}
.step{display:flex;gap:12px;margin-bottom:12px;font-size:0.875rem}
.step:last-child{margin-bottom:0}
.num{color:#C3FF00;font-weight:700}
.step span{color:#888}
.footer{margin-top:2rem;font-size:0.75rem;color:#444}
.footer a{color:#666}
</style>
</head><body>
<div class="c">
<h1>Available!</h1>
<div class="name">${name}.${baseDomain}</div>
<p class="desc">This name isn't claimed yet. Inscribe it on Ethereum and host your site forever—no servers, no renewals, just permanent on-chain hosting.</p>
<a href="https://chainhost.online/register" class="btn">Claim ${name} for Free</a>
<div class="how">
<h3>How it works</h3>
<div class="step"><span class="num">1.</span><span>Connect wallet & inscribe <code style="background:#222;padding:2px 6px;border-radius:4px;color:#C3FF00">data:,${name}</code></span></div>
<div class="step"><span class="num">2.</span><span>Upload your HTML (Ethereum or Base)</span></div>
<div class="step"><span class="num">3.</span><span>Create manifest linking routes to content</span></div>
<div class="step"><span class="num">4.</span><span>Live forever at ${name}.${baseDomain}</span></div>
</div>
<p class="footer">Powered by <a href="https://ethscriptions.com" target="_blank">Ethscriptions</a> · <a href="https://github.com/jefdiesel/chainhost" target="_blank">GitHub</a></p>
</div>
</body></html>`;
}

function noManifestPage(name, owner, baseDomain = 'chainhost.online') {
  const short = owner.slice(0, 6) + '...' + owner.slice(-4);
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.c{text-align:center;max-width:500px}
h1{font-size:2.5rem;margin-bottom:0.5rem}
.owner{font-family:monospace;color:#C3FF00;font-size:0.875rem;background:#111;padding:8px 16px;border-radius:8px;display:inline-block;margin:1rem 0;border:1px solid #333}
.desc{color:#888;margin:1.5rem 0;line-height:1.6}
.btn{display:inline-block;background:#C3FF00;color:#000;padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;font-size:1rem;margin-bottom:2rem}
.btn:hover{background:#d4ff4d}
.info{background:#111;border:1px solid #222;border-radius:12px;padding:24px;text-align:left;margin-top:1rem}
.info h3{color:#C3FF00;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:1rem}
.info p{color:#888;font-size:0.875rem;line-height:1.6;margin:0}
.footer{margin-top:2rem;font-size:0.75rem;color:#444}
.footer a{color:#666}
</style>
</head><body>
<div class="c">
<h1>${name}</h1>
<div class="owner">owned by ${short}</div>
<p class="desc">This name is claimed but no site is uploaded yet. If this is yours, upload your HTML and create a manifest to go live.</p>
<a href="https://chainhost.online/upload?name=${name}" class="btn">Upload Site</a>
<div class="info">
<h3>Next Steps</h3>
<p>Upload your HTML files (home page, about page, etc.) and inscribe them on Ethereum or Base. Then create a manifest to link your routes. Your site will be permanently accessible at ${name}.${baseDomain}</p>
</div>
<p class="footer"><a href="https://chainhost.online" target="_blank">chainhost.online</a> · <a href="https://github.com/jefdiesel/chainhost" target="_blank">GitHub</a></p>
</div>
</body></html>`;
}

function notFoundPage(name, route) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 - ${name}</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.c{text-align:center;padding:40px}
h1{font-size:4rem;color:#C3FF00}
p{color:#888;margin:1rem 0}
code{background:#111;padding:4px 8px;border-radius:4px;border:1px solid #333}
a{color:#C3FF00}
</style>
</head><body>
<div class="c">
<h1>404</h1>
<p>Route <code>/${route}</code> not found.</p>
<p><a href="/">← Home</a></p>
</div>
</body></html>`;
}

function contentErrorPage(name, txHash) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error - ${name}</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.c{text-align:center;padding:40px}
h1{font-size:2rem;color:#ff4444}
p{color:#888;margin:1rem 0}
code{background:#111;padding:4px 8px;border-radius:4px;border:1px solid #333;font-size:0.75rem}
</style>
</head><body>
<div class="c">
<h1>Content Error</h1>
<p>Could not load:</p>
<code>${txHash.slice(0, 20)}...</code>
</div>
</body></html>`;
}

function errorPage(msg) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.c{text-align:center;padding:40px}
h1{font-size:2rem;color:#ff4444;margin-bottom:1rem}
p{color:#888}
</style>
</head><body>
<div class="c">
<h1>Error</h1>
<p>${msg}</p>
</div>
</body></html>`;
}

function previousPage(name, owner, history, baseDomain = 'chainhost.online') {
  const short = owner.slice(0, 6) + '...' + owner.slice(-4);

  const historyHtml = history.length > 0
    ? history.map(h => {
        const date = h.timestamp
          ? new Date(h.timestamp * 1000).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric'
            })
          : 'Unknown';
        return `<a href="https://ethscriptions.com/ethscriptions/${h.txHash}" target="_blank" class="item">
          <div class="item-left">
            <span class="route">/${h.route}</span>
            <span class="date">${date}</span>
          </div>
          <span class="tx">${h.txHash.slice(0, 12)}...</span>
        </a>`;
      }).join('')
    : '<p class="empty">No chainhost content found.</p>';

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Previous - ${name}</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;padding:60px 20px}
.container{max-width:600px;margin:0 auto}
h1{font-size:2rem;margin-bottom:0.5rem}
.owner{font-family:monospace;color:#C3FF00;font-size:0.875rem;margin-bottom:2rem}
.history{display:flex;flex-direction:column;gap:8px}
.item{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#111;border:1px solid #222;border-radius:8px;text-decoration:none;transition:border-color 0.2s}
.item:hover{border-color:#C3FF00}
.item-left{display:flex;flex-direction:column;gap:2px}
.route{color:#fff;font-weight:500}
.date{color:#555;font-size:0.75rem}
.tx{color:#C3FF00;font-family:monospace;font-size:0.75rem}
.empty{color:#555;text-align:center;padding:40px}
.back{display:inline-block;margin-top:2rem;color:#888;text-decoration:none}
.back:hover{color:#C3FF00}
.note{color:#444;font-size:0.75rem;margin-top:1rem;text-align:center}
</style>
</head><body>
<div class="container">
<h1>${name}</h1>
<div class="owner">${short}</div>
<h2 style="color:#888;font-size:0.875rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:1rem">Chainhost History</h2>
<div class="history">${historyHtml}</div>
<p class="note">Only showing content linked via chainhost manifests</p>
<a href="/" class="back">← Back to site</a>
</div>
</body></html>`;
}

function rpcLandingPage(name, config, baseDomain = 'chainhost.online') {
  const endpoint = `https://${name}.${baseDomain}`;
  const minified = `(function(C){const B='${endpoint}';window.RPC={call:async(m,p)=>{let r=await fetch(B,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})});let d=await r.json();return d.error?null:d.result;}};})();`;

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${config.name} RPC - ${name}.${baseDomain}</title>
<link rel="icon" href="${FAVICON}">
<meta property="og:title" content="${config.name} RPC Proxy">
<meta property="og:description" content="Free JSON-RPC proxy for ${config.name} (Chain ID: ${config.chainId}) with automatic failover. Powered by ChainHost.">
<meta property="og:url" content="${endpoint}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#000;color:#e8e8e8;min-height:100vh;line-height:1.7}
.header{padding:60px 20px;text-align:center;border-bottom:1px solid #222}
h1{font-size:2rem;font-weight:bold;margin-bottom:0.5rem}
h1 .hi{color:#C3FF00}
.tag{color:#888;font-size:1rem}
.chain{font-family:monospace;color:#C3FF00;background:#111;border:1px solid #333;padding:4px 12px;border-radius:6px;font-size:0.875rem;display:inline-block;margin-top:1rem}
main{max-width:700px;margin:0 auto;padding:40px 20px}
h2{color:#C3FF00;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:2.5rem 0 1rem}
h2:first-of-type{margin-top:0}
p{color:#aaa;margin-bottom:1rem;font-size:0.9rem}
.box{background:#0a0a0a;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:1rem}
pre{background:#111;border:1px solid #333;border-radius:8px;padding:16px;overflow-x:auto;font-size:0.8rem;color:#C3FF00;line-height:1.5}
code{background:#111;border:1px solid #333;padding:2px 8px;border-radius:4px;font-size:0.8rem;color:#C3FF00}
.endpoints{display:flex;flex-direction:column;gap:8px}
.ep{padding:10px 16px;background:#111;border:1px solid #222;border-radius:8px;font-family:monospace;font-size:0.8rem;color:#888}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:1rem 0}
.feat div{padding:10px 14px;background:#0a0a0a;border:1px solid #222;border-radius:8px;font-size:0.8rem;color:#888}
.feat div span{color:#C3FF00;margin-right:6px}
footer{text-align:center;padding:40px 20px;border-top:1px solid #222;color:#444;font-size:0.8rem}
footer a{color:#C3FF00;text-decoration:none}
</style>
</head><body>
<header class="header">
<h1><span class="hi">${config.name}</span> RPC</h1>
<p class="tag">Free JSON-RPC proxy with automatic failover</p>
<div class="chain">Chain ID: ${config.chainId}</div>
</header>
<main>
<h2>Endpoint</h2>
<div class="box">
<pre>POST ${endpoint}</pre>
<p style="margin-top:12px;margin-bottom:0;font-size:0.8rem">Send standard JSON-RPC requests. Failover between backends is handled server-side.</p>
</div>

<h2>Drop-in Module (~250 bytes)</h2>
<div class="box">
<pre>${minified}</pre>
<p style="margin-top:12px;margin-bottom:0;font-size:0.8rem">Paste into any HTML inscription. Then use: <code>RPC.call('eth_blockNumber',[])</code></p>
</div>

<h2>Usage</h2>
<div class="box">
<pre>// Get block number
RPC.call('eth_blockNumber', []).then(console.log);

// Call a contract
RPC.call('eth_call', [{to: '0x...', data: '0x...'}, 'latest'])
  .then(console.log);

// Get balance
RPC.call('eth_getBalance', ['0x...', 'latest'])
  .then(console.log);

// Or use fetch directly:
fetch('${endpoint}', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    jsonrpc: '2.0', id: 1,
    method: 'eth_blockNumber', params: []
  })
}).then(r => r.json()).then(console.log);</pre>
</div>

<h2>Backend Endpoints</h2>
<div class="endpoints">
${config.rpcs.map(r => `<div class="ep">${r}</div>`).join('\n')}
</div>

<h2>Features</h2>
<div class="feat">
<div><span>+</span>Server-side failover</div>
<div><span>+</span>CORS enabled</div>
<div><span>+</span>No API key needed</div>
<div><span>+</span>Edge network (CF)</div>
<div><span>+</span>~250 byte client</div>
<div><span>+</span>On-chain identity</div>
</div>

<h2>All Chains</h2>
<div class="endpoints">
${Object.entries(RPC_PROXY_MAP).map(([n, c]) => `<a href="https://${n}.${baseDomain}" style="padding:10px 16px;background:${n === name ? '#111' : '#0a0a0a'};border:1px solid ${n === name ? '#C3FF00' : '#222'};border-radius:8px;font-size:0.8rem;color:#888;text-decoration:none;display:flex;justify-content:space-between"><span style="color:#fff">${c.name}</span><span style="color:#555">${n}.${baseDomain}</span></a>`).join('\n')}
</div>
</main>
<footer>
<p>Powered by <a href="https://chainhost.online">ChainHost</a> &middot; Names are <a href="https://ethscriptions.com">Ethscriptions</a></p>
</footer>
</body></html>`;
}

function recoveryPage(name, owner, baseDomain = 'chainhost.online') {
  const short = owner.slice(0, 6) + '...' + owner.slice(-4);

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recovery - ${name}</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;padding:40px 20px}
.container{max-width:640px;margin:0 auto}
h1{font-size:2rem;margin-bottom:0.5rem;text-align:center}
.owner{font-family:monospace;color:#C3FF00;font-size:0.875rem;margin-bottom:2rem;text-align:center}
h2{color:#C3FF00;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin:2rem 0 1rem}
.section{background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:1rem}
.section p{color:#888;font-size:0.875rem;line-height:1.6;margin-bottom:0.5rem}
.section p:last-child{margin-bottom:0}
.highlight{color:#C3FF00}
.steps{display:flex;flex-direction:column;gap:12px}
.step{display:flex;gap:12px;align-items:flex-start}
.num{width:24px;height:24px;background:#C3FF00;color:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;flex-shrink:0}
.step-content{flex:1}
.step-content strong{color:#fff;display:block;margin-bottom:2px}
.step-content span{color:#666;font-size:0.8rem}
code{background:#000;border:1px solid #333;padding:2px 6px;border-radius:4px;font-size:0.8rem;color:#C3FF00}
.links{display:flex;flex-direction:column;gap:8px;margin-top:1rem}
.link{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0a0a0a;border:1px solid #222;border-radius:8px;color:#fff;text-decoration:none;transition:all 0.2s}
.link:hover{border-color:#C3FF00}
.link span{color:#C3FF00;font-size:0.75rem}
.back{display:inline-block;margin-top:2rem;color:#888;text-decoration:none;text-align:center;width:100%}
.back:hover{color:#C3FF00}
</style>
</head><body>
<div class="container">
<h1>Recovery</h1>
<div class="owner">${short}</div>

<h2>Your Data is Safe</h2>
<div class="section">
<p><span class="highlight">Your content lives forever on Ethereum.</span> Even if chainhost.online disappears, your site can be recovered by anyone with the open-source resolver.</p>
<p>Everything is on-chain: your name ownership (<code>data:,${name}</code>), your HTML content, and your manifest linking them together.</p>
</div>

<h2>Self-Host in 4 Steps</h2>
<div class="section">
<div class="steps">
  <div class="step">
    <div class="num">1</div>
    <div class="step-content">
      <strong>Clone the repo</strong>
      <span><code>git clone ${GIT_REPO}</code></span>
    </div>
  </div>
  <div class="step">
    <div class="num">2</div>
    <div class="step-content">
      <strong>Create a Cloudflare account</strong>
      <span>Free tier supports 100 workers, 100k requests/day</span>
    </div>
  </div>
  <div class="step">
    <div class="num">3</div>
    <div class="step-content">
      <strong>Deploy the worker</strong>
      <span><code>cd cloudflare-worker && npx wrangler deploy</code></span>
    </div>
  </div>
  <div class="step">
    <div class="num">4</div>
    <div class="step-content">
      <strong>Add your domain</strong>
      <span>Point <code>*.yourdomain.com</code> to the worker in CF dashboard</span>
    </div>
  </div>
</div>
</div>

<h2>Direct Access</h2>
<div class="section">
<p>You can always access your raw content directly on Etherscan or via any Ethereum RPC. The tx hash in your manifest points to the calldata containing your HTML.</p>
<div class="links">
  <a href="${GIT_REPO}" target="_blank" class="link">
    GitHub Repository
    <span>→</span>
  </a>
  <a href="https://ethscriptions.com/${owner}" target="_blank" class="link">
    Your Ethscriptions
    <span>→</span>
  </a>
  <a href="https://etherscan.io/address/${owner}" target="_blank" class="link">
    Etherscan Transactions
    <span>→</span>
  </a>
</div>
</div>

<a href="/" class="back">← Back to site</a>
</div>
</body></html>`;
}

// ============ Bonding Curve Token Helpers ============

async function getBondingToken(name) {
  try {
    const selector = '0x7ffd503c';
    const nameHex = Array.from(new TextEncoder().encode(name)).map(b => b.toString(16).padStart(2, '0')).join('');
    const nameLen = name.length;
    const offset = '0000000000000000000000000000000000000000000000000000000000000020';
    const length = nameLen.toString(16).padStart(64, '0');
    const paddedName = nameHex.padEnd(64, '0');
    const data = selector + offset + length + paddedName;
    const res = await fetch(ETH_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: BONDING_FACTORY, data }, 'latest'] }),
    });
    const result = await res.json();
    if (result.result && result.result !== '0x' + '0'.repeat(64)) {
      const addr = '0x' + result.result.slice(26);
      if (addr !== '0x0000000000000000000000000000000000000000') return addr;
    }
  } catch (e) { console.error('getBondingToken error:', e); }
  return null;
}

function bondingTradePage(name, tokenAddr, baseDomain) {
  const esc = escapeXml(name);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>$${esc} - bonding curve</title>
<link rel="icon" href="${FAVICON}">
<meta property="og:title" content="$${esc}">
<meta property="og:description" content="Buy and sell $${esc} on a bonding curve. Migrates to Uniswap V2 at 69%. LP burned. Use at your own risk.">
<meta property="og:url" content="https://${esc}.${baseDomain}">
<meta property="og:image" content="https://${esc}.${baseDomain}/_og/${esc}.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://${esc}.${baseDomain}/_og/${esc}.png">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a0f;--card:#12121a;--border:#1e1e2e;--text:#e0e0e0;--dim:#666;--accent:#c3ff00;--green:#00b894;--red:#d63031}
body{font-family:'SF Mono',Monaco,Consolas,monospace;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:2rem 1rem}
.c{max-width:480px;width:100%}
h1{font-size:1.8rem;text-align:center;margin-bottom:.25rem;color:var(--accent)}
.sub{text-align:center;color:var(--dim);font-size:.8rem;margin-bottom:2rem}
.cd{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1rem}
.cd h2{font-size:.85rem;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem}
.sr{display:flex;justify-content:space-between;padding:.35rem 0;font-size:.85rem}
.sl{color:var(--dim)}.sv{font-weight:600}
.pb{font-size:1.6rem;font-weight:700;text-align:center;padding:.5rem 0}
.pu{font-size:.8rem;color:var(--dim);font-weight:400}
canvas{width:100%;height:200px;display:block;margin:.5rem 0;border-radius:8px}
.chtabs{display:flex;gap:.5rem;margin-bottom:.5rem}.chtab{background:none;border:1px solid var(--border);border-radius:6px;padding:.3rem .7rem;color:var(--dim);cursor:pointer;font-size:.75rem;font-family:inherit}.chtab.a{background:var(--accent);color:#000;border-color:var(--accent)}
.tf{display:flex;gap:.35rem;margin-bottom:.5rem}.tfb{background:none;border:1px solid var(--border);border-radius:4px;padding:.2rem .5rem;color:var(--dim);cursor:pointer;font-size:.7rem;font-family:inherit}.tfb.a{color:var(--accent);border-color:var(--accent)}
.ch-loading{text-align:center;color:var(--dim);font-size:.75rem;padding:2rem 0}
.tabs{display:flex;margin-bottom:1rem;border-radius:8px;overflow:hidden;border:1px solid var(--border)}
.tab{flex:1;padding:.6rem;text-align:center;cursor:pointer;font-size:.85rem;font-weight:600;background:var(--card);border:none;color:var(--dim);font-family:inherit;transition:.15s}
.tab.a{background:var(--accent);color:#000}.tab:hover:not(.a){background:#1a1a2e}
.ig{margin-bottom:1rem}
.ig label{display:block;font-size:.75rem;color:var(--dim);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.04em}
.ir{display:flex;gap:.5rem;align-items:center}
.ir input{flex:1;background:#0d0d15;border:1px solid var(--border);border-radius:8px;padding:.65rem .85rem;color:var(--text);font-size:1rem;font-family:inherit;outline:none}
.ir input:focus{border-color:var(--accent)}
.mx{background:var(--border);border:none;border-radius:6px;padding:.45rem .75rem;color:var(--text);cursor:pointer;font-size:.75rem;font-family:inherit}
.mx:hover{background:var(--accent);color:#000}
.cp{background:#0d0d15;border-radius:8px;padding:.75rem;margin-bottom:1rem;font-size:.8rem}
.cp .rw{display:flex;justify-content:space-between;padding:.2rem 0}
.cp .tt{border-top:1px solid var(--border);margin-top:.3rem;padding-top:.4rem;font-weight:700}
.bt{width:100%;padding:.75rem;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;transition:.15s}
.bt:hover{opacity:.85;transform:translateY(-1px)}.bt:disabled{opacity:.4;cursor:not-allowed;transform:none}
.bb{background:var(--green);color:#000}.bs{background:var(--red);color:#fff}
.cn{background:var(--accent);color:#000;margin-bottom:1rem}
.wi{text-align:center;font-size:.8rem;color:var(--dim);margin-bottom:1rem}
.wi .ad{color:var(--accent)}.wi .bl{color:var(--green)}
.pg{height:6px;background:#1a1a2e;border-radius:3px;overflow:hidden;margin:.5rem 0}
.pf{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent));border-radius:3px;transition:width .3s}
.ts{text-align:center;padding:.75rem;border-radius:8px;font-size:.85rem;margin-top:.75rem;display:none}
.ts.pe{display:block;background:#1a1a2e;color:var(--dim)}
.ts.ok{display:block;background:#00b89422;color:var(--green)}
.ts.er{display:block;background:#d6303122;color:var(--red)}
.migrated-banner{background:var(--accent);color:#000;text-align:center;padding:1rem;border-radius:12px;margin-bottom:1rem;font-weight:700}
.migrated-banner a{color:#000;text-decoration:underline}
.ft{text-align:center;color:var(--dim);font-size:.7rem;margin-top:2rem}.ft a{color:var(--accent);text-decoration:none}
.info{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1rem;font-size:.8rem;color:var(--dim);line-height:1.6}
.info h2{font-size:.85rem;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem}
.info ul{list-style:none;padding:0}.info li{padding:.25rem 0}.info li::before{content:"·";color:var(--accent);margin-right:.5rem;font-weight:700}
.info .warn{color:#c3ff00;font-weight:600;margin-top:.75rem;padding-top:.5rem;border-top:1px solid var(--border)}
</style>
</head>
<body>
<div class="c">
<h1>$` + esc + `</h1>
<p class="sub">bonding curve</p>
<button class="bt cn" id="cb" onclick="cw()">Connect Wallet</button>
<div class="wi" id="wf" style="display:none"><span class="ad" id="wa"></span></div>
<div class="wi" id="token-bal-wrap" style="display:none"><span class="bl" id="wb">0</span> tokens</div>
<div id="migrated-msg" class="migrated-banner" style="display:none">
Migrated! <a id="uni-link" href="#" target="_blank">Trade on Uniswap</a>
</div>
<div class="cd"><h2>Price</h2>
<div class="pb" id="sp">... <span class="pu">ETH</span></div>
<div class="sr"><span class="sl">Supply</span><span class="sv"><span id="cs">0</span> / <span id="ms">0</span></span></div>
<div class="pg"><div class="pf" id="sb" style="width:0%"></div></div>
<div class="sr"><span class="sl">Reserve</span><span class="sv" id="rv">0 ETH</span></div>
<div class="sr"><span class="sl">Curve</span><span class="sv">x<sup>1.5</sup></span></div></div>
<div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><h2 style="margin:0">Chart</h2><div class="chtabs"><button class="chtab" id="cht-curve" onclick="switchChart('curve')">Curve</button><button class="chtab a" id="cht-candle" onclick="switchChart('candle')">Candles</button></div></div>
<div id="curve-wrap" style="display:none"><canvas id="cc" height="200"></canvas></div>
<div id="candle-wrap"><div class="tf"><button class="tfb" onclick="setTf(300)">5m</button><button class="tfb a" onclick="setTf(3600)">1h</button><button class="tfb" onclick="setTf(14400)">4h</button><button class="tfb" onclick="setTf(86400)">1d</button></div><div id="candle-tv" style="height:260px"></div><div class="ch-loading" id="candle-load">Loading trades...</div></div></div>
<div class="info"><h2>How it works</h2><ul>
<li>Migrates to <b style="color:var(--text)">Uniswap V2</b> at 69% supply sold</li>
<li>0.69% fee on sells during bonding phase</li>
<li>LP tokens are <b style="color:var(--text)">burned</b> at migration &mdash; no rug pulls</li>
<li>Polynomial curve: price = basePrice &times; (supply/max)<sup>1.5</sup></li>
</ul><p class="warn">Use at your own risk. FAFO. Have fun.</p></div>
<div class="cd" id="trade-card">
<div class="tabs"><button class="tab a" id="tb" onclick="sm('b')">Buy</button><button class="tab" id="ts2" onclick="sm('s')">Sell</button></div>
<div class="ig"><label>Amount ($` + esc + `)</label>
<div class="ir"><input type="number" id="am" placeholder="0" min="0" oninput="up()"><button class="mx" onclick="mx()">MAX</button></div></div>
<div class="cp"><div class="rw"><span>Avg price</span><span id="ap">&mdash;</span></div>
<div class="rw"><span>Slippage</span><span id="slp">&mdash;</span></div>
<div class="rw tt"><span id="cl">Total cost</span><span id="tc">&mdash;</span></div></div>
<button class="bt bb" id="ab" onclick="ex()" disabled>Enter amount</button>
<div class="ts" id="tx"></div></div>
<div class="ft">powered by smart contracts · <a href="https://chainhost.online/mint/">launch your own</a></div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.1/ethers.umd.min.js"><\/script>
<script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"><\/script>
<script>
const TOKEN_ADDRESS="${tokenAddr}";
const TICK="${esc}";
const TOKEN_ABI=[
"function name() view returns (string)",
"function totalSupply() view returns (uint256)",
"function maxSupply() view returns (uint256)",
"function basePrice() view returns (uint256)",
"function balanceOf(address) view returns (uint256)",
"function getPrice() view returns (uint256)",
"function getBuyCost(uint256) view returns (uint256)",
"function getSellProceeds(uint256) view returns (uint256)",
"function migrated() view returns (bool)",
"function buy(uint256 amount) payable",
"function sell(uint256 amount, uint256 minEth)"
];
var md="b",provider=null,signer=null,token=null,tokenW=null;
var userBal=0n,curSupply=0n,maxSupply=0n,basePrice=0n,isMigrated=false;
function gp(s,M,B){return B*Math.pow(s/M,1.5)}
async function cw(){
if(!window.ethereum){alert("No wallet detected.");return}
provider=new ethers.BrowserProvider(window.ethereum);
signer=await provider.getSigner();
var addr=await signer.getAddress();
document.getElementById("cb").style.display="none";
document.getElementById("wf").style.display="block";
document.getElementById("wa").textContent=addr.slice(0,6)+"\\u2026"+addr.slice(-4);
token=new ethers.Contract(TOKEN_ADDRESS,TOKEN_ABI,provider);
tokenW=new ethers.Contract(TOKEN_ADDRESS,TOKEN_ABI,signer);
document.getElementById("token-bal-wrap").style.display="block";
await refresh();
}
async function refresh(){
if(!token){var rp=new ethers.JsonRpcProvider("https://ethereum-rpc.publicnode.com");token=new ethers.Contract(TOKEN_ADDRESS,TOKEN_ABI,rp)}
try{var r=await Promise.all([token.totalSupply(),token.getPrice(),token.maxSupply(),token.basePrice(),token.migrated()]);
var bal=0n;if(signer)bal=await token.balanceOf(await signer.getAddress());
curSupply=r[0];maxSupply=r[2];basePrice=r[3];userBal=bal;isMigrated=r[4];
var sN=Number(ethers.formatEther(r[0])),mN=Number(ethers.formatEther(r[2])),pE=Number(ethers.formatEther(r[1]));
document.getElementById("sp").innerHTML=pE.toFixed(10)+' <span class="pu">ETH</span>';
document.getElementById("cs").textContent=Math.floor(sN).toLocaleString();
document.getElementById("ms").textContent=Math.floor(mN).toLocaleString();
document.getElementById("wb").textContent=Math.floor(Number(ethers.formatEther(bal))).toLocaleString();
document.getElementById("sb").style.width=(sN/mN*100)+"%";
try{var rv=await(provider||new ethers.JsonRpcProvider("https://ethereum-rpc.publicnode.com")).getBalance(TOKEN_ADDRESS);
document.getElementById("rv").textContent=Number(ethers.formatEther(rv)).toFixed(6)+" ETH"}catch(e){}
if(isMigrated){document.getElementById("migrated-msg").style.display="block";document.getElementById("trade-card").style.display="none";
document.getElementById("uni-link").href="https://app.uniswap.org/#/swap?outputCurrency="+TOKEN_ADDRESS}
dc(sN,mN,Number(ethers.formatEther(r[3])));
if(!tradeData)loadTrades();
}catch(e){console.error("refresh",e)}
}
function sm(m){md=m;document.getElementById("tb").className=m==="b"?"tab a":"tab";document.getElementById("ts2").className=m==="s"?"tab a":"tab";
document.getElementById("ab").className=m==="b"?"bt bb":"bt bs";document.getElementById("cl").textContent=m==="b"?"Total cost":"You receive";up()}
function mx(){if(md==="s"){document.getElementById("am").value=Math.floor(Number(ethers.formatEther(userBal)))}
else{var mN=Number(ethers.formatEther(maxSupply)),cN=Number(ethers.formatEther(curSupply));document.getElementById("am").value=Math.floor(Math.max(0,mN*0.69-cN))}up()}
async function up(){var a=parseFloat(document.getElementById("am").value)||0,b=document.getElementById("ab");
if(a<=0||!token){document.getElementById("ap").textContent="\\u2014";document.getElementById("slp").textContent="\\u2014";document.getElementById("tc").textContent="\\u2014";b.disabled=true;b.textContent="Enter amount";return}
try{var w=ethers.parseEther(String(a));
if(md==="b"){var c=await token.getBuyCost(w),cE=Number(ethers.formatEther(c));document.getElementById("ap").textContent=(cE/a).toFixed(10)+" ETH";
document.getElementById("slp").textContent="~1%";document.getElementById("tc").textContent=cE.toFixed(8)+" ETH";b.disabled=!signer;b.textContent=signer?"Buy "+a.toLocaleString()+" $"+TICK:"Connect wallet"}
else{var p=await token.getSellProceeds(w),pE=Number(ethers.formatEther(p));document.getElementById("ap").textContent=(pE/a).toFixed(10)+" ETH";
document.getElementById("slp").textContent="~1%";document.getElementById("tc").textContent=pE.toFixed(8)+" ETH";b.disabled=!signer;b.textContent=signer?"Sell "+a.toLocaleString()+" $"+TICK:"Connect wallet"}
}catch(e){b.disabled=true;b.textContent="Invalid amount"}}
async function ex(){var a=parseFloat(document.getElementById("am").value);if(!a||!tokenW)return;
var st=document.getElementById("tx");st.className="ts pe";st.style.display="block";st.textContent="Waiting for wallet...";
try{var w=ethers.parseEther(String(a)),tx;
if(md==="b"){var c=await token.getBuyCost(w);tx=await tokenW.buy(w,{value:c*101n/100n})}
else{var p=await token.getSellProceeds(w);tx=await tokenW.sell(w,p*99n/100n)}
st.className="ts pe";st.textContent="Confirming...";await tx.wait();
st.className="ts ok";st.innerHTML="\\u2713 Done! <a href='https://etherscan.io/tx/"+tx.hash+"' target='_blank' style='color:var(--green)'>"+tx.hash.slice(0,18)+"\\u2026</a>";
document.getElementById("am").value="";await refresh();up();
}catch(e){st.className="ts er";st.textContent="\\u2717 "+(e.reason||e.message||"Rejected")}}
function dc(sN,mN,bp){sN=sN||0;mN=mN||1;bp=bp||1;var cv=document.getElementById("cc"),cx=cv.getContext("2d");
var d=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;cv.width=W*d;cv.height=H*d;cx.scale(d,d);cx.clearRect(0,0,W,H);
cx.strokeStyle="#1e1e2e";cx.lineWidth=1;for(var i=0;i<=4;i++){var y=H/4*i;cx.beginPath();cx.moveTo(0,y);cx.lineTo(W,y);cx.stroke()}
cx.beginPath();cx.strokeStyle="#c3ff00";cx.lineWidth=2;var mP=gp(mN,mN,bp);
for(var i=0;i<=200;i++){var s=mN/200*i,p=gp(s,mN,bp),x=i/200*W,y2=H-(p/mP)*(H-10)-5;i===0?cx.moveTo(x,y2):cx.lineTo(x,y2)}cx.stroke();
var sp=sN/mN;cx.beginPath();cx.fillStyle="#c3ff0022";
for(var i=0;i<=Math.floor(sp*200);i++){var s=mN/200*i,p=gp(s,mN,bp),x=i/200*W,y2=H-(p/mP)*(H-10)-5;i===0?(cx.moveTo(x,H),cx.lineTo(x,y2)):cx.lineTo(x,y2)}
cx.lineTo(sp*W,H);cx.closePath();cx.fill();
if(sN>0){var cx2=sp*W,cy=H-(gp(sN,mN,bp)/mP)*(H-10)-5;cx.beginPath();cx.arc(cx2,cy,5,0,Math.PI*2);cx.fillStyle="#c3ff00";cx.fill();cx.strokeStyle="#fff";cx.lineWidth=2;cx.stroke()}}
var chartMode="candle",candleTf=3600,tradeData=null,tvChart=null,tvSeries=null;
function switchChart(m){chartMode=m;document.getElementById("cht-curve").className=m==="curve"?"chtab a":"chtab";document.getElementById("cht-candle").className=m==="candle"?"chtab a":"chtab";document.getElementById("curve-wrap").style.display=m==="curve"?"block":"none";document.getElementById("candle-wrap").style.display=m==="candle"?"block":"none";if(m==="candle"){if(!tradeData)loadTrades();if(tvChart)tvChart.resize(document.getElementById("candle-tv").clientWidth,260)}}
function setTf(t){candleTf=t;document.querySelectorAll(".tfb").forEach(function(b){var m={"5m":300,"1h":3600,"4h":14400,"1d":86400};b.className=(m[b.textContent]||0)===t?"tfb a":"tfb"});if(tradeData)drawCandles()}
async function loadTrades(){
var el=document.getElementById("candle-load");el.style.display="block";el.textContent="Loading trades...";
try{
var rpc=provider||new ethers.JsonRpcProvider("https://ethereum-rpc.publicnode.com");
var tc=new ethers.Contract(TOKEN_ADDRESS,[...TOKEN_ABI,"event Transfer(address indexed from,address indexed to,uint256 value)"],rpc);
if(!maxSupply||!basePrice){var r=await Promise.all([tc.maxSupply(),tc.basePrice()]);maxSupply=r[0];basePrice=r[1]}
var bn=await rpc.getBlockNumber();
var fromBlock=Math.max(0,bn-200000);
var logs=[];
var chunkSize=10000;
for(var start=fromBlock;start<=bn;start+=chunkSize){
var end=Math.min(start+chunkSize-1,bn);
try{var chunk=await tc.queryFilter("Transfer",start,end);logs=logs.concat(chunk)}catch(e2){
try{var half=Math.floor((end-start)/2);var c1=await tc.queryFilter("Transfer",start,start+half);var c2=await tc.queryFilter("Transfer",start+half+1,end);logs=logs.concat(c1,c2)}catch(e3){console.error("chunk fail",start,end,e3)}
}}
if(!logs.length){el.textContent="No trades yet";return}
var blocks={};var trades=[];
for(var i=0;i<logs.length;i+=20){
var batch=logs.slice(i,i+20);
var needed=batch.filter(function(l){return!blocks[l.blockNumber]}).map(function(l){return l.blockNumber});
var unique=[...new Set(needed)];
if(unique.length){var results=await Promise.all(unique.map(function(b){return rpc.getBlock(b)}));
results.forEach(function(b){if(b)blocks[b.number]=b.timestamp})}
}
var ZERO="0x0000000000000000000000000000000000000000";
var runSupply=0;
var mN2=Number(ethers.formatEther(maxSupply)),bp2=Number(ethers.formatEther(basePrice));
for(var i=0;i<logs.length;i++){
var l=logs[i];var from=l.args[0],to=l.args[1],val=Number(ethers.formatEther(l.args[2]));
var isBuy=from===ZERO,isSell=to===ZERO;
if(isBuy)runSupply+=val;
else if(isSell)runSupply-=val;
else continue;
var price=gp(Math.max(0,runSupply),mN2,bp2);
trades.push({t:blocks[l.blockNumber]||0,p:price,buy:isBuy,vol:val})
}
tradeData=trades;
el.style.display="none";
drawCandles()
}catch(e){console.error("loadTrades",e);el.textContent="Failed to load trades"}}
function drawCandles(){
if(!tradeData||!tradeData.length)return;
var tf=candleTf,trades=tradeData;
var buckets={};
trades.forEach(function(tr){var k=Math.floor(tr.t/tf)*tf;if(!buckets[k])buckets[k]={o:tr.p,h:tr.p,l:tr.p,c:tr.p};else{var b=buckets[k];b.h=Math.max(b.h,tr.p);b.l=Math.min(b.l,tr.p);b.c=tr.p}});
var keys=Object.keys(buckets).map(Number).sort();
if(!keys.length)return;
var minT=keys[0],maxT=keys[keys.length-1];
var filled=[];var prevC=buckets[keys[0]].o;
for(var t=minT;t<=maxT;t+=tf){if(buckets[t])filled.push({time:t,open:buckets[t].o,high:buckets[t].h,low:buckets[t].l,close:buckets[t].c});else filled.push({time:t,open:prevC,high:prevC,low:prevC,close:prevC});prevC=filled[filled.length-1].close}
var el=document.getElementById("candle-tv");
if(tvChart){tvChart.remove();tvChart=null}
tvChart=LightweightCharts.createChart(el,{width:el.clientWidth,height:260,
layout:{background:{type:"solid",color:"#12121a"},textColor:"#666",fontFamily:"'SF Mono',Monaco,Consolas,monospace",fontSize:11},
grid:{vertLines:{color:"#1e1e2e"},horzLines:{color:"#1e1e2e"}},
crosshair:{mode:0},
timeScale:{borderColor:"#1e1e2e",timeVisible:true,secondsVisible:false},
rightPriceScale:{borderColor:"#1e1e2e"}});
tvSeries=tvChart.addCandlestickSeries({upColor:"#00b894",downColor:"#d63031",borderUpColor:"#00b894",borderDownColor:"#d63031",wickUpColor:"#00b894",wickDownColor:"#d63031"});
tvSeries.setData(filled);
tvChart.timeScale().fitContent()
}
refresh();
<\/script>
</body></html>`;
}
