"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "claiming" | "claimed" | "error">("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  // Validate name (no spaces, lowercase, alphanumeric + hyphen)
  const validateName = (n: string) => {
    return /^[a-zA-Z0-9-]+$/.test(n) && n.length >= 1 && n.length <= 32;
  };

  const nameError = name && !validateName(name)
    ? "Letters, numbers, and hyphens only. No spaces."
    : "";

  // Check availability via Ethscriptions API (no wallet needed)
  const checkAvailability = async () => {
    if (!validateName(name)) return;

    setStatus("checking");
    setError("");
    setOwner(null);

    try {
      // Compute SHA256 of data:,name
      const content = `data:,${name}`;
      const msgBuffer = new TextEncoder().encode(content);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      const res = await fetch(`https://api.ethscriptions.com/v2/ethscriptions/exists/0x${sha}`);
      const data = await res.json();

      if (data.result?.exists) {
        const ownerAddr = data.result.ethscription.current_owner.toLowerCase();
        setOwner(ownerAddr);
        setStatus("taken");
      } else {
        setStatus("available");
      }
    } catch (e) {
      setStatus("error");
      setError("Failed to check availability");
    }
  };

  // Check if connected wallet owns the name
  const isOwnedByUser = wallet && owner && wallet.toLowerCase() === owner.toLowerCase();

  // Claim name by inscribing data:,name on Ethereum
  const claimName = async () => {
    if (!window.ethereum) {
      setError("Please install MetaMask or another wallet");
      return;
    }

    setStatus("claiming");
    setError("");

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts.length) throw new Error("No accounts found");
      setWallet(accounts[0].toLowerCase());

      // Ensure on Ethereum mainnet
      const chainId = await window.ethereum.request({ method: "eth_chainId" }) as string;
      if (chainId !== "0x1") {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x1" }],
        });
      }

      // Create calldata: data:,name as hex
      const content = `data:,${name}`;
      const hex = "0x" + Array.from(new TextEncoder().encode(content))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      // Send transaction to self
      const tx = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: accounts[0],
          to: accounts[0],
          data: hex,
          value: "0x0",
        }],
      }) as string;

      setTxHash(tx);
      setStatus("claimed");
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to claim name");
    }
  };

  // Connect wallet to check ownership
  const connectToCheck = async () => {
    if (!window.ethereum) {
      setError("Please install MetaMask or another wallet");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      if (accounts.length) {
        setWallet(accounts[0].toLowerCase());
      }
    } catch (e) {
      setError("Failed to connect wallet");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            <span className="text-white">CHAIN</span>
            <span className="text-[#C3FF00]">HOST</span>
          </Link>
          <Link href="/upload" className="text-sm text-gray-400 hover:text-white">
            Upload Site
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-center mb-4">
          Claim Your Name
        </h1>
        <p className="text-gray-500 text-center mb-12">
          Register a permanent name on Ethereum. First come, first served, forever.
        </p>

        {/* Rules */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Name Rules
          </h2>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2">
              <span className="text-[#C3FF00]">✓</span>
              Lowercase letters, numbers, hyphens
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-400">✗</span>
              No spaces or special characters
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#C3FF00]">✓</span>
              1-32 characters
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gray-500">→</span>
              Inscribed as <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">data:,yourname</code>
            </li>
          </ul>
        </div>

        {/* Input */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden focus-within:border-[#C3FF00]">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value.replace(/\s/g, ""));
                  setStatus("idle");
                  setOwner(null);
                }}
                className="flex-1 bg-transparent px-4 py-4 text-xl focus:outline-none"
                placeholder="yourname"
                maxLength={32}
              />
              <span className="text-gray-500 pr-4">.chainhost.online</span>
            </div>
            {nameError && (
              <p className="text-red-400 text-sm mt-2">{nameError}</p>
            )}
          </div>

          {/* Check button */}
          {status === "idle" && name && !nameError && (
            <button
              onClick={checkAvailability}
              className="w-full py-4 bg-zinc-800 text-white font-semibold rounded-xl hover:bg-zinc-700 transition"
            >
              Check Availability
            </button>
          )}

          {/* Checking */}
          {status === "checking" && (
            <div className="text-center py-4 text-gray-400">
              Checking ethscriptions...
            </div>
          )}

          {/* Taken - check if user owns it */}
          {status === "taken" && (
            <div className="space-y-4">
              {isOwnedByUser ? (
                <div className="bg-[#C3FF00]/10 border border-[#C3FF00] rounded-xl p-6 text-center space-y-4">
                  <div className="text-[#C3FF00] text-2xl">✓</div>
                  <h2 className="text-xl font-bold text-white">
                    You own {name}.chainhost.online!
                  </h2>
                  <p className="text-sm text-gray-400">
                    This name is already registered to your wallet.
                  </p>
                  <Link
                    href={`/upload?name=${name}`}
                    className="block mt-4 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
                  >
                    Upload Your Site →
                  </Link>
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                  <p className="text-red-400 font-semibold mb-1">Name Taken</p>
                  <p className="text-sm text-gray-500">
                    Owned by {owner?.slice(0, 6)}...{owner?.slice(-4)}
                  </p>
                  {!wallet && (
                    <button
                      onClick={connectToCheck}
                      className="mt-3 text-sm text-[#C3FF00] hover:underline"
                    >
                      Connect wallet to check if it&apos;s yours
                    </button>
                  )}
                  <button
                    onClick={() => { setName(""); setStatus("idle"); setOwner(null); }}
                    className="block mx-auto mt-3 text-sm text-gray-400 hover:text-white"
                  >
                    Try another name
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Available */}
          {status === "available" && (
            <div className="space-y-4">
              <div className="bg-[#C3FF00]/10 border border-[#C3FF00]/30 rounded-xl p-4 text-center">
                <p className="text-[#C3FF00] font-semibold">Available!</p>
                <p className="text-sm text-gray-400 mt-1">
                  <code>data:,{name}</code> is not claimed
                </p>
              </div>

              <button
                onClick={claimName}
                className="w-full py-4 bg-[#C3FF00] text-black font-bold rounded-xl hover:bg-[#d4ff4d] transition"
              >
                Connect & Claim on Ethereum
              </button>

              <p className="text-xs text-gray-600 text-center">
                This will inscribe <code>data:,{name}</code> on Ethereum L1.
                You&apos;ll pay gas (~$0.01).
              </p>
            </div>
          )}

          {/* Claiming */}
          {status === "claiming" && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-[#C3FF00] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Confirm in your wallet...</p>
            </div>
          )}

          {/* Claimed */}
          {status === "claimed" && (
            <div className="bg-[#C3FF00]/10 border border-[#C3FF00] rounded-xl p-6 text-center space-y-4">
              <div className="text-[#C3FF00] text-2xl">✓</div>
              <h2 className="text-xl font-bold text-white">
                {name}.chainhost.online is yours!
              </h2>
              <p className="text-sm text-gray-400 font-mono break-all">
                {txHash}
              </p>
              <p className="text-xs text-gray-500">Wait ~30 seconds for the block to confirm</p>
              <div className="flex gap-3 justify-center">
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  className="text-sm text-[#C3FF00] hover:underline"
                >
                  View on Etherscan →
                </a>
              </div>
              <Link
                href={`/upload?name=${name}`}
                className="block mt-4 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
              >
                Upload Your Site →
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
        </div>
      </main>
    </div>
  );
}
