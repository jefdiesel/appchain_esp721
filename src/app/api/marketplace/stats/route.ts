import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

// GET /api/marketplace/stats - Get marketplace statistics
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('marketplace_stats')
      .select('*')
      .single();

    if (error) {
      // Fallback to manual counts if view doesn't exist
      const [listings, sales] = await Promise.all([
        supabase
          .from('marketplace_listings')
          .select('id', { count: 'exact' })
          .eq('status', 'active'),
        supabase
          .from('marketplace_sales')
          .select('sale_price_eth', { count: 'exact' }),
      ]);

      const totalVolume = (sales.data || []).reduce(
        (sum, s) => sum + parseFloat(s.sale_price_eth || '0'),
        0
      );

      return NextResponse.json({
        stats: {
          activeListings: listings.count || 0,
          totalSales: sales.count || 0,
          totalVolumeEth: totalVolume,
          avgSalePriceEth: sales.count ? totalVolume / sales.count : 0,
          uniqueSellers: 0,
          uniqueBuyers: 0,
        },
      });
    }

    return NextResponse.json({
      stats: {
        activeListings: data.active_listings || 0,
        totalSales: data.total_sales || 0,
        totalVolumeEth: parseFloat(data.total_volume_eth || '0'),
        avgSalePriceEth: parseFloat(data.avg_sale_price_eth || '0'),
        uniqueSellers: data.unique_sellers || 0,
        uniqueBuyers: data.unique_buyers || 0,
      },
    });
  } catch (err) {
    console.error('Stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
