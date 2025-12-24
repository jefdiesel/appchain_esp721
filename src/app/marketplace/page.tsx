"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Listing {
  id: string;
  name: string;
  priceEth: number;
  sellerAddress: string;
  chain: string;
  createdAt: string;
  offerCount?: number;
  highestOffer?: number;
}

interface Stats {
  activeListings: number;
  totalSales: number;
  totalVolumeEth: number;
  avgSalePriceEth: number;
}

export default function MarketplacePage() {
  const [address, setAddress] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    checkWallet();
    fetchListings();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchListings();
  }, [search, sort, order, page]);

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

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "24",
        sort,
        order,
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/marketplace/listings?${params}`);
      const data = await res.json();

      if (data.listings) {
        setListings(data.listings);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      console.error("Failed to fetch listings:", err);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/marketplace/stats");
      const data = await res.json();
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

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
            <Link href="/register" className="hover:text-gray-300">
              register
            </Link>
            <Link href="/dashboard" className="hover:text-gray-300">
              dashboard
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

      <main className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">
                {stats.activeListings}
              </div>
              <div className="text-gray-400 text-sm">Active Listings</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">
                {stats.totalSales}
              </div>
              <div className="text-gray-400 text-sm">Total Sales</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">
                {stats.totalVolumeEth.toFixed(2)} ETH
              </div>
              <div className="text-gray-400 text-sm">Total Volume</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">
                {stats.avgSalePriceEth.toFixed(4)} ETH
              </div>
              <div className="text-gray-400 text-sm">Avg Sale Price</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search names..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
          />
          <select
            value={`${sort}-${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split("-");
              setSort(s);
              setOrder(o);
              setPage(1);
            }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="price_eth-asc">Price: Low to High</option>
            <option value="price_eth-desc">Price: High to Low</option>
            <option value="name-asc">Name: A-Z</option>
            <option value="name-desc">Name: Z-A</option>
          </select>
          {address && (
            <Link
              href="/marketplace/sell"
              className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium text-center"
            >
              Sell Name
            </Link>
          )}
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">
            Loading listings...
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 mb-4">No listings found</div>
            {address && (
              <Link
                href="/marketplace/sell"
                className="text-green-400 hover:underline"
              >
                Be the first to list a name!
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/marketplace/${listing.id}`}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-green-500 transition-colors"
              >
                <div className="text-xl font-mono font-bold text-green-400 mb-2">
                  {listing.name}
                </div>
                <div className="text-2xl font-bold mb-2">
                  {listing.priceEth.toFixed(4)} ETH
                </div>
                <div className="text-gray-400 text-sm mb-2">
                  Seller: {formatAddress(listing.sellerAddress)}
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{listing.chain.toUpperCase()}</span>
                  <span>{formatDate(listing.createdAt)}</span>
                </div>
                {listing.offerCount && listing.offerCount > 0 && (
                  <div className="mt-2 text-xs text-yellow-400">
                    {listing.offerCount} offer
                    {listing.offerCount > 1 ? "s" : ""}
                    {listing.highestOffer &&
                      ` (highest: ${listing.highestOffer.toFixed(4)} ETH)`}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-4 py-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
