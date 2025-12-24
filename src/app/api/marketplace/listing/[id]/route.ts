import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { dbRowToListing, dbRowToOffer } from '@/lib/marketplace';

// GET /api/marketplace/listing/[id] - Get single listing details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;

    // Fetch listing
    const { data: listing, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Fetch offers for this listing
    const { data: offers } = await supabase
      .from('marketplace_offers')
      .select('*')
      .eq('listing_id', id)
      .eq('status', 'pending')
      .order('offer_eth', { ascending: false });

    return NextResponse.json({
      listing: dbRowToListing(listing),
      offers: (offers || []).map(dbRowToOffer),
    });
  } catch (err) {
    console.error('Get listing error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/marketplace/listing/[id] - Update listing (price, cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    const body = await request.json();
    const { action, priceWei, sellerAddress } = body;

    // Fetch existing listing
    const { data: listing, error: fetchError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Verify seller
    if (sellerAddress?.toLowerCase() !== listing.seller_address) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (action === 'cancel') {
      // Cancel listing
      const { error } = await supabase
        .from('marketplace_listings')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: 'Failed to cancel listing' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Listing cancelled' });
    }

    if (action === 'updatePrice' && priceWei) {
      // Update price
      try {
        const price = BigInt(priceWei);
        if (price <= 0n) {
          return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid price format' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('marketplace_listings')
        .update({ price_wei: priceWei })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to update price' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        listing: dbRowToListing(data),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Update listing error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/marketplace/listing/[id] - Mark listing as sold
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const { id } = await params;
    const body = await request.json();
    const { buyerAddress, purchaseTx, salePriceWei } = body;

    // Fetch listing
    const { data: listing, error: fetchError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (listing.status !== 'active') {
      return NextResponse.json({ error: 'Listing not active' }, { status: 400 });
    }

    // Calculate fee
    const price = BigInt(salePriceWei || listing.price_wei);
    const fee = (price * 250n) / 10000n;

    // Create sale record
    const { error: saleError } = await supabase
      .from('marketplace_sales')
      .insert({
        listing_id: id,
        ethscription_id: listing.ethscription_id,
        name: listing.name,
        seller_address: listing.seller_address,
        buyer_address: buyerAddress.toLowerCase(),
        sale_price_wei: price.toString(),
        fee_wei: fee.toString(),
        purchase_tx: purchaseTx,
        chain: listing.chain,
      });

    if (saleError) {
      console.error('Create sale error:', saleError);
      return NextResponse.json({ error: 'Failed to record sale' }, { status: 500 });
    }

    // Update listing status
    const { error: updateError } = await supabase
      .from('marketplace_listings')
      .update({ status: 'sold' })
      .eq('id', id);

    if (updateError) {
      console.error('Update listing error:', updateError);
    }

    // Cancel any pending offers
    await supabase
      .from('marketplace_offers')
      .update({ status: 'cancelled' })
      .eq('listing_id', id)
      .eq('status', 'pending');

    return NextResponse.json({ success: true, message: 'Sale recorded' });
  } catch (err) {
    console.error('Record sale error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
