"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

export default function UpgradePage() {
  const { isLoaded, isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/upgrade", { method: "POST" });
      const data = await res.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.success) {
        // Dev mode - already upgraded
        window.location.href = "/dashboard?upgraded=true";
      } else {
        setError(data.error || "Failed to start checkout");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#C3FF00] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Sign in to upgrade</h1>
          <Link
            href="/sign-in"
            className="px-6 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            <span className="text-white">CHAIN</span>
            <span className="text-[#C3FF00]">HOST</span>
          </Link>
          <Link href="/dashboard" className="text-sm hover:text-[#C3FF00] transition">
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-full mb-4">
            PRO
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Upgrade to Chainhost Pro
          </h1>
          <p className="text-xl text-gray-400">
            One-time payment. Unlimited forever.
          </p>
        </div>

        <div className="border border-zinc-800 rounded-2xl p-8 mb-8">
          <div className="flex items-baseline justify-center gap-2 mb-8">
            <span className="text-5xl font-bold text-white">$5</span>
            <span className="text-gray-500">one-time</span>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex items-center gap-3">
              <span className="text-[#C3FF00]">&#10003;</span>
              <span className="text-white">Unlimited inscriptions</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-[#C3FF00]">&#10003;</span>
              <span className="text-white">Unlimited sites</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-[#C3FF00]">&#10003;</span>
              <span className="text-white">Custom templates</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-[#C3FF00]">&#10003;</span>
              <span className="text-white">Priority support</span>
            </li>
            <li className="flex items-center gap-3 text-gray-500">
              <span className="text-gray-600">&#10003;</span>
              <span>No recurring fees</span>
            </li>
          </ul>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition disabled:opacity-50"
          >
            {loading ? "Loading..." : "Upgrade Now"}
          </button>

          {error && (
            <p className="text-red-500 text-sm text-center mt-4">{error}</p>
          )}
        </div>

        <div className="text-center text-sm text-gray-600">
          <p>Secure payment via Stripe</p>
          <p className="mt-2">
            Free tier includes 5 inscriptions.{" "}
            <Link href="/dashboard" className="text-[#C3FF00] hover:underline">
              Back to dashboard
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
