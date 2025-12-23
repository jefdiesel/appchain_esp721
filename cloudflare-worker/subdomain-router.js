/**
 * Cloudflare Worker: Chainhost Registry Router
 *
 * Routes:
 *   / or /home  → user's home page from manifest
 *   /about      → user's about page from manifest
 *   /previous   → auto-generated history page
 *   /recovery   → universal recovery page with git link
 *   /sw.js      → service worker
 */

const ETHSCRIPTIONS_API = 'https://api.ethscriptions.com/v2';
const BASE_RPC = 'https://mainnet.base.org';
const ETH_RPC = 'https://eth.llamarpc.com';
const GIT_REPO = 'https://github.com/jefdiesel/chainhost';
const FAVICON = 'https://chainhost.online/favicon.png';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const path = url.pathname;

    // Extract subdomain
    const parts = hostname.split('.');
    if (parts.length < 3 || parts[parts.length - 2] !== 'chainhost') {
      return new Response('Invalid hostname', { status: 400 });
    }

    const name = parts[0].toLowerCase();

    // Skip reserved subdomains
    const reserved = ['www', 'api', 'app', 'dashboard', 'admin', 'mail', 'ftp'];
    if (reserved.includes(name)) {
      return Response.redirect('https://chainhost.online' + path, 302);
    }

    try {
      // 1. Check if name is claimed (data:,name exists)
      const nameSha = await sha256(`data:,${name}`);
      const nameRes = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/exists/0x${nameSha}`);
      const nameData = await nameRes.json();

      if (!nameData.result?.exists) {
        return new Response(notClaimedPage(name), {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const owner = nameData.result.ethscription.current_owner;

      // 2. Handle special routes
      if (path === '/recovery') {
        return new Response(recoveryPage(name, owner), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      if (path === '/previous') {
        const history = await getInscriptionHistory(owner, name);
        return new Response(previousPage(name, owner, history), {
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

      // 3. Find owner's chainhost manifest for this specific name
      const manifest = await findManifest(owner, name);

      if (!manifest) {
        return new Response(noManifestPage(name, owner), {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // 4. Resolve route
      const route = path === '/' || path === '' ? 'home' : path.slice(1);
      const txHash = manifest[route];

      if (!txHash) {
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
        const html = imagePageHtml(name, rawContent.dataUri, txHash, pixelArt, manifest);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // 6. For HTML, inject footer (if </body> exists)
      let content = rawContent.decoded || rawContent.dataUri || '';
      content = injectFooter(content, name, manifest);

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
};

// ============ Helpers ============

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

async function findManifest(owner, name) {
  try {
    const res = await fetch(
      `${ETHSCRIPTIONS_API}/ethscriptions?current_owner=${owner}&mime_subtype=json&per_page=50`
    );
    const data = await res.json();

    if (!data.result?.length) return null;

    // First pass: look for name-specific manifests (new format)
    for (const eth of data.result) {
      try {
        const content = await fetchEthscriptionContent(eth.transaction_hash);
        if (content) {
          const parsed = JSON.parse(content);
          // New format: {"chainhost": {"degenjef": {"home": "0x..."}}}
          if (parsed.chainhost && parsed.chainhost[name]) {
            return parsed.chainhost[name];
          }
        }
      } catch (e) {
        // Not valid JSON or not chainhost manifest
      }
    }

    // Second pass: fallback to old format (no name key) for backward compatibility
    // Only use if user has a single name or this is their only manifest
    for (const eth of data.result) {
      try {
        const content = await fetchEthscriptionContent(eth.transaction_hash);
        if (content) {
          const parsed = JSON.parse(content);
          // Old format: {"chainhost": {"home": "0x..."}}
          if (parsed.chainhost && parsed.chainhost.home && !Object.keys(parsed.chainhost).some(k => typeof parsed.chainhost[k] === 'object')) {
            return parsed.chainhost;
          }
        }
      } catch (e) {
        // Not valid JSON or not chainhost manifest
      }
    }

    return null;
  } catch (e) {
    console.error('Manifest lookup error:', e);
    return null;
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

function imagePageHtml(name, dataUri, txHash, pixelArt, manifest) {
  const hasAbout = !!manifest.about;

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<link rel="icon" href="${FAVICON}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;padding-bottom:60px}
img{
  ${pixelArt ? 'image-rendering:pixelated;image-rendering:crisp-edges;' : ''}
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

function injectFooter(html, name, manifest) {
  const hasAbout = !!manifest.about;

  const footer = `
<nav id="chainhost-footer" style="position:fixed;bottom:0;left:0;right:0;background:#000;border-top:1px solid #333;padding:10px 20px;display:flex;justify-content:center;align-items:center;gap:24px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;z-index:99999">
  ${hasAbout ? `<a href="/about" style="color:#888;text-decoration:none;transition:color 0.2s" onmouseover="this.style.color='#C3FF00'" onmouseout="this.style.color='#888'">About</a>` : ''}
  <a href="/previous" style="color:#888;text-decoration:none;transition:color 0.2s" onmouseover="this.style.color='#C3FF00'" onmouseout="this.style.color='#888'">Previous</a>
  <a href="/recovery" style="color:#888;text-decoration:none;transition:color 0.2s" onmouseover="this.style.color='#C3FF00'" onmouseout="this.style.color='#888'">Recovery</a>
  <span style="color:#333">|</span>
  <a href="https://chainhost.online" target="_blank" style="color:#555;text-decoration:none;font-size:11px">chainhost</a>
</nav>
</body>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', footer);
  }
  return html; // Skip injection if no </body>
}

// ============ Pages ============

function notClaimedPage(name) {
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
<div class="name">${name}.chainhost.online</div>
<p class="desc">This name isn't claimed yet. Inscribe it on Ethereum and host your site forever—no servers, no renewals, just permanent on-chain hosting.</p>
<a href="https://chainhost.online/register" class="btn">Claim ${name} for Free</a>
<div class="how">
<h3>How it works</h3>
<div class="step"><span class="num">1.</span><span>Connect wallet & inscribe <code style="background:#222;padding:2px 6px;border-radius:4px;color:#C3FF00">data:,${name}</code></span></div>
<div class="step"><span class="num">2.</span><span>Upload your HTML (Ethereum or Base)</span></div>
<div class="step"><span class="num">3.</span><span>Create manifest linking routes to content</span></div>
<div class="step"><span class="num">4.</span><span>Live forever at ${name}.chainhost.online</span></div>
</div>
<p class="footer">Powered by <a href="https://ethscriptions.com" target="_blank">Ethscriptions</a> · <a href="https://github.com/jefdiesel/chainhost" target="_blank">GitHub</a></p>
</div>
</body></html>`;
}

function noManifestPage(name, owner) {
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
<p>Upload your HTML files (home page, about page, etc.) and inscribe them on Ethereum or Base. Then create a manifest to link your routes. Your site will be permanently accessible at ${name}.chainhost.online</p>
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

function previousPage(name, owner, history) {
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

function recoveryPage(name, owner) {
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
