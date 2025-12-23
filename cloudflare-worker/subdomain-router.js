/**
 * Cloudflare Worker: Subdomain Router for chainhost.online
 *
 * Routes *.chainhost.online requests to user sites
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Extract subdomain
    const parts = hostname.split('.');
    if (parts.length < 3 || parts[parts.length - 2] !== 'chainhost') {
      return new Response('Invalid hostname', { status: 400 });
    }

    const username = parts[0].toLowerCase();

    // Skip reserved subdomains
    const reserved = ['www', 'api', 'app', 'dashboard', 'admin', 'mail', 'ftp'];
    if (reserved.includes(username)) {
      return Response.redirect('https://chainhost.online' + url.pathname, 302);
    }

    try {
      // Look up user by username
      const userResponse = await fetch(
        env.SUPABASE_URL + '/rest/v1/users?username=eq.' + username + '&select=id',
        {
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
          },
        }
      );

      const users = await userResponse.json();

      if (!users || users.length === 0) {
        return new Response(notFoundPage(username), {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const userId = users[0].id;

      // Get user's site
      const siteResponse = await fetch(
        env.SUPABASE_URL + '/rest/v1/sites?user_id=eq.' + userId + '&select=*&order=created_at.desc&limit=1',
        {
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
          },
        }
      );

      const sites = await siteResponse.json();

      if (!sites || sites.length === 0) {
        return new Response(noSitePage(username), {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const site = sites[0];

      // If site has an inscription, try both chains
      if (site.inscription_tx) {
        var content = await fetchFromChain(site.inscription_tx, 'base');
        if (!content) {
          content = await fetchFromChain(site.inscription_tx, 'eth');
        }
        if (content) {
          return new Response(content, {
            headers: { 'Content-Type': 'text/html' },
          });
        }
      }

      // Fall back to stored HTML
      if (site.html_content) {
        return new Response(site.html_content, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      return new Response(noSitePage(username), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Error: ' + error.message, { status: 500 });
    }
  },
};

// RPC endpoints for each chain
var RPC_URLS = {
  'eth': 'https://eth.llamarpc.com',
  'base': 'https://mainnet.base.org'
};

// Fetch from chain RPC
async function fetchFromChain(txHash, chain) {
  var rpcUrl = RPC_URLS[chain] || RPC_URLS['base'];
  try {
    var response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [txHash],
        id: 1,
      }),
    });

    var data = await response.json();

    if (!data.result || !data.result.input) {
      return null;
    }

    return decodeCalldata(data.result.input);
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

// Decode calldata
function decodeCalldata(calldata) {
  const hex = calldata.startsWith('0x') ? calldata.slice(2) : calldata;

  let decoded = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substr(i, 2), 16);
    if (code) decoded += String.fromCharCode(code);
  }

  if (decoded.startsWith('data:')) {
    const match = decoded.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
    if (match) {
      const isBase64 = decoded.includes(';base64,');
      if (isBase64) {
        return atob(match[2]);
      }
      return decodeURIComponent(match[2]);
    }
  }

  return decoded;
}

function notFoundPage(username) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{text-align:center;padding:40px}h1{font-size:4rem;color:#C3FF00;margin-bottom:1rem}p{color:#888;margin-bottom:2rem}a{color:#C3FF00}</style></head><body><div class="c"><h1>404</h1><p>The username <strong>' + username + '</strong> has not been claimed yet.</p><a href="https://chainhost.online">Claim it on Chainhost</a></div></body></html>';
}

function noSitePage(username) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + username + ' - Chainhost</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{text-align:center;padding:40px}h1{font-size:2rem;margin-bottom:0.5rem}p{color:#888;margin-bottom:2rem}.b{display:inline-block;padding:8px 16px;background:#111;border:1px solid #333;border-radius:20px;font-size:0.875rem;color:#888}</style></head><body><div class="c"><h1>' + username + '</h1><p>This site is coming soon.</p><span class="b">Powered by Chainhost</span></div></body></html>';
}
