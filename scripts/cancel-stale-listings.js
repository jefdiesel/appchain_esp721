require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// The rescued ethscription IDs
const ETHSCRIPTION_IDS = [
  '0x2127aed3f33b1de51f6079fdc1f8c62470477d822f172a94491810107b4efd7d',
  '0xaba1669cb122c31efb8c61114587f4c6d0ed6322cfd35f540a4e9d349038ac9c',
  '0x04fd56026adca924ebe34d20956e990946e501edeeddb959d001b6e299d0fa45',
];

async function main() {
  console.log('Cancelling stale listings...\n');

  for (const ethscriptionId of ETHSCRIPTION_IDS) {
    console.log(`Processing ${ethscriptionId.slice(0, 16)}...`);

    // Find active listing
    const { data: listing, error: findError } = await supabase
      .from('marketplace_listings')
      .select('id, name, status')
      .eq('ethscription_id', ethscriptionId)
      .eq('status', 'active')
      .single();

    if (findError || !listing) {
      console.log('  No active listing found');
      continue;
    }

    console.log(`  Found: ${listing.name} (${listing.id})`);

    // Update to cancelled
    const { error: updateError } = await supabase
      .from('marketplace_listings')
      .update({ status: 'cancelled' })
      .eq('id', listing.id);

    if (updateError) {
      console.log(`  Error cancelling: ${updateError.message}`);
    } else {
      console.log('  Cancelled!');
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
