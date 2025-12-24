"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Site {
  name: string;
  owner: string;
  manifestTx: string;
  timestamp: number;
}

export default function FeedPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/feed")
      .then((res) => res.json())
      .then((data) => {
        setSites(data.sites || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            <span className="text-white">CHAIN</span>
            <span className="text-[#C3FF00]">HOST</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/register"
              className="text-sm text-gray-400 hover:text-white"
            >
              Register
            </Link>
            <Link
              href="/upload"
              className="text-sm text-gray-400 hover:text-white"
            >
              Upload
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-center mb-2">Live Sites</h1>
        <p className="text-gray-500 text-center mb-8">
          All sites deployed on chainhost, newest first
        </p>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading sites...</div>
        ) : sites.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No sites yet. Be the first!</p>
            <Link
              href="/register"
              className="inline-block px-6 py-3 bg-[#C3FF00] text-black font-bold rounded-lg hover:bg-[#d4ff4d]"
            >
              Claim a Name
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sites.map((site) => (
              <a
                key={site.manifestTx}
                href={`https://${site.name}.chainhost.online`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-[#C3FF00] transition group"
              >
                <div>
                  <span className="text-white font-medium group-hover:text-[#C3FF00] transition">
                    {site.name}
                  </span>
                  <span className="text-gray-500">.chainhost.online</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 font-mono">
                    {site.owner.slice(0, 6)}...{site.owner.slice(-4)}
                  </span>
                  {site.timestamp > 0 && (
                    <span className="text-xs text-gray-600">
                      {new Date(site.timestamp * 1000).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-8">
          Only showing sites with valid manifests (lowercase names)
        </p>
      </main>
    </div>
  );
}
