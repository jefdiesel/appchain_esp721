"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const links = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/mint", label: "Mint" },
  { href: "/register", label: "Register" },
  { href: "/resolve", label: "Resolve" },
  { href: "/upload", label: "Upload Site" },
];

function formatAddress(addr: string) {
  return addr.slice(0, 6) + "\u2026" + addr.slice(-4);
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    if (!(window as any).ethereum) return;
    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      }) as string[];
      if (accounts.length) setAddress(accounts[0].toLowerCase());
    } catch {}
  }, []);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
  }, []);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((accs: string[]) => {
      if (accs.length) setAddress(accs[0].toLowerCase());
    }).catch(() => {});
    const onChange = (accs: string[]) => {
      setAddress(accs.length ? accs[0].toLowerCase() : null);
    };
    eth.on?.("accountsChanged", onChange);
    return () => eth.removeListener?.("accountsChanged", onChange);
  }, []);

  return (
    <nav className="border-b border-zinc-800 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold flex items-center gap-2">
          <img src="/favicon.png" alt="" className="w-5 h-5" />
          <span>
            <span className="text-white">Chain</span>
            <span className="text-[#C3FF00]">Host</span>
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-sm text-gray-400 hover:text-[#C3FF00] transition"
            >
              {l.label}
            </Link>
          ))}
          {address ? (
            <button
              onClick={disconnectWallet}
              className="px-3 py-2 text-sm text-gray-400 font-mono hover:text-red-400 transition"
              title="Disconnect"
            >
              {formatAddress(address)}
            </button>
          ) : (
            <button
              onClick={connectWallet}
              className="px-4 py-2 bg-[#C3FF00] text-black text-sm font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
            >
              Connect
            </button>
          )}
        </div>

        {/* Mobile: wallet + hamburger */}
        <div className="flex md:hidden items-center gap-3">
          {address ? (
            <button
              onClick={disconnectWallet}
              className="text-xs text-gray-400 font-mono hover:text-red-400 transition"
              title="Disconnect"
            >
              {formatAddress(address)}
            </button>
          ) : (
            <button
              onClick={connectWallet}
              className="px-3 py-1.5 bg-[#C3FF00] text-black text-xs font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
            >
              Connect
            </button>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="flex flex-col gap-1.5 p-2"
            aria-label="Menu"
          >
            <span
              className={`block w-5 h-0.5 bg-gray-400 transition-transform ${
                open ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-gray-400 transition-opacity ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-gray-400 transition-transform ${
                open ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mt-4 pb-2 border-t border-zinc-800 pt-4">
          <div className="max-w-6xl mx-auto flex flex-col gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm text-gray-400 hover:text-[#C3FF00] transition"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
