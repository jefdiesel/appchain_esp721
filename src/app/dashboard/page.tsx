"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MARKETPLACE_CONTRACT, MARKETPLACE_ABI, weiToEth, getEthscriptionIdAsync } from "@/lib/marketplace";
import { getUserWalletClient, setChain } from "@/lib/wallet";

interface Listing {
  id: string;
  name: string;
  priceWei: string;
  status: string;
  createdAt: string;
  chain: string;
}

interface OwnedName {
  name: string;
  txHash: string;
}

export default function DashboardPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [ownedNames, setOwnedNames] = useState<OwnedName[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"listings" | "names">("listings");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState("");

  const cancelListing = async (listing: Listing) => {
    if (!address) return;
    setCancelling(listing.id);
    setError("");

    try {
      const ethscriptionId = await getEthscriptionIdAsync(listing.name);
      const chain = (listing.chain || "eth") as "eth" | "base";
      setChain(chain);

      const walletClient = await getUserWalletClient();
      const contractAddress = MARKETPLACE_CONTRACT[chain] as `0x${string}`;

      // Call cancelAndWithdraw on the contract
      const { createPublicClient, http, encodeFunctionData } = await import("viem");
      const { mainnet } = await import("viem/chains");

      const data = encodeFunctionData({
        abi: [{ name: "cancelAndWithdraw", type: "function", inputs: [{ name: "ethscriptionId", type: "bytes32" }], outputs: [] }],
        functionName: "cancelAndWithdraw",
        args: [ethscriptionId as `0x${string}`],
      });

      const hash = await walletClient.sendTransaction({
        to: contractAddress,
        data,
        value: 0n,
      });

      console.log("Cancel TX:", hash);

      // Update listing status in database
      await fetch(`/api/marketplace/listing/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      // Refresh data
      fetchData();
    } catch (err: any) {
      console.error("Cancel error:", err);
      setError(err.message || "Failed to cancel listing");
    }

    setCancelling(null);
  };

  useEffect(() => {
    checkWallet();
  }, []);

  useEffect(() => {
    if (address) {
      fetchData();
    }
  }, [address]);

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
    setLoading(false);
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

  const fetchData = async () => {
    if (!address) return;
    setLoading(true);

    // Fetch user's listings
    try {
      const res = await fetch(`/api/marketplace/listings?seller=${address}`);
      const data = await res.json();
      setListings(data.listings || []);
    } catch (err) {
      console.error("Fetch listings error:", err);
    }

    // Fetch user's owned names
    try {
      const API_BASE = "https://api.ethscriptions.com/v2";
      const names: OwnedName[] = [];

      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 5) {
        const res = await fetch(
          `${API_BASE}/ethscriptions?current_owner=${address}&page=${page}&per_page=100`
        );
        const data = await res.json();

        if (!data.result || data.result.length === 0) {
          hasMore = false;
          break;
        }

        for (const eth of data.result) {
          const uri = eth.content_uri || "";
          const match = uri.match(/^data:,([a-z0-9-]+)$/);
          if (match && match[1].length <= 32) {
            names.push({
              name: match[1],
              txHash: eth.transaction_hash,
            });
          }
        }

        page++;
        if (data.result.length < 100) hasMore = false;
      }

      setOwnedNames(names);
    } catch (err) {
      console.error("Fetch names error:", err);
    }

    setLoading(false);
  };

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!address) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-gray-800 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold">
              <span className="text-white">CHAIN</span>
              <span className="text-[#C3FF00]">HOST</span>
            </Link>
            <button
              onClick={connectWallet}
              className="bg-[#C3FF00] text-black hover:bg-[#d4ff4d] px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Connect Wallet
            </button>
          </div>
        </header>
        <main className="max-w-2xl mx-auto p-6 text-center py-20">
          <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
          <p className="text-gray-400 mb-8">
            Connect your wallet to view your listings and names
          </p>
          <button
            onClick={connectWallet}
            className="bg-[#C3FF00] text-black hover:bg-[#d4ff4d] px-6 py-3 rounded-lg font-semibold"
          >
            Connect Wallet
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            <span className="text-white">CHAIN</span>
            <span className="text-[#C3FF00]">HOST</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className="hover:text-[#C3FF00]">
              Marketplace
            </Link>
            <span className="text-gray-400 font-mono">{formatAddress(address)}</span>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-800">
          <button
            onClick={() => setTab("listings")}
            className={`pb-3 px-2 ${
              tab === "listings"
                ? "border-b-2 border-[#C3FF00] text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            My Listings ({listings.length})
          </button>
          <button
            onClick={() => setTab("names")}
            className={`pb-3 px-2 ${
              tab === "names"
                ? "border-b-2 border-[#C3FF00] text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            My Names ({ownedNames.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : tab === "listings" ? (
          <div>
            {listings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No active listings</p>
                <Link
                  href="/marketplace/sell"
                  className="inline-block px-6 py-3 bg-[#C3FF00] text-black font-bold rounded-lg hover:bg-[#d4ff4d]"
                >
                  List a Name for Sale
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
                  >
                    <div>
                      <span className="text-white font-mono text-lg">
                        {listing.name}
                      </span>
                      <div className="text-sm text-gray-500">
                        Listed {formatDate(listing.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[#C3FF00] font-bold">
                          {parseFloat(weiToEth(listing.priceWei)).toFixed(4)} ETH
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {listing.status}
                        </div>
                      </div>
                      <Link
                        href={`/marketplace/${listing.id}`}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
                      >
                        View
                      </Link>
                      {listing.status === "active" && (
                        <button
                          onClick={() => cancelListing(listing)}
                          disabled={cancelling === listing.id}
                          className="px-4 py-2 bg-red-900 hover:bg-red-800 disabled:bg-gray-700 rounded-lg text-sm"
                        >
                          {cancelling === listing.id ? "Cancelling..." : "Cancel & Withdraw"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {ownedNames.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No names found in your wallet</p>
                <Link
                  href="/register"
                  className="inline-block px-6 py-3 bg-[#C3FF00] text-black font-bold rounded-lg hover:bg-[#d4ff4d]"
                >
                  Register a Name
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {ownedNames.map((n) => (
                  <div
                    key={n.txHash}
                    className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
                  >
                    <div className="font-mono text-white mb-2">{n.name}</div>
                    <div className="flex gap-2">
                      <Link
                        href={`/marketplace/sell?name=${n.name}`}
                        className="flex-1 text-center text-xs py-1 bg-[#C3FF00] text-black rounded hover:bg-[#d4ff4d]"
                      >
                        Sell
                      </Link>
                      <a
                        href={`https://${n.name}.chainhost.online`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center text-xs py-1 bg-zinc-800 rounded hover:bg-zinc-700"
                      >
                        Visit
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
            >
              Register Name
            </Link>
            <Link
              href="/upload"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
            >
              Upload Site
            </Link>
            <Link
              href="/marketplace/sell"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
            >
              Sell Name
            </Link>
            <Link
              href="/marketplace"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
            >
              Browse Marketplace
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
