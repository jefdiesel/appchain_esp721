"use client";

import { useState } from "react";
import Link from "next/link";

interface Ethscription {
  transaction_hash: string;
  content_uri?: string;
}

export default function ResolvePage() {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "resolving" | "found" | "not_found" | "error">("idle");
  const [error, setError] = useState("");
  const [holdings, setHoldings] = useState<Ethscription[]>([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  const resolve = async (n?: string) => {
    const query = (n || name).trim();
    if (!query) return;

    setStatus("resolving");
    setError("");
    setOwner(null);
    setHoldings([]);

    try {
      const content = `data:,${query}`;
      const msgBuffer = new TextEncoder().encode(content);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const sha = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const res = await fetch(
        `https://api.ethscriptions.com/v2/ethscriptions/exists/0x${sha}`
      );
      const data = await res.json();

      if (data.result?.exists) {
        const addr = data.result.ethscription.current_owner.toLowerCase();
        setOwner(addr);
        setStatus("found");
        fetchHoldings(addr);
      } else {
        setStatus("not_found");
      }
    } catch {
      setStatus("error");
      setError("Failed to resolve name");
    }
  };

  const fetchHoldings = async (addr: string) => {
    setLoadingHoldings(true);
    try {
      const res = await fetch(
        `https://api.ethscriptions.com/v2/ethscriptions?current_owner=${addr}&per_page=50`
      );
      const data = await res.json();
      setHoldings(data.result || []);
    } catch {
      // silent fail for holdings
    } finally {
      setLoadingHoldings(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold flex items-center gap-2">
            <img src="/favicon.png" alt="" className="w-5 h-5" />
            <span>
              <span className="text-white">Chain</span>
              <span className="text-[#C3FF00]">Host</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/register" className="text-sm text-gray-400 hover:text-white">
              Register
            </Link>
            <Link href="/mint/" className="text-sm text-gray-400 hover:text-white">
              Mint
            </Link>
            <Link href="/upload" className="text-sm text-gray-400 hover:text-white">
              Upload Site
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-center mb-4">Resolve Name</h1>
        <p className="text-gray-500 text-center mb-12">
          Look up any ethscription name to find its owner and their holdings.
        </p>

        {/* Search */}
        <div className="space-y-4">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden focus-within:border-[#C3FF00]">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value.toLowerCase().replace(/\s/g, ""));
                setStatus("idle");
              }}
              onKeyDown={(e) => e.key === "Enter" && resolve()}
              className="flex-1 bg-transparent px-4 py-4 text-xl focus:outline-none"
              placeholder="Look up ethscription name"
            />
            <button
              onClick={() => resolve()}
              disabled={!name.trim() || status === "resolving"}
              className="px-6 py-4 bg-[#C3FF00] text-black font-semibold hover:bg-[#d4ff4d] transition disabled:opacity-40"
            >
              {status === "resolving" ? "..." : "Resolve"}
            </button>
          </div>

          {/* Not found */}
          {status === "not_found" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-gray-400 mb-2">
                <span className="text-red-400 font-semibold">Not found.</span>{" "}
                <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">data:,{name}</code> is not inscribed.
              </p>
              <Link
                href={`/register`}
                className="text-sm text-[#C3FF00] hover:underline"
              >
                Register this name →
              </Link>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-2 text-sm text-gray-400 hover:text-white"
              >
                Try again
              </button>
            </div>
          )}

          {/* Found - Owner */}
          {status === "found" && owner && (
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Owner
                </h2>
                <p className="font-mono text-sm break-all text-white">{owner}</p>
              </div>

              {/* Holdings */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Holdings
                </h2>
                {loadingHoldings ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-zinc-600 border-t-[#C3FF00] rounded-full animate-spin" />
                  </div>
                ) : holdings.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No ethscriptions found.</p>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {holdings.map((e) => (
                      <a
                        key={e.transaction_hash}
                        href={`https://ethscriptions.com/ethscriptions/${e.transaction_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square bg-zinc-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-[#C3FF00] transition"
                      >
                        <img
                          src={`https://api.ethscriptions.com/v2/ethscriptions/${e.transaction_hash}/content`}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(ev) => {
                            const target = ev.currentTarget;
                            target.style.display = "none";
                            const uri = e.content_uri || "";
                            if (uri.startsWith("data:,")) {
                              const span = document.createElement("span");
                              span.className = "flex items-center justify-center w-full h-full text-[10px] text-gray-500 p-1 break-all";
                              span.textContent = decodeURIComponent(uri.slice(6)).slice(0, 20);
                              target.parentElement?.appendChild(span);
                            }
                          }}
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Action links */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/register"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:border-[#C3FF00] transition"
                >
                  <p className="text-[#C3FF00] font-semibold text-sm">Register Names</p>
                  <p className="text-gray-500 text-xs mt-1">Claim more names</p>
                </Link>
                <Link
                  href="/mail"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:border-[#C3FF00] transition"
                >
                  <p className="text-[#C3FF00] font-semibold text-sm">Mail</p>
                  <p className="text-gray-500 text-xs mt-1">Send & receive mail</p>
                </Link>
                <Link
                  href="/upload"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:border-[#C3FF00] transition"
                >
                  <p className="text-[#C3FF00] font-semibold text-sm">Upload Site</p>
                  <p className="text-gray-500 text-xs mt-1">Host a web page in call data</p>
                </Link>
                <Link
                  href="/mint"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:border-[#C3FF00] transition"
                >
                  <p className="text-[#C3FF00] font-semibold text-sm">Mint Token</p>
                  <p className="text-gray-500 text-xs mt-1">Launch a shitcoin</p>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
