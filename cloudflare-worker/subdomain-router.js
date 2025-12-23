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
const GIT_REPO = 'https://github.com/jefdiesel/chainhost';

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
        const history = await getInscriptionHistory(owner);
        return new Response(previousPage(name, owner, history), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // 3. Find owner's chainhost manifest
      const manifest = await findManifest(owner);

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

      // 5. Fetch content
      let content = await fetchEthscriptionContent(txHash);

      if (!content) {
        return new Response(contentErrorPage(name, txHash), {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // 6. Inject footer (if </body> exists)
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

async function findManifest(owner) {
  try {
    const res = await fetch(
      `${ETHSCRIPTIONS_API}/ethscriptions?current_owner=${owner}&mime_subtype=json&per_page=50`
    );
    const data = await res.json();

    if (!data.result?.length) return null;

    for (const eth of data.result) {
      try {
        const content = await fetchEthscriptionContent(eth.transaction_hash);
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.chainhost) {
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
  try {
    const res = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/${txHash}`);
    const data = await res.json();

    if (!data.result?.content_uri) return null;

    const uri = data.result.content_uri;

    if (uri.startsWith('data:')) {
      const match = uri.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
      if (match) {
        if (uri.includes(';base64,')) return atob(match[2]);
        return decodeURIComponent(match[2]);
      }
    }
    return uri;
  } catch (e) {
    console.error('Content fetch error:', e);
    return null;
  }
}

async function getInscriptionHistory(owner) {
  try {
    // Get owner's HTML ethscriptions (previous versions)
    const res = await fetch(
      `${ETHSCRIPTIONS_API}/ethscriptions?current_owner=${owner}&mime_subtype=html&per_page=20`
    );
    const data = await res.json();

    if (!data.result?.length) return [];

    return data.result.map(eth => ({
      txHash: eth.transaction_hash,
      timestamp: eth.block_timestamp,
      number: eth.ethscription_number,
    }));
  } catch (e) {
    console.error('History lookup error:', e);
    return [];
  }
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
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.c{text-align:center;padding:40px;max-width:400px}
h1{font-size:2.5rem;color:#C3FF00;margin-bottom:0.5rem}
.name{font-family:monospace;background:#111;padding:8px 16px;border-radius:8px;display:inline-block;margin:1rem 0;font-size:1.25rem;border:1px solid #333}
p{color:#888;margin-bottom:1.5rem}
.btn{display:inline-block;background:#C3FF00;color:#000;padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none}
.btn:hover{background:#d4ff4d}
</style>
</head><body>
<div class="c">
<h1>Available</h1>
<div class="name">data:,${name}</div>
<p>Claim this name on Ethscriptions</p>
<a href="https://chainhost.online/register" class="btn">Claim ${name}</a>
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
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.c{text-align:center;padding:40px}
h1{font-size:2rem;margin-bottom:0.5rem}
.owner{font-family:monospace;color:#C3FF00;font-size:0.875rem}
p{color:#888;margin:1.5rem 0}
</style>
</head><body>
<div class="c">
<h1>${name}</h1>
<div class="owner">${short}</div>
<p>No manifest. Upload your site on Chainhost.</p>
</div>
</body></html>`;
}

function notFoundPage(name, route) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 - ${name}</title>
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
        const date = new Date(h.timestamp * 1000).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        return `<a href="https://ethscriptions.com/ethscriptions/${h.txHash}" target="_blank" class="item">
          <span class="date">${date}</span>
          <span class="tx">${h.txHash.slice(0, 16)}...</span>
        </a>`;
      }).join('')
    : '<p class="empty">No previous versions found.</p>';

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Previous - ${name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;padding:60px 20px}
.container{max-width:600px;margin:0 auto}
h1{font-size:2rem;margin-bottom:0.5rem}
.owner{font-family:monospace;color:#C3FF00;font-size:0.875rem;margin-bottom:2rem}
.history{display:flex;flex-direction:column;gap:8px}
.item{display:flex;justify-content:space-between;padding:12px 16px;background:#111;border:1px solid #222;border-radius:8px;text-decoration:none;transition:border-color 0.2s}
.item:hover{border-color:#C3FF00}
.date{color:#888;font-size:0.875rem}
.tx{color:#C3FF00;font-family:monospace;font-size:0.75rem}
.empty{color:#555;text-align:center;padding:40px}
.back{display:inline-block;margin-top:2rem;color:#888;text-decoration:none}
.back:hover{color:#C3FF00}
</style>
</head><body>
<div class="container">
<h1>${name}</h1>
<div class="owner">${short}</div>
<h2 style="color:#888;font-size:0.875rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:1rem">Previous Versions</h2>
<div class="history">${historyHtml}</div>
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
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.container{max-width:500px;padding:40px;text-align:center}
h1{font-size:2rem;margin-bottom:0.5rem}
.owner{font-family:monospace;color:#C3FF00;font-size:0.875rem;margin-bottom:2rem}
h2{color:#888;font-size:1rem;margin-bottom:1.5rem}
.links{display:flex;flex-direction:column;gap:12px;margin-bottom:2rem}
.link{display:block;padding:16px 24px;background:#111;border:1px solid #333;border-radius:12px;color:#fff;text-decoration:none;transition:all 0.2s}
.link:hover{border-color:#C3FF00;background:#0a0a0a}
.link span{display:block;color:#888;font-size:0.75rem;margin-top:4px}
.info{color:#555;font-size:0.875rem;line-height:1.6}
.back{display:inline-block;margin-top:2rem;color:#888;text-decoration:none}
.back:hover{color:#C3FF00}
</style>
</head><body>
<div class="container">
<h1>Recovery</h1>
<div class="owner">${short}</div>
<h2>Backup & Recovery Options</h2>
<div class="links">
  <a href="${GIT_REPO}" target="_blank" class="link">
    GitHub Repository
    <span>Source code for chainhost resolver</span>
  </a>
  <a href="https://ethscriptions.com/${owner}" target="_blank" class="link">
    View All Ethscriptions
    <span>Browse owner's inscriptions</span>
  </a>
  <a href="https://etherscan.io/address/${owner}" target="_blank" class="link">
    Etherscan
    <span>View wallet transactions</span>
  </a>
</div>
<p class="info">
  Your content is permanently stored on Ethereum.<br>
  Anyone can run a resolver to access it.
</p>
<a href="/" class="back">← Back to site</a>
</div>
</body></html>`;
}
