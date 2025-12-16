import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role for admin operations
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Database types
export interface User {
  id: string
  clerk_id: string
  email: string
  created_at: string
}

export interface Site {
  id: string
  user_id: string
  name: string
  slug: string
  template: string | null
  html_content: string | null
  inscription_tx: string | null
  manifest_tx: string | null
  status: 'draft' | 'inscribed' | 'live'
  created_at: string
  updated_at: string
}

export interface Domain {
  id: string
  user_id: string
  site_id: string | null
  domain: string
  tld: string
  status: 'pending' | 'registered' | 'active' | 'expired'
  dynadot_order_id: string | null
  cloudflare_zone_id: string | null
  expires_at: string | null
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  status: 'active' | 'canceled' | 'past_due'
  current_period_end: string | null
  created_at: string
}
