// Use Web Crypto API for hashing (works in browser and Node.js)

// Contract addresses (deploy and update these)
export const MARKETPLACE_CONTRACT = {
  eth: '0x7af895301ab8a0ab13fe87819cc6f62f03689988',
  base: '0x33796ce232bf02481de14a5e2b8e76d5687cb43f',
} as const;

// Contract ABI (minimal for frontend)
export const MARKETPLACE_ABI = [
  'function deposit(bytes32 ethscriptionId) external',
  'function list(bytes32 ethscriptionId, uint256 price) external',
  'function depositAndList(bytes32 ethscriptionId, uint256 price) external',
  'function buy(bytes32 ethscriptionId) external payable',
  'function cancelAndWithdraw(bytes32 ethscriptionId) external',
  'function makeOffer(bytes32 ethscriptionId, uint64 expiresIn) external payable',
  'function acceptOffer(bytes32 ethscriptionId, uint256 offerIndex) external',
  'function cancelOffer(bytes32 ethscriptionId, uint256 offerIndex) external',
  'function updatePrice(bytes32 ethscriptionId, uint256 newPrice) external',
  'function getListing(bytes32 ethscriptionId) external view returns (bool active, address seller, uint256 price)',
  'function getOffers(bytes32 ethscriptionId) external view returns (tuple(address buyer, uint256 amount, uint64 expiresAt)[])',
  'function adminRescue(bytes32 ethscriptionId, address originalOwner) external',
  'function adminRegisterDepositor(bytes32 ethscriptionId, address depositor) external',
  'event Listed(bytes32 indexed ethscriptionId, address indexed seller, uint256 price)',
  'event Unlisted(bytes32 indexed ethscriptionId, address indexed seller)',
  'event Sold(bytes32 indexed ethscriptionId, address indexed seller, address indexed buyer, uint256 price)',
  'event OfferMade(bytes32 indexed ethscriptionId, address indexed buyer, uint256 amount)',
  'event OfferAccepted(bytes32 indexed ethscriptionId, address indexed seller, address indexed buyer, uint256 amount)',
] as const;

// Platform fee: 2.5%
export const PLATFORM_FEE_BPS = 250;
export const BPS_DENOMINATOR = 10000;

export interface Listing {
  id: string;
  ethscriptionId: string;
  name: string;
  sellerAddress: string;
  priceWei: string;
  priceEth: number;
  status: 'active' | 'sold' | 'cancelled';
  depositTx?: string;
  chain: 'eth' | 'base';
  createdAt: string;
  updatedAt: string;
  offerCount?: number;
  highestOffer?: number;
}

export interface Offer {
  id: string;
  listingId?: string;
  ethscriptionId: string;
  buyerAddress: string;
  offerWei: string;
  offerEth: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
  offerTx?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  listingId?: string;
  ethscriptionId: string;
  name: string;
  sellerAddress: string;
  buyerAddress: string;
  salePriceWei: string;
  salePriceEth: number;
  feeWei?: string;
  purchaseTx: string;
  chain: 'eth' | 'base';
  createdAt: string;
}

export interface MarketplaceStats {
  activeListings: number;
  totalSales: number;
  totalVolumeEth: number;
  avgSalePriceEth: number;
  uniqueSellers: number;
  uniqueBuyers: number;
}

/**
 * Get the ethscription ID (SHA256 hash) for a name
 * Works in both browser and Node.js
 */
export function getEthscriptionId(name: string): string {
  // For server-side (API routes), use Node's crypto
  if (typeof window === 'undefined') {
    const crypto = require('crypto');
    const dataUri = `data:,${name.toLowerCase()}`;
    const hash = crypto.createHash('sha256').update(dataUri).digest('hex');
    return `0x${hash}`;
  }

  // For client-side, we compute this synchronously using a simple approach
  // The hash will be computed on the server via API for actual operations
  // This is just for display purposes
  const dataUri = `data:,${name.toLowerCase()}`;
  // Return placeholder - actual hash computed server-side
  return `0x${Array.from(dataUri).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Get the ethscription ID async (for client-side with proper hash)
 */
export async function getEthscriptionIdAsync(name: string): Promise<string> {
  const dataUri = `data:,${name.toLowerCase()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(dataUri);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `0x${hashHex}`;
}

/**
 * Calculate platform fee
 */
export function calculateFee(priceWei: bigint): bigint {
  return (priceWei * BigInt(PLATFORM_FEE_BPS)) / BigInt(BPS_DENOMINATOR);
}

/**
 * Calculate seller proceeds after fee
 */
export function calculateSellerProceeds(priceWei: bigint): bigint {
  const fee = calculateFee(priceWei);
  return priceWei - fee;
}

/**
 * Format wei to ETH string
 */
export function weiToEth(wei: string | bigint): string {
  const weiNum = typeof wei === 'string' ? BigInt(wei) : wei;
  const eth = Number(weiNum) / 1e18;
  return eth.toFixed(6);
}

/**
 * Format ETH to wei string
 */
export function ethToWei(eth: number | string): string {
  const ethNum = typeof eth === 'string' ? parseFloat(eth) : eth;
  const wei = BigInt(Math.floor(ethNum * 1e18));
  return wei.toString();
}

/**
 * Check if an ethscription is deposited in the marketplace contract
 */
export async function isDeposited(ethscriptionId: string, chain: 'eth' | 'base' = 'eth'): Promise<boolean> {
  // Query ethscriptions API to check current owner
  const API_BASE = chain === 'base'
    ? 'https://base-api.ethscriptions.com/v2'
    : 'https://api.ethscriptions.com/v2';

  try {
    const res = await fetch(`${API_BASE}/ethscriptions/${ethscriptionId}`);
    if (!res.ok) return false;

    const data = await res.json();
    const currentOwner = data.result?.current_owner?.toLowerCase();
    const contractAddress = MARKETPLACE_CONTRACT[chain].toLowerCase();

    return currentOwner === contractAddress;
  } catch {
    return false;
  }
}

/**
 * Verify ownership of an ethscription
 */
export async function verifyOwnership(
  ethscriptionId: string,
  expectedOwner: string,
  chain: 'eth' | 'base' = 'eth'
): Promise<boolean> {
  const API_BASE = chain === 'base'
    ? 'https://base-api.ethscriptions.com/v2'
    : 'https://api.ethscriptions.com/v2';

  try {
    const res = await fetch(`${API_BASE}/ethscriptions/${ethscriptionId}`);
    if (!res.ok) return false;

    const data = await res.json();
    const currentOwner = data.result?.current_owner?.toLowerCase();

    return currentOwner === expectedOwner.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Get ethscription details from API
 */
export async function getEthscription(ethscriptionId: string, chain: 'eth' | 'base' = 'eth') {
  const API_BASE = chain === 'base'
    ? 'https://base-api.ethscriptions.com/v2'
    : 'https://api.ethscriptions.com/v2';

  const res = await fetch(`${API_BASE}/ethscriptions/${ethscriptionId}`);
  if (!res.ok) return null;

  const data = await res.json();
  return data.result;
}

/**
 * Transform database row to Listing type
 */
export function dbRowToListing(row: any): Listing {
  return {
    id: row.id,
    ethscriptionId: row.ethscription_id,
    name: row.name,
    sellerAddress: row.seller_address,
    priceWei: row.price_wei,
    priceEth: parseFloat(row.price_eth),
    status: row.status,
    depositTx: row.deposit_tx,
    chain: row.chain,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    offerCount: row.offer_count,
    highestOffer: row.highest_offer ? parseFloat(row.highest_offer) : undefined,
  };
}

/**
 * Transform database row to Offer type
 */
export function dbRowToOffer(row: any): Offer {
  return {
    id: row.id,
    listingId: row.listing_id,
    ethscriptionId: row.ethscription_id,
    buyerAddress: row.buyer_address,
    offerWei: row.offer_wei,
    offerEth: parseFloat(row.offer_eth),
    status: row.status,
    offerTx: row.offer_tx,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Transform database row to Sale type
 */
export function dbRowToSale(row: any): Sale {
  return {
    id: row.id,
    listingId: row.listing_id,
    ethscriptionId: row.ethscription_id,
    name: row.name,
    sellerAddress: row.seller_address,
    buyerAddress: row.buyer_address,
    salePriceWei: row.sale_price_wei,
    salePriceEth: parseFloat(row.sale_price_eth),
    feeWei: row.fee_wei,
    purchaseTx: row.purchase_tx,
    chain: row.chain,
    createdAt: row.created_at,
  };
}
