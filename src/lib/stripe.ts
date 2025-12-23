import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Product IDs - create these in Stripe Dashboard
export const PRODUCTS = {
  // Domain registration (one-time, per TLD)
  DOMAIN_COM: 'price_domain_com', // .com ~$12/year
  DOMAIN_XYZ: 'price_domain_xyz', // .xyz ~$10/year
  DOMAIN_NET: 'price_domain_net', // .net ~$12/year

  // Optional: Monthly hosting subscription (if you want recurring revenue)
  HOSTING_BASIC: 'price_hosting_basic', // $5/mo - includes 1 domain
}

// Domain pricing (cost + margin)
export const DOMAIN_PRICING: Record<string, {
  price: number // cents
  renewal: number // cents
  dynadotCost: number // what we pay
}> = {
  'com': { price: 1499, renewal: 1499, dynadotCost: 999 },
  'xyz': { price: 999, renewal: 1299, dynadotCost: 299 },
  'net': { price: 1499, renewal: 1499, dynadotCost: 1099 },
  'org': { price: 1499, renewal: 1499, dynadotCost: 1099 },
  'io': { price: 4999, renewal: 4999, dynadotCost: 3499 },
}

export async function createCheckoutSession({
  customerId,
  domain,
  tld,
  successUrl,
  cancelUrl,
}: {
  customerId: string
  domain: string
  tld: string
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const pricing = DOMAIN_PRICING[tld]
  if (!pricing) {
    throw new Error(`Unsupported TLD: ${tld}`)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Domain: ${domain}.${tld}`,
            description: '1 year registration + hosting on Ethereum calldata',
          },
          unit_amount: pricing.price,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: 'domain_registration',
      domain: domain,
      tld: tld,
      full_domain: `${domain}.${tld}`,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return session.url!
}

export async function createCustomer(email: string, clerkId: string): Promise<string> {
  const customer = await stripe.customers.create({
    email,
    metadata: {
      clerk_id: clerkId,
    },
  })
  return customer.id
}

export async function getOrCreateCustomer(
  email: string,
  clerkId: string,
  existingCustomerId?: string
): Promise<string> {
  if (existingCustomerId) {
    return existingCustomerId
  }

  // Check if customer exists by email
  const existing = await stripe.customers.list({
    email,
    limit: 1,
  })

  if (existing.data.length > 0) {
    return existing.data[0].id
  }

  return createCustomer(email, clerkId)
}

// Create renewal checkout for expiring domains
export async function createRenewalCheckout({
  customerId,
  domain,
  tld,
  successUrl,
  cancelUrl,
}: {
  customerId: string
  domain: string
  tld: string
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const pricing = DOMAIN_PRICING[tld]
  if (!pricing) {
    throw new Error(`Unsupported TLD: ${tld}`)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Domain Renewal: ${domain}.${tld}`,
            description: '1 year renewal',
          },
          unit_amount: pricing.renewal,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: 'domain_renewal',
      domain: domain,
      tld: tld,
      full_domain: `${domain}.${tld}`,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return session.url!
}
