"use client";

import { useState, useEffect } from "react";

interface Site {
  name: string;
  owner: string;
  manifestTx: string;
  timestamp: number;
}

export default function SiteFeed() {
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

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading sites...
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No sites yet. Be the first!
      </div>
    );
  }

  return (
    <div className="grid gap-3">
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
          <div className="text-xs text-gray-600">
            {site.timestamp
              ? new Date(site.timestamp * 1000).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : ""}
          </div>
        </a>
      ))}
    </div>
  );
}
