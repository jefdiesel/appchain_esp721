"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Ethscription {
  transaction_hash: string;
  content_uri?: string;
}

export default function ResolveNamePage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name || "");

  const [owner, setOwner] = useState<string | null>(null);
  const [status, setStatus] = useState<"resolving" | "found" | "not_found" | "error">("resolving");
  const [holdings, setHoldings] = useState<Ethscription[]>([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  useEffect(() => {
    if (!name) return;
    (async () => {
      try {
        const content = `data:,${name}`;
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

          // Fetch holdings
          setLoadingHoldings(true);
          try {
            const hRes = await fetch(
              `https://api.ethscriptions.com/v2/ethscriptions?current_owner=${addr}&per_page=50`
            );
            const hData = await hRes.json();
            setHoldings(hData.result || []);
          } catch {
            // silent
          } finally {
            setLoadingHoldings(false);
          }
        } else {
          setStatus("not_found");
        }
      } catch {
        setStatus("error");
      }
    })();
  }, [name]);

  return (
    <div className="min-h-screen bg-black text-white">
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
            <Link href="/resolve" className="text-sm text-gray-400 hover:text-white">
              Resolve
            </Link>
            <Link href="/register" className="text-sm text-gray-400 hover:text-white">
              Register
            </Link>
            <Link href="/upload" className="text-sm text-gray-400 hover:text-white">
              Upload Site
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-center mb-2">{name}</h1>
        <p className="text-gray-500 text-center mb-12">
          <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">data:,{name}</code>
        </p>

        {status === "resolving" && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-[#C3FF00] rounded-full animate-spin" />
          </div>
        )}

        {status === "not_found" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-gray-400 mb-3">
              <span className="text-red-400 font-semibold">Not found.</span> This name is not inscribed.
            </p>
            <Link href="/register" className="text-sm text-[#C3FF00] hover:underline">
              Register this name →
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <p className="text-red-400">Failed to resolve name</p>
            <Link href="/resolve" className="mt-2 text-sm text-gray-400 hover:text-white">
              Try another name
            </Link>
          </div>
        )}

        {status === "found" && owner && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Owner
              </h2>
              <p className="font-mono text-sm break-all text-white">{owner}</p>
            </div>

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
      </main>
    </div>
  );
}
