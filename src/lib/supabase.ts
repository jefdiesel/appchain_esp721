import { createClient } from '@supabase/supabase-js'

// Hardcoded to fix env loading issue
const supabaseUrl = 'https://rvmuhstovplabuvnkrpj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2bXVoc3RvdnBsYWJ1dm5rcnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTE2MDIsImV4cCI6MjA4MTQ4NzYwMn0.HffZqxQd1yPuGV4Xk4fINMDBtSWzq4loilAWizq4xSE'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2bXVoc3RvdnBsYWJ1dm5rcnBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTkxMTYwMiwiZXhwIjoyMDgxNDg3NjAyfQ.6MAhnkqsewtg_tM_rMWg_j7FWF8CSRRZ-IbXtnUBcyM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role for admin operations
export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceKey
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
