// HTML to Ethereum calldata inscription helper
// Based on LESPISS approach

export function htmlToCalldata(html: string): string {
  // 1. Encode HTML as base64
  const base64 = Buffer.from(html, 'utf-8').toString('base64')

  // 2. Create data URI
  const dataUri = `data:text/html;base64,${base64}`

  // 3. Convert to hex calldata
  const hex =
    '0x' +
    Array.from(dataUri)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')

  return hex
}

export function jsonToCalldata(json: object): string {
  const jsonStr = JSON.stringify(json)
  const dataUri = `data:application/json,${jsonStr}`

  const hex =
    '0x' +
    Array.from(dataUri)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')

  return hex
}

export function calldataToHtml(calldata: string): string {
  // Remove 0x prefix
  const hex = calldata.startsWith('0x') ? calldata.slice(2) : calldata

  // Hex to string
  let decoded = ''
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substr(i, 2), 16)
    if (code) decoded += String.fromCharCode(code)
  }

  // Parse data URI
  if (decoded.startsWith('data:')) {
    const match = decoded.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/)
    if (match) {
      const isBase64 = decoded.includes(';base64,')
      const content = isBase64 ? Buffer.from(match[2], 'base64').toString('utf-8') : match[2]
      return content
    }
  }

  return decoded
}

// Estimate gas for inscription
export function estimateGas(html: string): {
  bytes: number
  gasUnits: number
  estimatedCostUsd: number
} {
  const calldata = htmlToCalldata(html)
  const bytes = (calldata.length - 2) / 2 // Subtract 0x, divide by 2 for hex pairs

  // Gas calculation:
  // - 21000 base tx
  // - 16 gas per non-zero byte
  // - 4 gas per zero byte (rare in base64)
  const gasUnits = 21000 + bytes * 16

  // Estimate at ~20 gwei, ~$3500 ETH
  const ethCost = (gasUnits * 20) / 1e9
  const estimatedCostUsd = ethCost * 3500

  return {
    bytes,
    gasUnits,
    estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
  }
}

// Generate service worker for a site
export function generateServiceWorker(
  walletAddress: string,
  defaultRoutes: Record<string, string> = {}
): string {
  return `// Chainhost Service Worker
// Auto-generated for ${walletAddress}

const MANIFEST_WALLET = '${walletAddress}';
const MANIFEST_PREFIX = '{"chainhost":';
const ETHERSCAN_API_KEY = 'YourApiKeyToken'; // User should replace

const defaultRoutes = ${JSON.stringify(defaultRoutes, null, 2)};

let routes = { ...defaultRoutes };
let lastManifestCheck = 0;
const MANIFEST_CACHE_MS = 5 * 60 * 1000;

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname.slice(1) || 'home';

  if (routes[path]) {
    event.respondWith(serveInscription(routes[path]));
  } else if (path.startsWith('0x') && path.length === 66) {
    event.respondWith(serveInscription(path));
  }
});

async function serveInscription(txHash) {
  try {
    const res = await fetch(
      \`https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=\${txHash}&apikey=\${ETHERSCAN_API_KEY}\`
    );
    const data = await res.json();
    const decoded = decodeCalldata(data.result.input);
    return new Response(decoded.content, {
      headers: { 'Content-Type': decoded.mimeType }
    });
  } catch (err) {
    return new Response('Failed to load inscription', { status: 500 });
  }
}

function decodeCalldata(calldata) {
  const hex = calldata.slice(2);
  let decoded = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substr(i, 2), 16);
    if (code) decoded += String.fromCharCode(code);
  }

  if (decoded.startsWith('data:')) {
    const match = decoded.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
    if (match) {
      const mimeType = match[1] || 'text/html';
      const content = decoded.includes(';base64,') ? atob(match[2]) : match[2];
      return { mimeType, content };
    }
  }

  return { mimeType: 'text/html', content: decoded };
}

// Background manifest refresh
async function refreshManifest() {
  if (Date.now() - lastManifestCheck < MANIFEST_CACHE_MS) return;
  lastManifestCheck = Date.now();

  try {
    const res = await fetch(
      \`https://api.ethscriptions.com/v2/ethscriptions?creator=\${MANIFEST_WALLET}&per_page=50\`
    );
    const data = await res.json();

    for (const eth of data.result) {
      const content = decodeContentUri(eth.content_uri);
      if (content && content.startsWith(MANIFEST_PREFIX)) {
        try {
          routes = { ...defaultRoutes, ...JSON.parse(content).chainhost };
          break;
        } catch (e) { continue; }
      }
    }
  } catch (err) {
    console.error('Manifest refresh failed:', err);
  }
}

function decodeContentUri(uri) {
  if (!uri) return null;
  if (uri.startsWith('data:')) {
    const match = uri.match(/^data:[^,]*,(.*)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }
  return uri;
}

setInterval(refreshManifest, MANIFEST_CACHE_MS);
refreshManifest();
`
}

// Generate bootstrap index.html for a site
export function generateBootstrapHtml(siteName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${siteName}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #000; color: #888; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .loading { text-align: center; }
    .loading p { margin: 8px 0; }
    .spinner { width: 40px; height: 40px; border: 3px solid #222; border-top-color: #C3FF00; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>Loading from Ethereum...</p>
  </div>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        navigator.serviceWorker.ready.then(() => {
          location.reload();
        });
      }).catch(err => {
        document.querySelector('.loading p').textContent = 'Failed to initialize: ' + err.message;
      });
    } else {
      document.querySelector('.loading p').textContent = 'Service workers not supported';
    }
  </script>
</body>
</html>`
}

// Minify HTML (basic - remove whitespace)
export function minifyHtml(html: string): string {
  return html
    .replace(/\n\s*/g, '') // Remove newlines and leading whitespace
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .trim()
}

// Check for problematic characters that break base64
export function validateForInscription(html: string): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check for problematic Unicode
  const problematicChars = [
    { char: '\u2018', name: 'left single quote', replace: "'" },
    { char: '\u2019', name: 'right single quote', replace: "'" },
    { char: '\u201C', name: 'left double quote', replace: '"' },
    { char: '\u201D', name: 'right double quote', replace: '"' },
    { char: '\u2013', name: 'en dash', replace: '-' },
    { char: '\u2014', name: 'em dash', replace: '--' },
    { char: '\u2026', name: 'ellipsis', replace: '...' },
  ]

  problematicChars.forEach(({ char, name }) => {
    if (html.includes(char)) {
      issues.push(`Contains ${name} (${char}) - may cause encoding issues`)
    }
  })

  // Check for emojis (except safe ones)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u
  if (emojiRegex.test(html)) {
    issues.push('Contains emojis - may cause encoding issues. Use inscribed images instead.')
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
