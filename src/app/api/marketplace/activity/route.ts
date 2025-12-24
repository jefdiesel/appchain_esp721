import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

interface ActivityItem {
  id: string;
  type: 'listing' | 'sale' | 'offer';
  name: string;
  priceEth: number;
  fromAddress: string;
  toAddress?: string;
  chain: string;
  txHash?: string;
  createdAt: string;
}

// GET /api/marketplace/activity - Get recent marketplace activity
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const type = searchParams.get('type'); // 'listing', 'sale', 'offer', or all

    const activities: ActivityItem[] = [];

    // Fetch recent listings
    if (!type || type === 'listing') {
      const { data: listings } = await supabase
        .from('marketplace_listings')
        .select('id, name, price_eth, seller_address, chain, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      for (const l of listings || []) {
        activities.push({
          id: `listing-${l.id}`,
          type: 'listing',
          name: l.name,
          priceEth: parseFloat(l.price_eth),
          fromAddress: l.seller_address,
          chain: l.chain,
          createdAt: l.created_at,
        });
      }
    }

    // Fetch recent sales
    if (!type || type === 'sale') {
      const { data: sales } = await supabase
        .from('marketplace_sales')
        .select('id, name, sale_price_eth, seller_address, buyer_address, chain, purchase_tx, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      for (const s of sales || []) {
        activities.push({
          id: `sale-${s.id}`,
          type: 'sale',
          name: s.name,
          priceEth: parseFloat(s.sale_price_eth),
          fromAddress: s.seller_address,
          toAddress: s.buyer_address,
          chain: s.chain,
          txHash: s.purchase_tx,
          createdAt: s.created_at,
        });
      }
    }

    // Fetch recent offers
    if (!type || type === 'offer') {
      const { data: offers } = await supabase
        .from('marketplace_offers')
        .select('id, ethscription_id, offer_eth, buyer_address, offer_tx, created_at, marketplace_listings(name, chain)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit);

      for (const o of offers || []) {
        const listing = o.marketplace_listings as any;
        activities.push({
          id: `offer-${o.id}`,
          type: 'offer',
          name: listing?.name || o.ethscription_id.slice(0, 10) + '...',
          priceEth: parseFloat(o.offer_eth),
          fromAddress: o.buyer_address,
          chain: listing?.chain || 'eth',
          txHash: o.offer_tx,
          createdAt: o.created_at,
        });
      }
    }

    // Sort by date descending
    activities.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      activity: activities.slice(0, limit),
    });
  } catch (err) {
    console.error('Activity error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
