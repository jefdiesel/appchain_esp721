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
