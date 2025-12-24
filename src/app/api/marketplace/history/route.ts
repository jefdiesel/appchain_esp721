import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getEthscriptionId } from '@/lib/marketplace';

interface PricePoint {
  priceEth: number;
  date: string;
  type: 'listing' | 'sale';
  txHash?: string;
}

// GET /api/marketplace/history?name=foo - Get price history for a name
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const ethscriptionId = searchParams.get('ethscriptionId');

    if (!name && !ethscriptionId) {
      return NextResponse.json(
        { error: 'Must provide name or ethscriptionId' },
        { status: 400 }
      );
    }

    const targetId = ethscriptionId || getEthscriptionId(name!.toLowerCase());
    const history: PricePoint[] = [];

    // Get listing history
    const { data: listings } = await supabase
      .from('marketplace_listings')
      .select('price_eth, created_at, deposit_tx')
      .eq('ethscription_id', targetId)
      .order('created_at', { ascending: true });

    for (const l of listings || []) {
      history.push({
        priceEth: parseFloat(l.price_eth),
        date: l.created_at,
        type: 'listing',
        txHash: l.deposit_tx,
      });
    }

    // Get sales history
    const { data: sales } = await supabase
      .from('marketplace_sales')
      .select('sale_price_eth, created_at, purchase_tx')
      .eq('ethscription_id', targetId)
      .order('created_at', { ascending: true });

    for (const s of sales || []) {
      history.push({
        priceEth: parseFloat(s.sale_price_eth),
        date: s.created_at,
        type: 'sale',
        txHash: s.purchase_tx,
      });
    }

    // Sort chronologically
    history.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate stats
    const salePrices = history.filter(h => h.type === 'sale').map(h => h.priceEth);
    const stats = {
      totalSales: salePrices.length,
      avgPrice: salePrices.length ? salePrices.reduce((a, b) => a + b, 0) / salePrices.length : 0,
      minPrice: salePrices.length ? Math.min(...salePrices) : 0,
      maxPrice: salePrices.length ? Math.max(...salePrices) : 0,
      lastSalePrice: salePrices.length ? salePrices[salePrices.length - 1] : null,
    };

    return NextResponse.json({
      name: name || null,
      ethscriptionId: targetId,
      history,
      stats,
    });
  } catch (err) {
    console.error('History error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
