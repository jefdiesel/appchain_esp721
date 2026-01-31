"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getUserWalletClient, setChain } from "@/lib/wallet";
import { MARKETPLACE_CONTRACT } from "@/lib/marketplace";

interface Listing {
  id: string;
  ethscriptionId: string;
  name: string;
  priceEth: number;
  priceWei: string;
  sellerAddress: string;
  chain: "eth" | "base";
  status: string;
  createdAt: string;
}

interface Offer {
  id: string;
  buyerAddress: string;
  offerEth: number;
  offerWei: string;
  status: string;
  expiresAt?: string;
  createdAt: string;
}

interface PricePoint {
  priceEth: number;
  date: string;
  type: 'listing' | 'sale';
  txHash?: string;
}

interface PriceHistory {
  history: PricePoint[];
  stats: {
    totalSales: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    lastSalePrice: number | null;
  };
}

export default function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [address, setAddress] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [making, setMaking] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [onChainStatus, setOnChainStatus] = useState<"checking" | "valid" | "invalid" | "error">("checking");
  const [cooldownBlocks, setCooldownBlocks] = useState<number | null>(null);

  useEffect(() => {
    checkWallet();
    fetchListing();
  }, [id]);

  const checkWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = (await window.ethereum.request({
          method: "eth_accounts",
        })) as string[];
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
        }
      } catch (err) {
        console.error("Wallet check error:", err);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
        }
      } catch (err) {
        console.error("Connect error:", err);
      }
    } else {
      alert("Please install MetaMask or another wallet");
    }
  };

  const fetchListing = async () => {
    try {
      const res = await fetch(`/api/marketplace/listing/${id}`);
      const data = await res.json();
      if (data.listing) {
        setListing(data.listing);
        setOffers(data.offers || []);
        // Fetch price history after we have the name
        fetchPriceHistory(data.listing.name);
        // Verify listing exists on-chain
        verifyOnChain(data.listing);
      }
    } catch (err) {
      console.error("Failed to fetch listing:", err);
    }
    setLoading(false);
  };

  const verifyOnChain = async (listingData: Listing) => {
    setOnChainStatus("checking");
    setCooldownBlocks(null);
    try {
      const contractAddress = MARKETPLACE_CONTRACT[listingData.chain];
      const rpcUrl = listingData.chain === "base"
        ? "https://mainnet.base.org"
        : "https://ethereum-rpc.publicnode.com";

      // Batch request: getListing, listings (for listedAt), and block number
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [
              {
                to: contractAddress,
                data: `0x175c0d16${listingData.ethscriptionId.slice(2)}`, // getListing(bytes32)
              },
              "latest",
            ],
          },
          {
            jsonrpc: "2.0",
            id: 2,
            method: "eth_call",
            params: [
              {
                to: contractAddress,
                data: `0xc18b8db4${listingData.ethscriptionId.slice(2)}`, // listings(bytes32)
              },
              "latest",
            ],
          },
          {
            jsonrpc: "2.0",
            id: 3,
            method: "eth_blockNumber",
            params: [],
          },
        ]),
      });

      const results = await response.json();
      const getListingResult = results.find((r: any) => r.id === 1)?.result;
      const listingsResult = results.find((r: any) => r.id === 2)?.result;
      const blockNumberHex = results.find((r: any) => r.id === 3)?.result;

      if (getListingResult && getListingResult !== "0x") {
        const data = getListingResult.slice(2);
        const active = data.slice(0, 64);
        const isActive = parseInt(active, 16) === 1;

        if (isActive) {
          setOnChainStatus("valid");

          // Check cooldown from listings mapping
          // listings returns: seller (address), price (uint256), listedAt (uint64), active (bool)
          if (listingsResult && listingsResult !== "0x" && blockNumberHex) {
            const listingData = listingsResult.slice(2);
            // Skip seller (32 bytes) + price (32 bytes) = 64 bytes, then listedAt is next
            const listedAtHex = listingData.slice(128, 192); // bytes 64-96
            const listedAt = parseInt(listedAtHex, 16);
            const currentBlock = parseInt(blockNumberHex, 16);
            const blocksRemaining = Math.max(0, (listedAt + 5) - currentBlock);
            setCooldownBlocks(blocksRemaining);
          }
        } else {
          setOnChainStatus("invalid");
        }
      } else {
        setOnChainStatus("invalid");
      }
    } catch (err) {
      console.error("On-chain verification error:", err);
      setOnChainStatus("error");
    }
  };

  const fetchPriceHistory = async (name: string) => {
    try {
      const res = await fetch(`/api/marketplace/history?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.history) {
        setPriceHistory({
          history: data.history,
          stats: data.stats,
        });
      }
    } catch (err) {
      console.error("Failed to fetch price history:", err);
    }
  };

  const handleBuy = async () => {
    if (!listing || !address) return;

    setBuying(true);
    setError("");
    setSuccess("");

    try {
      const contractAddress = MARKETPLACE_CONTRACT[listing.chain];
      setChain(listing.chain);
      const walletClient = await getUserWalletClient();

      // Call buy function on contract
      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            name: "buy",
            type: "function",
            inputs: [{ name: "ethscriptionId", type: "bytes32" }],
            outputs: [],
            stateMutability: "payable",
          },
        ],
        functionName: "buy",
        args: [listing.ethscriptionId as `0x${string}`],
        value: BigInt(listing.priceWei),
      });

      // Record sale in database
      await fetch(`/api/marketplace/listing/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerAddress: address,
          purchaseTx: hash,
          salePriceWei: listing.priceWei,
        }),
      });

      setSuccess(`Purchase successful! TX: ${hash}`);
      fetchListing();
    } catch (err: unknown) {
      console.error("Buy error:", err);
      const message = (err as Error).message || "";
      if (message.includes("Cooldown not passed")) {
        setError("This listing was just created. Please wait ~1 minute for the security cooldown to pass.");
      } else if (message.includes("Wrong price")) {
        setError("The listing price has changed. Please refresh the page.");
      } else if (message.includes("Not listed")) {
        setError("This listing is no longer available.");
      } else if (message.includes("User rejected") || message.includes("user rejected")) {
        setError("Transaction cancelled.");
      } else {
        setError(message || "Failed to complete purchase");
      }
    }

    setBuying(false);
  };

  const handleMakeOffer = async () => {
    if (!listing || !address || !offerAmount) return;

    setMaking(true);
    setError("");
    setSuccess("");

    try {
      const offerWei = BigInt(Math.floor(parseFloat(offerAmount) * 1e18));

      const contractAddress = MARKETPLACE_CONTRACT[listing.chain];
      setChain(listing.chain);
      const walletClient = await getUserWalletClient();

      // Make offer on contract (locks ETH)
      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            name: "makeOffer",
            type: "function",
            inputs: [
              { name: "ethscriptionId", type: "bytes32" },
              { name: "expiresIn", type: "uint64" },
            ],
            outputs: [],
            stateMutability: "payable",
          },
        ],
        functionName: "makeOffer",
        args: [listing.ethscriptionId as `0x${string}`, BigInt(7200)], // ~1 day
        value: offerWei,
      });

      // Record offer in database
      await fetch("/api/marketplace/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: id,
          buyerAddress: address,
          offerWei: offerWei.toString(),
          offerTx: hash,
        }),
      });

      setSuccess(`Offer submitted! TX: ${hash}`);
      setOfferAmount("");
      fetchListing();
    } catch (err: unknown) {
      console.error("Offer error:", err);
      setError((err as Error).message || "Failed to make offer");
    }

    setMaking(false);
  };

  const handleAcceptOffer = async (offer: Offer, offerIndex: number) => {
    if (!listing || !address) return;

    setAccepting(offer.id);
    setError("");
    setSuccess("");

    try {
      const contractAddress = MARKETPLACE_CONTRACT[listing.chain];
      setChain(listing.chain);
      const walletClient = await getUserWalletClient();

      // Accept offer on contract
      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            name: "acceptOffer",
            type: "function",
            inputs: [
              { name: "ethscriptionId", type: "bytes32" },
              { name: "offerIndex", type: "uint256" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "acceptOffer",
        args: [listing.ethscriptionId as `0x${string}`, BigInt(offerIndex)],
      });

      // Update offer status in database
      await fetch(`/api/marketplace/offers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          action: "accept",
          userAddress: address,
        }),
      });

      setSuccess(`Offer accepted! TX: ${hash}`);
      fetchListing();
    } catch (err: unknown) {
      console.error("Accept offer error:", err);
      setError((err as Error).message || "Failed to accept offer");
    }

    setAccepting(null);
  };

  const handleCancelOffer = async (offer: Offer, offerIndex: number) => {
    if (!listing || !address) return;

    setCancelling(offer.id);
    setError("");
    setSuccess("");

    try {
      const contractAddress = MARKETPLACE_CONTRACT[listing.chain];
      setChain(listing.chain);
      const walletClient = await getUserWalletClient();

      // Cancel offer on contract
      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            name: "cancelOffer",
            type: "function",
            inputs: [
              { name: "ethscriptionId", type: "bytes32" },
              { name: "offerIndex", type: "uint256" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "cancelOffer",
        args: [listing.ethscriptionId as `0x${string}`, BigInt(offerIndex)],
      });

      // Update offer status in database
      await fetch(`/api/marketplace/offers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          action: "cancel",
          userAddress: address,
        }),
      });

      setSuccess(`Offer cancelled! TX: ${hash}`);
      fetchListing();
    } catch (err: unknown) {
      console.error("Cancel offer error:", err);
      setError((err as Error).message || "Failed to cancel offer");
    }

    setCancelling(null);
  };

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const isOwner =
    listing && address?.toLowerCase() === listing.sellerAddress.toLowerCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <div>Listing not found</div>
        <Link href="/marketplace" className="text-[#C3FF00] hover:underline">
          Back to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />

      <main className="max-w-4xl mx-auto p-6">
        <Link
          href="/marketplace"
          className="text-gray-400 hover:text-white mb-6 inline-block"
        >
          &larr; Back to marketplace
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Listing Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="text-4xl font-mono font-bold text-[#C3FF00] mb-4">
              {listing.name}
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-gray-400 text-sm">Price</div>
                <div className="text-3xl font-bold">
                  {listing.priceEth.toFixed(4)} ETH
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-sm">Seller</div>
                <div className="font-mono text-sm">{listing.sellerAddress}</div>
              </div>

              <div>
                <div className="text-gray-400 text-sm">Chain</div>
                <div>{listing.chain.toUpperCase()}</div>
              </div>

              <div>
                <div className="text-gray-400 text-sm">Status</div>
                <div
                  className={
                    listing.status === "active"
                      ? "text-[#C3FF00]"
                      : "text-gray-400"
                  }
                >
                  {listing.status.toUpperCase()}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-sm">On-Chain</div>
                <div
                  className={
                    onChainStatus === "valid"
                      ? "text-[#C3FF00]"
                      : onChainStatus === "invalid"
                      ? "text-red-400"
                      : onChainStatus === "error"
                      ? "text-yellow-400"
                      : "text-gray-400"
                  }
                >
                  {onChainStatus === "checking" && "Verifying..."}
                  {onChainStatus === "valid" && "Verified"}
                  {onChainStatus === "invalid" && "Not Listed"}
                  {onChainStatus === "error" && "Check Failed"}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-sm">Listed</div>
                <div>{formatDate(listing.createdAt)}</div>
              </div>

              <div>
                <div className="text-gray-400 text-sm">Ethscription ID</div>
                <div className="font-mono text-xs break-all text-gray-500">
                  {listing.ethscriptionId}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-6">
            {listing.status === "active" && (
              <>
                {!address ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="text-center mb-4">
                      Connect wallet to buy or make offers
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={connectWallet}
                        className="bg-[#C3FF00] text-black hover:bg-[#d4ff4d] px-6 py-3 rounded-lg font-semibold"
                      >
                        Connect Wallet
                      </button>
                    </div>
                  </div>
                ) : isOwner ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="text-yellow-400 mb-4">
                      This is your listing
                    </div>
                    <Link
                      href="/dashboard"
                      className="block text-center bg-zinc-700 hover:bg-zinc-600 px-6 py-3 rounded-lg"
                    >
                      Manage in Dashboard
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Buy Now */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                      <div className="text-xl font-bold mb-4">Buy Now</div>

                      {onChainStatus === "invalid" && (
                        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-4 text-red-300 text-sm">
                          This listing is not registered on the smart contract.
                          The seller may need to complete the listing process.
                        </div>
                      )}

                      {onChainStatus === "checking" && (
                        <div className="bg-zinc-800 rounded-lg p-4 mb-4 text-gray-400 text-sm">
                          Verifying listing on blockchain...
                        </div>
                      )}

                      {onChainStatus === "valid" && cooldownBlocks !== null && cooldownBlocks > 0 && (
                        <div className="bg-yellow-900/50 border border-yellow-500 rounded-lg p-4 mb-4 text-yellow-300 text-sm">
                          <div className="font-semibold mb-1">Recently Listed</div>
                          <div>This listing will be available to buy in ~{cooldownBlocks} block{cooldownBlocks !== 1 ? 's' : ''} (~{Math.ceil(cooldownBlocks * 12 / 60)} min).</div>
                          <div className="text-yellow-400/70 text-xs mt-1">Security cooldown prevents frontrunning attacks.</div>
                        </div>
                      )}

                      <button
                        onClick={handleBuy}
                        disabled={buying || onChainStatus !== "valid" || (cooldownBlocks !== null && cooldownBlocks > 0)}
                        className="w-full bg-[#C3FF00] text-black hover:bg-[#d4ff4d] disabled:bg-zinc-600 disabled:text-gray-400 px-6 py-3 rounded-lg font-bold text-lg"
                      >
                        {buying
                          ? "Processing..."
                          : onChainStatus === "checking"
                          ? "Verifying..."
                          : onChainStatus === "invalid"
                          ? "Not Available"
                          : cooldownBlocks !== null && cooldownBlocks > 0
                          ? `Available in ~${cooldownBlocks} blocks`
                          : `Buy for ${listing.priceEth.toFixed(4)} ETH`}
                      </button>
                      <div className="text-gray-400 text-sm mt-2 text-center">
                        2.5% platform fee included
                      </div>
                    </div>

                    {/* Make Offer */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                      <div className="text-xl font-bold mb-4">Make Offer</div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="0.00 ETH"
                          value={offerAmount}
                          onChange={(e) => setOfferAmount(e.target.value)}
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-[#C3FF00]"
                        />
                        <button
                          onClick={handleMakeOffer}
                          disabled={making || !offerAmount}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 px-6 py-3 rounded-lg font-bold"
                        >
                          {making ? "..." : "Offer"}
                        </button>
                      </div>
                      <div className="text-gray-400 text-sm mt-2">
                        ETH will be locked in escrow until accepted or cancelled
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {listing.status === "sold" && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                <div className="text-2xl font-bold text-red-400">SOLD</div>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-[#C3FF00]/10 border border-[#C3FF00] rounded-lg p-4 text-[#C3FF00]">
                {success}
              </div>
            )}

            {/* Current Offers */}
            {offers.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="text-xl font-bold mb-4">
                  Offers ({offers.length})
                </div>
                <div className="space-y-3">
                  {offers.map((offer, index) => (
                    <div
                      key={offer.id}
                      className="flex justify-between items-center py-3 px-3 bg-zinc-800/50 rounded-lg"
                    >
                      <div>
                        <div className="font-mono text-sm">
                          {formatAddress(offer.buyerAddress)}
                          {address?.toLowerCase() === offer.buyerAddress.toLowerCase() && (
                            <span className="ml-2 text-[#C3FF00] text-xs">(You)</span>
                          )}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {formatDate(offer.createdAt)}
                          {offer.expiresAt && (
                            <span className="ml-2">· Expires {formatDate(offer.expiresAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold">
                          {offer.offerEth.toFixed(4)} ETH
                        </div>
                        {/* Seller can accept */}
                        {isOwner && offer.status === "pending" && (
                          <button
                            onClick={() => handleAcceptOffer(offer, index)}
                            disabled={accepting === offer.id}
                            className="bg-[#C3FF00] text-black hover:bg-[#d4ff4d] disabled:bg-zinc-600 px-3 py-1 rounded text-sm font-semibold"
                          >
                            {accepting === offer.id ? "..." : "Accept"}
                          </button>
                        )}
                        {/* Buyer can cancel their own offer */}
                        {address?.toLowerCase() === offer.buyerAddress.toLowerCase() && offer.status === "pending" && (
                          <button
                            onClick={() => handleCancelOffer(offer, index)}
                            disabled={cancelling === offer.id}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-zinc-600 px-3 py-1 rounded text-sm font-semibold"
                          >
                            {cancelling === offer.id ? "..." : "Cancel"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price History */}
            {priceHistory && priceHistory.history.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="text-xl font-bold mb-4">Price History</div>

                {/* Stats */}
                {priceHistory.stats.totalSales > 0 && (
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-gray-400">Total Sales</div>
                      <div className="font-bold text-[#C3FF00]">{priceHistory.stats.totalSales}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Avg Price</div>
                      <div className="font-bold">{priceHistory.stats.avgPrice.toFixed(4)} ETH</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Min / Max</div>
                      <div className="font-bold">
                        {priceHistory.stats.minPrice.toFixed(4)} / {priceHistory.stats.maxPrice.toFixed(4)} ETH
                      </div>
                    </div>
                    {priceHistory.stats.lastSalePrice && (
                      <div>
                        <div className="text-gray-400">Last Sale</div>
                        <div className="font-bold">{priceHistory.stats.lastSalePrice.toFixed(4)} ETH</div>
                      </div>
                    )}
                  </div>
                )}

                {/* History Timeline */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {priceHistory.history.slice().reverse().map((point, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            point.type === 'sale'
                              ? 'bg-green-900 text-green-400'
                              : 'bg-blue-900 text-blue-400'
                          }`}
                        >
                          {point.type.toUpperCase()}
                        </span>
                        <span className="text-gray-400">
                          {new Date(point.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="font-bold">{point.priceEth.toFixed(4)} ETH</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
