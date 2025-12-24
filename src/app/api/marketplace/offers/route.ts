import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { dbRowToOffer, getEthscriptionId } from '@/lib/marketplace';

// GET /api/marketplace/offers - Get offers (by buyer or listing)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');
    const buyerAddress = searchParams.get('buyer');
    const status = searchParams.get('status') || 'pending';

    let query = supabase
      .from('marketplace_offers')
      .select('*')
      .order('created_at', { ascending: false });

    if (listingId) {
      query = query.eq('listing_id', listingId);
    }
    if (buyerAddress) {
      query = query.eq('buyer_address', buyerAddress.toLowerCase());
    }
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Offers query error:', error);
      return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });
    }

    return NextResponse.json({
      offers: (data || []).map(dbRowToOffer),
    });
  } catch (err) {
    console.error('Get offers error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/marketplace/offers - Create an offer
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { listingId, name, buyerAddress, offerWei, offerTx, expiresAt } = body;

    // Validate
    if (!buyerAddress || !offerWei) {
      return NextResponse.json(
        { error: 'Missing required fields: buyerAddress, offerWei' },
        { status: 400 }
      );
    }

    if (!listingId && !name) {
      return NextResponse.json(
        { error: 'Must provide either listingId or name' },
        { status: 400 }
      );
    }

    // Validate offer amount
    try {
      const offer = BigInt(offerWei);
      if (offer <= 0n) {
        return NextResponse.json({ error: 'Offer must be greater than 0' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid offer format' }, { status: 400 });
    }

    let ethscriptionId: string;

    if (listingId) {
      // Get ethscription ID from listing
      const { data: listing } = await supabase
        .from('marketplace_listings')
        .select('ethscription_id')
        .eq('id', listingId)
        .single();

      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      }
      ethscriptionId = listing.ethscription_id;
    } else {
      ethscriptionId = getEthscriptionId(name.toLowerCase());
    }

    // Create offer
    const { data, error } = await supabase
      .from('marketplace_offers')
      .insert({
        listing_id: listingId || null,
        ethscription_id: ethscriptionId,
        buyer_address: buyerAddress.toLowerCase(),
        offer_wei: offerWei,
        offer_tx: offerTx,
        expires_at: expiresAt,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Create offer error:', error);
      return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      offer: dbRowToOffer(data),
    });
  } catch (err) {
    console.error('Create offer error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/marketplace/offers - Update offer status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { offerId, action, userAddress } = body;

    if (!offerId || !action || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: offerId, action, userAddress' },
        { status: 400 }
      );
    }

    // Fetch offer
    const { data: offer, error: fetchError } = await supabase
      .from('marketplace_offers')
      .select('*, marketplace_listings!inner(seller_address)')
      .eq('id', offerId)
      .single();

    if (fetchError || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    const normalizedUser = userAddress.toLowerCase();
    const isBuyer = offer.buyer_address === normalizedUser;
    const isSeller = offer.marketplace_listings?.seller_address === normalizedUser;

    if (action === 'cancel') {
      if (!isBuyer) {
        return NextResponse.json({ error: 'Only buyer can cancel offer' }, { status: 403 });
      }

      const { error } = await supabase
        .from('marketplace_offers')
        .update({ status: 'cancelled' })
        .eq('id', offerId);

      if (error) {
        return NextResponse.json({ error: 'Failed to cancel offer' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Offer cancelled' });
    }

    if (action === 'accept') {
      if (!isSeller) {
        return NextResponse.json({ error: 'Only seller can accept offer' }, { status: 403 });
      }

      const { error } = await supabase
        .from('marketplace_offers')
        .update({ status: 'accepted' })
        .eq('id', offerId);

      if (error) {
        return NextResponse.json({ error: 'Failed to accept offer' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Offer accepted' });
    }

    if (action === 'reject') {
      if (!isSeller) {
        return NextResponse.json({ error: 'Only seller can reject offer' }, { status: 403 });
      }

      const { error } = await supabase
        .from('marketplace_offers')
        .update({ status: 'rejected' })
        .eq('id', offerId);

      if (error) {
        return NextResponse.json({ error: 'Failed to reject offer' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Offer rejected' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Update offer error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
