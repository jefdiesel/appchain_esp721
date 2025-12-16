// Dynadot API integration
// Docs: https://www.dynadot.com/domain/api3.html

const DYNADOT_API_URL = 'https://api.dynadot.com/api3.json'
const API_KEY = process.env.DYNADOT_API_KEY!

interface DynadotResponse {
  SearchResponse?: {
    SearchResults: Array<{
      Domain: string
      Available: 'yes' | 'no'
      Price?: string
      Currency?: string
    }>
  }
  RegisterResponse?: {
    Status: 'success' | 'error'
    Error?: string
    Expiration?: string
  }
  Error?: string
}

export async function checkDomainAvailability(domain: string): Promise<{
  available: boolean
  price?: number
  currency?: string
}> {
  const params = new URLSearchParams({
    key: API_KEY,
    command: 'search',
    domain0: domain,
  })

  const res = await fetch(`${DYNADOT_API_URL}?${params}`)
  const data: DynadotResponse = await res.json()

  if (data.SearchResponse?.SearchResults?.[0]) {
    const result = data.SearchResponse.SearchResults[0]
    return {
      available: result.Available === 'yes',
      price: result.Price ? parseFloat(result.Price) : undefined,
      currency: result.Currency,
    }
  }

  throw new Error(data.Error || 'Failed to check domain availability')
}

export async function registerDomain(
  domain: string,
  years: number = 1
): Promise<{
  success: boolean
  expiration?: string
  error?: string
}> {
  const params = new URLSearchParams({
    key: API_KEY,
    command: 'register',
    domain: domain,
    duration: years.toString(),
  })

  const res = await fetch(`${DYNADOT_API_URL}?${params}`)
  const data: DynadotResponse = await res.json()

  if (data.RegisterResponse) {
    return {
      success: data.RegisterResponse.Status === 'success',
      expiration: data.RegisterResponse.Expiration,
      error: data.RegisterResponse.Error,
    }
  }

  return {
    success: false,
    error: data.Error || 'Registration failed',
  }
}

export async function setNameservers(
  domain: string,
  nameservers: string[]
): Promise<boolean> {
  const params = new URLSearchParams({
    key: API_KEY,
    command: 'set_ns',
    domain: domain,
  })

  // Add nameservers (ns0, ns1, ns2, etc.)
  nameservers.forEach((ns, i) => {
    params.append(`ns${i}`, ns)
  })

  const res = await fetch(`${DYNADOT_API_URL}?${params}`)
  const data = await res.json()

  return data.SetNsResponse?.Status === 'success'
}

// Cloudflare nameservers to point domains to
export const CLOUDFLARE_NAMESERVERS = [
  // These get assigned per-zone, but defaults:
  'ns1.cloudflare.com',
  'ns2.cloudflare.com',
]

export async function getDomainInfo(domain: string): Promise<{
  expiration?: string
  nameservers?: string[]
  status?: string
}> {
  const params = new URLSearchParams({
    key: API_KEY,
    command: 'domain_info',
    domain: domain,
  })

  const res = await fetch(`${DYNADOT_API_URL}?${params}`)
  const data = await res.json()

  if (data.DomainInfoResponse) {
    return {
      expiration: data.DomainInfoResponse.Expiration,
      nameservers: data.DomainInfoResponse.NameServers,
      status: data.DomainInfoResponse.Status,
    }
  }

  return {}
}

export async function renewDomain(
  domain: string,
  years: number = 1
): Promise<{
  success: boolean
  expiration?: string
  error?: string
}> {
  const params = new URLSearchParams({
    key: API_KEY,
    command: 'renew',
    domain: domain,
    duration: years.toString(),
  })

  const res = await fetch(`${DYNADOT_API_URL}?${params}`)
  const data = await res.json()

  if (data.RenewResponse) {
    return {
      success: data.RenewResponse.Status === 'success',
      expiration: data.RenewResponse.Expiration,
      error: data.RenewResponse.Error,
    }
  }

  return {
    success: false,
    error: data.Error || 'Renewal failed',
  }
}
