#!/usr/bin/env npx tsx
/**
 * Setup Cloudflare subdomain system for chainhost.online
 *
 * Run: npx tsx scripts/setup-cloudflare.ts
 *
 * This will:
 * 1. Create/update the subdomain router worker
 * 2. Add worker route for *.chainhost.online
 * 3. Add wildcard DNS record
 *
 * Prerequisites:
 * - chainhost.online must already be added to your Cloudflare account
 * - .env.local must have CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load env vars (override any auto-injected values)
config({ path: resolve(process.cwd(), '.env.local'), override: true });

async function main() {
  console.log('🚀 Setting up Cloudflare subdomain system...\n');

  // Check env vars
  const required = [
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }

  // Import after env is loaded
  const { setupSubdomainSystem } = await import('../src/lib/cloudflare');

  try {
    const result = await setupSubdomainSystem();

    console.log('\n📋 Results:\n');

    if (result.worker) {
      if (result.worker.success) {
        console.log('✅ Worker created/updated');
        if (result.worker.workerId) console.log(`   ID: ${result.worker.workerId}`);
      } else {
        console.log(`❌ Worker failed: ${result.worker.error}`);
      }
    }

    if (result.route) {
      if (result.route.success) {
        console.log('✅ Route added');
        if (result.route.routeId) console.log(`   ID: ${result.route.routeId}`);
      } else {
        console.log(`⚠️  Route: ${result.route.error}`);
        console.log('   (May already exist, which is fine)');
      }
    }

    if (result.dns) {
      if (result.dns.success) {
        console.log('✅ Wildcard DNS added');
        if (result.dns.recordId) console.log(`   ID: ${result.dns.recordId}`);
      } else {
        console.log(`❌ DNS failed: ${result.dns.error}`);
      }
    }

    console.log('\n');

    if (result.success) {
      console.log('🎉 Setup complete!');
      console.log('\nSubdomains like username.chainhost.online are now active.');
    } else {
      console.log('⚠️  Setup partially complete. Check errors above.');
      if (result.error) console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

main();
