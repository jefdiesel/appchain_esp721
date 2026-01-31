"use client";

import { useState } from "react";
import Link from "next/link";

const links = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/mint", label: "Mint" },
  { href: "/register", label: "Register" },
  { href: "/resolve", label: "Resolve" },
  { href: "/upload", label: "Upload Site" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

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
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden flex flex-col gap-1.5 p-2"
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
