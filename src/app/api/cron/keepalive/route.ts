import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET /api/cron/keepalive - Keep Supabase project active
// Runs every 3 days via Vercel cron to prevent free-tier pausing
export async function GET() {
  try {
    const supabase = getSupabase();

    const { error } = await supabase
      .from('marketplace_listings')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Keepalive error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Keepalive error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
