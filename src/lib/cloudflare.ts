// Cloudflare API integration
// Docs: https://developers.cloudflare.com/api/

const CF_API_URL = 'https://api.cloudflare.com/client/v4'
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!

interface CFResponse<T> {
  success: boolean
  errors: Array<{ code: number; message: string }>
  result: T
}

async function cfFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<CFResponse<T>> {
  const res = await fetch(`${CF_API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res.json()
}

// Zone management (domains)
export async function addZone(domain: string): Promise<{
  success: boolean
  zoneId?: string
  nameservers?: string[]
  error?: string
}> {
  const res = await cfFetch<{
    id: string
    name_servers: string[]
  }>('/zones', {
    method: 'POST',
    body: JSON.stringify({
      name: domain,
      account: { id: ACCOUNT_ID },
      type: 'full', // Full DNS management
    }),
  })

  if (res.success) {
    return {
      success: true,
      zoneId: res.result.id,
      nameservers: res.result.name_servers,
    }
  }

  return {
    success: false,
    error: res.errors[0]?.message || 'Failed to add zone',
  }
}

export async function deleteZone(zoneId: string): Promise<boolean> {
  const res = await cfFetch(`/zones/${zoneId}`, {
    method: 'DELETE',
  })
  return res.success
}

export async function getZone(domain: string): Promise<{
  zoneId?: string
  status?: string
  nameservers?: string[]
}> {
  const res = await cfFetch<Array<{
    id: string
    status: string
    name_servers: string[]
  }>>(`/zones?name=${domain}`)

  if (res.success && res.result[0]) {
    return {
      zoneId: res.result[0].id,
      status: res.result[0].status,
      nameservers: res.result[0].name_servers,
    }
  }

  return {}
}

// DNS records
export async function addDnsRecord(
  zoneId: string,
  record: {
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT'
    name: string
    content: string
    proxied?: boolean
    ttl?: number
  }
): Promise<{ success: boolean; recordId?: string }> {
  const res = await cfFetch<{ id: string }>(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: record.type,
      name: record.name,
      content: record.content,
      proxied: record.proxied ?? true,
      ttl: record.ttl ?? 1, // Auto
    }),
  })

  return {
    success: res.success,
    recordId: res.result?.id,
  }
}

// Pages project management
export async function createPagesProject(
  name: string
): Promise<{
  success: boolean
  projectName?: string
  subdomain?: string
  error?: string
}> {
  const res = await cfFetch<{
    name: string
    subdomain: string
  }>(`/accounts/${ACCOUNT_ID}/pages/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name: name,
      production_branch: 'main',
    }),
  })

  if (res.success) {
    return {
      success: true,
      projectName: res.result.name,
      subdomain: res.result.subdomain,
    }
  }

  return {
    success: false,
    error: res.errors[0]?.message || 'Failed to create Pages project',
  }
}

export async function addCustomDomain(
  projectName: string,
  domain: string
): Promise<{ success: boolean; error?: string }> {
  const res = await cfFetch(
    `/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/domains`,
    {
      method: 'POST',
      body: JSON.stringify({ name: domain }),
    }
  )

  return {
    success: res.success,
    error: res.errors[0]?.message,
  }
}

// Deploy static files to Pages
export async function deployToPages(
  projectName: string,
  files: Record<string, string> // filename -> content
): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  // Create deployment with direct upload
  // This requires multipart form data with the files
  const formData = new FormData()

  // Add manifest
  const manifest: Record<string, string> = {}
  Object.keys(files).forEach((filename, i) => {
    manifest[`/${filename}`] = `file${i}`
  })
  formData.append('manifest', JSON.stringify(manifest))

  // Add files
  Object.entries(files).forEach(([filename, content], i) => {
    formData.append(`file${i}`, new Blob([content]), filename)
  })

  const res = await fetch(
    `${CF_API_URL}/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: formData,
    }
  )

  const data = await res.json()

  if (data.success) {
    return {
      success: true,
      url: data.result.url,
    }
  }

  return {
    success: false,
    error: data.errors[0]?.message || 'Deployment failed',
  }
}

// Setup domain for chainhost site
export async function setupDomainForSite(
  domain: string,
  projectName: string
): Promise<{
  success: boolean
  nameservers?: string[]
  error?: string
}> {
  // 1. Add zone to Cloudflare
  const zone = await addZone(domain)
  if (!zone.success) {
    return { success: false, error: zone.error }
  }

  // 2. Add custom domain to Pages project
  const customDomain = await addCustomDomain(projectName, domain)
  if (!customDomain.success) {
    return { success: false, error: customDomain.error }
  }

  // 3. Return nameservers for user to set at registrar
  return {
    success: true,
    nameservers: zone.nameservers,
  }
}

// ============================================
// Workers API
// ============================================

const SUBDOMAIN_WORKER_NAME = 'chainhost-subdomain-router'

// Worker script for subdomain routing
function getWorkerScript(supabaseUrl: string, supabaseKey: string, etherscanKey: string = ''): string {
  return `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const parts = hostname.split('.');

    if (parts.length < 3 || parts[parts.length - 2] !== 'chainhost') {
      return new Response('Invalid hostname', { status: 400 });
    }

    const username = parts[0].toLowerCase();
    const reserved = ['www', 'api', 'app', 'dashboard', 'admin', 'mail', 'ftp'];

    if (reserved.includes(username)) {
      return Response.redirect('https://chainhost.online' + url.pathname, 302);
    }

    try {
      const userRes = await fetch(
        '${supabaseUrl}/rest/v1/users?username=eq.' + username + '&select=id',
        {
          headers: {
            'apikey': '${supabaseKey}',
            'Authorization': 'Bearer ${supabaseKey}',
          },
        }
      );
      const users = await userRes.json();

      if (!users || users.length === 0) {
        return new Response(notFoundPage(username), {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const userId = users[0].id;
      const siteRes = await fetch(
        '${supabaseUrl}/rest/v1/sites?user_id=eq.' + userId + '&select=*&order=status.desc,created_at.desc&limit=1',
        {
          headers: {
            'apikey': '${supabaseKey}',
            'Authorization': 'Bearer ${supabaseKey}',
          },
        }
      );
      const sites = await siteRes.json();

      if (!sites || sites.length === 0) {
        return new Response(noSitePage(username), {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const site = sites[0];

      if (site.inscription_tx) {
        let ethContent = await fetchFromEthereum(site.inscription_tx);
        if (ethContent) {
          // Check if content is a template reference and resolve it
          ethContent = await resolveTemplateRef(ethContent);
          return new Response(ethContent, { headers: { 'Content-Type': 'text/html' } });
        }
      }

      if (site.html_content) {
        return new Response(site.html_content, { headers: { 'Content-Type': 'text/html' } });
      }

      return new Response(noSitePage(username), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });

    } catch (error) {
      return new Response('Internal error', { status: 500 });
    }
  },
};

async function fetchFromEthereum(txHash) {
  try {
    const apiKey = '${etherscanKey}' || 'YourApiKeyToken';
    const response = await fetch(
      'https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=' + txHash + '&apikey=' + apiKey
    );
    const data = await response.json();
    if (!data.result || !data.result.input) return null;
    return decodeCalldata(data.result.input);
  } catch (error) {
    return null;
  }
}

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
      if (isBase64) return atob(match[2]);
      return decodeURIComponent(match[2]);
    }
  }
  return decoded;
}

// Check if content is a template reference and resolve it
async function resolveTemplateRef(content) {
  try {
    const data = JSON.parse(content);
    if (!data.ref) return content; // Not a template reference

    // Fetch the template by tx hash
    const templateContent = await fetchFromEthereum(data.ref);
    if (!templateContent) return content;

    const template = JSON.parse(templateContent);
    if (!template.html || !template.css) return content;

    // Render template with data
    let html = template.html;
    html = html.replace('{{css}}', template.css);

    // Replace simple placeholders
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        html = html.replace(new RegExp('{{' + key + '}}', 'g'), escapeHtml(value));
      }
    }

    // Handle keywords
    if (data.keywords) {
      const keywordsHtml = data.keywords.split(',').map(k => k.trim()).filter(Boolean)
        .map(k => '<span class="tag">' + escapeHtml(k) + '</span>').join('');
      html = html.replace('{{keywords_html}}', keywordsHtml);
      html = html.replace('{{#keywords}}', '').replace('{{/keywords}}', '');
    } else {
      html = html.replace(/{{#keywords}}[\\s\\S]*?{{\/keywords}}/g, '');
    }

    // Handle content paragraphs
    if (data.content) {
      const contentHtml = data.content.split('\\n\\n').map(p => '<p>' + escapeHtml(p) + '</p>').join('');
      html = html.replace('{{content_html}}', contentHtml);
    }

    // Handle links
    if (data.links && Array.isArray(data.links)) {
      const linksHtml = data.links.filter(l => l.label && l.url)
        .map(l => '<a class="link" href="' + escapeHtml(l.url) + '" target="_blank"><span>' + escapeHtml(l.label) + '</span></a>')
        .join('\\n');
      html = html.replace('{{links_html}}', linksHtml);
    }

    return html;
  } catch (e) {
    return content; // Not JSON or parsing failed, return as-is
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function notFoundPage(username) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{text-align:center;padding:40px 20px}h1{font-size:4rem;color:#C3FF00;margin-bottom:1rem}p{color:#888;margin-bottom:2rem}a{color:#C3FF00}</style></head><body><div class="c"><h1>404</h1><p>The username <strong>' + username + '</strong> is not claimed.</p><a href="https://chainhost.online">Claim it →</a></div></body></html>';
}

function noSitePage(username) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + username + '</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{text-align:center;padding:40px 20px}h1{font-size:2rem;margin-bottom:0.5rem}p{color:#888;margin-bottom:2rem}.b{display:inline-block;padding:8px 16px;background:#111;border:1px solid #333;border-radius:20px;font-size:0.875rem;color:#888}</style></head><body><div class="c"><h1>' + username + '</h1><p>Coming soon.</p><span class="b">Powered by Chainhost</span></div></body></html>';
}
`
}

// Create or update the subdomain router worker
export async function createSubdomainWorker(): Promise<{
  success: boolean
  workerId?: string
  error?: string
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const etherscanKey = process.env.ETHERSCAN_API_KEY || ''

  const script = getWorkerScript(supabaseUrl, supabaseKey, etherscanKey)

  // Upload worker script with ES modules format (requires multipart)
  const formData = new FormData()

  // Add the worker script
  formData.append('worker.js', new Blob([script], { type: 'application/javascript+module' }), 'worker.js')

  // Add metadata for ES modules
  const metadata = {
    main_module: 'worker.js',
  }
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))

  const res = await fetch(
    `${CF_API_URL}/accounts/${ACCOUNT_ID}/workers/scripts/${SUBDOMAIN_WORKER_NAME}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: formData,
    }
  )

  const data = await res.json()

  if (data.success) {
    return {
      success: true,
      workerId: data.result?.id,
    }
  }

  return {
    success: false,
    error: data.errors?.[0]?.message || 'Failed to create worker',
  }
}

// Add worker route for *.chainhost.online
export async function addWorkerRoute(zoneId: string): Promise<{
  success: boolean
  routeId?: string
  error?: string
}> {
  const res = await cfFetch<{ id: string }>(`/zones/${zoneId}/workers/routes`, {
    method: 'POST',
    body: JSON.stringify({
      pattern: '*.chainhost.online/*',
      script: SUBDOMAIN_WORKER_NAME,
    }),
  })

  if (res.success) {
    return {
      success: true,
      routeId: res.result.id,
    }
  }

  return {
    success: false,
    error: res.errors?.[0]?.message || 'Failed to add worker route',
  }
}

// Add wildcard DNS record for subdomains
export async function addWildcardDns(zoneId: string): Promise<{
  success: boolean
  recordId?: string
  error?: string
}> {
  // First check if wildcard already exists
  const existingRes = await cfFetch<Array<{ id: string }>>(`/zones/${zoneId}/dns_records?name=*.chainhost.online&type=A`)

  if (existingRes.success && existingRes.result?.length > 0) {
    return {
      success: true,
      recordId: existingRes.result[0].id,
    }
  }

  // Add wildcard A record (dummy IP, worker intercepts)
  const res = await cfFetch<{ id: string }>(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'A',
      name: '*',
      content: '192.0.2.1', // RFC 5737 TEST-NET, worker intercepts before it hits this
      proxied: true,
      ttl: 1,
    }),
  })

  if (res.success) {
    return {
      success: true,
      recordId: res.result.id,
    }
  }

  return {
    success: false,
    error: res.errors?.[0]?.message || 'Failed to add wildcard DNS',
  }
}

// Full setup: create worker, add route, add DNS
export async function setupSubdomainSystem(): Promise<{
  success: boolean
  worker?: { success: boolean; workerId?: string; error?: string }
  route?: { success: boolean; routeId?: string; error?: string }
  dns?: { success: boolean; recordId?: string; error?: string }
  error?: string
}> {
  // Get chainhost.online zone
  const zone = await getZone('chainhost.online')

  if (!zone.zoneId) {
    return {
      success: false,
      error: 'chainhost.online zone not found in Cloudflare. Add it first.',
    }
  }

  // 1. Create/update worker
  const worker = await createSubdomainWorker()
  if (!worker.success) {
    return { success: false, worker, error: 'Failed to create worker' }
  }

  // 2. Add worker route
  const route = await addWorkerRoute(zone.zoneId)
  // Route might already exist, that's ok

  // 3. Add wildcard DNS
  const dns = await addWildcardDns(zone.zoneId)

  return {
    success: worker.success && dns.success,
    worker,
    route,
    dns,
  }
}
