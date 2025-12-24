"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
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
  status: string;
  createdAt: string;
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
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [making, setMaking] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      }
    } catch (err) {
      console.error("Failed to fetch listing:", err);
    }
    setLoading(false);
  };

  const handleBuy = async () => {
    if (!listing || !address) return;

    setBuying(true);
    setError("");
    setSuccess("");

    try {
      const contractAddress = MARKETPLACE_CONTRACT[listing.chain];
      if (contractAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("Marketplace contract not deployed yet");
      }

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
      setError((err as Error).message || "Failed to complete purchase");
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
      if (contractAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("Marketplace contract not deployed yet");
      }

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
        <Link href="/marketplace" className="text-green-400 hover:underline">
          Back to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            chainhost
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className="text-green-400">
              marketplace
            </Link>
            {address ? (
              <span className="text-gray-400">{formatAddress(address)}</span>
            ) : (
              <button
                onClick={connectWallet}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm"
              >
                Connect Wallet
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <Link
          href="/marketplace"
          className="text-gray-400 hover:text-white mb-6 inline-block"
        >
          &larr; Back to marketplace
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Listing Info */}
          <div className="bg-gray-900 rounded-lg p-6">
            <div className="text-4xl font-mono font-bold text-green-400 mb-4">
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
                <div className="font-mono">{listing.sellerAddress}</div>
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
                      ? "text-green-400"
                      : "text-gray-400"
                  }
                >
                  {listing.status.toUpperCase()}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-sm">Listed</div>
                <div>{formatDate(listing.createdAt)}</div>
              </div>

              <div>
                <div className="text-gray-400 text-sm">Ethscription ID</div>
                <div className="font-mono text-xs break-all">
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
                  <div className="bg-gray-900 rounded-lg p-6">
                    <div className="text-center mb-4">
                      Connect wallet to buy or make offers
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={connectWallet}
                        className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg"
                      >
                        Connect Wallet
                      </button>
                    </div>
                  </div>
                ) : isOwner ? (
                  <div className="bg-gray-900 rounded-lg p-6">
                    <div className="text-yellow-400 mb-4">
                      This is your listing
                    </div>
                    <Link
                      href="/dashboard"
                      className="block text-center bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg"
                    >
                      Manage in Dashboard
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Buy Now */}
                    <div className="bg-gray-900 rounded-lg p-6">
                      <div className="text-xl font-bold mb-4">Buy Now</div>
                      <button
                        onClick={handleBuy}
                        disabled={buying}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold text-lg"
                      >
                        {buying
                          ? "Processing..."
                          : `Buy for ${listing.priceEth.toFixed(4)} ETH`}
                      </button>
                      <div className="text-gray-400 text-sm mt-2 text-center">
                        2.5% platform fee included
                      </div>
                    </div>

                    {/* Make Offer */}
                    <div className="bg-gray-900 rounded-lg p-6">
                      <div className="text-xl font-bold mb-4">Make Offer</div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="0.00 ETH"
                          value={offerAmount}
                          onChange={(e) => setOfferAmount(e.target.value)}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
                        />
                        <button
                          onClick={handleMakeOffer}
                          disabled={making || !offerAmount}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold"
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
              <div className="bg-gray-900 rounded-lg p-6 text-center">
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
              <div className="bg-green-900/50 border border-green-500 rounded-lg p-4 text-green-300">
                {success}
              </div>
            )}

            {/* Current Offers */}
            {offers.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-6">
                <div className="text-xl font-bold mb-4">
                  Offers ({offers.length})
                </div>
                <div className="space-y-2">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0"
                    >
                      <div>
                        <div className="font-mono text-sm">
                          {formatAddress(offer.buyerAddress)}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {formatDate(offer.createdAt)}
                        </div>
                      </div>
                      <div className="text-lg font-bold">
                        {offer.offerEth.toFixed(4)} ETH
                      </div>
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
