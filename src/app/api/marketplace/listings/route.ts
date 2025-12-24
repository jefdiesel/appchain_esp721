import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { dbRowToListing, getEthscriptionId } from '@/lib/marketplace';

// GET /api/marketplace/listings - Browse all active listings
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';
    const seller = searchParams.get('seller');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const search = searchParams.get('search');
    const chain = searchParams.get('chain');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('marketplace_active_listings')
      .select('*', { count: 'exact' });

    // Filters
    if (seller) {
      query = query.eq('seller_address', seller.toLowerCase());
    }
    if (minPrice) {
      query = query.gte('price_eth', parseFloat(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price_eth', parseFloat(maxPrice));
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (chain) {
      query = query.eq('chain', chain);
    }

    // Sorting
    const validSorts = ['created_at', 'price_eth', 'name', 'highest_offer'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    query = query.order(sortField, { ascending: order === 'asc' });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Listings query error:', error);
      return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
    }

    const listings = (data || []).map(dbRowToListing);

    return NextResponse.json({
      listings,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Listings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/marketplace/listings - Create a new listing
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { name, sellerAddress, priceWei, depositTx, chain = 'eth' } = body;

    // Validate required fields
    if (!name || !sellerAddress || !priceWei) {
      return NextResponse.json(
        { error: 'Missing required fields: name, sellerAddress, priceWei' },
        { status: 400 }
      );
    }

    // Validate name format
    const normalizedName = name.toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalizedName) || normalizedName.length > 32) {
      return NextResponse.json(
        { error: 'Invalid name format' },
        { status: 400 }
      );
    }

    // Validate price
    try {
      const price = BigInt(priceWei);
      if (price <= 0n) {
        return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid price format' }, { status: 400 });
    }

    const ethscriptionId = getEthscriptionId(normalizedName);

    // Check if already listed
    const { data: existing } = await supabase
      .from('marketplace_listings')
      .select('id')
      .eq('ethscription_id', ethscriptionId)
      .eq('status', 'active')
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'This name is already listed' },
        { status: 409 }
      );
    }

    // Create listing
    const { data, error } = await supabase
      .from('marketplace_listings')
      .insert({
        ethscription_id: ethscriptionId,
        name: normalizedName,
        seller_address: sellerAddress.toLowerCase(),
        price_wei: priceWei,
        deposit_tx: depositTx,
        chain,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Create listing error:', error);
      return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      listing: dbRowToListing(data),
    });
  } catch (err) {
    console.error('Create listing error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
