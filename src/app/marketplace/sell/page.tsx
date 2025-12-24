"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getUserWalletClient, setChain, type ChainOption } from "@/lib/wallet";
import {
  MARKETPLACE_CONTRACT,
  getEthscriptionIdAsync,
  ethToWei,
} from "@/lib/marketplace";

interface OwnedName {
  name: string;
  txHash: string;
  ethscriptionId: string;
}

export default function SellPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [ownedNames, setOwnedNames] = useState<OwnedName[]>([]);
  const [selectedName, setSelectedName] = useState<OwnedName | null>(null);
  const [price, setPrice] = useState("");
  const [chain, setChainState] = useState<ChainOption>("eth");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState<"select" | "deposit" | "list" | "done">(
    "select"
  );
  const [error, setError] = useState("");
  const [depositTx, setDepositTx] = useState("");
  const [listingId, setListingId] = useState("");

  useEffect(() => {
    checkWallet();
  }, []);

  useEffect(() => {
    if (address) {
      scanWalletForNames();
    }
  }, [address, chain]);

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

  const scanWalletForNames = async () => {
    if (!address) return;

    setScanning(true);
    const names: OwnedName[] = [];

    try {
      const API_BASE =
        chain === "base"
          ? "https://base-api.ethscriptions.com/v2"
          : "https://api.ethscriptions.com/v2";

      let pageKey: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const url: string = pageKey
          ? `${API_BASE}/ethscriptions?current_owner=${address}&mimetype=text/plain&per_page=100&page_key=${pageKey}`
          : `${API_BASE}/ethscriptions?current_owner=${address}&mimetype=text/plain&per_page=100`;

        const res = await fetch(url);
        const data = await res.json();

        if (!data.result || data.result.length === 0) {
          hasMore = false;
          break;
        }

        for (const eth of data.result) {
          const uri = eth.content_uri || "";
          // Match data:,name format (lowercase names only)
          const match = uri.match(/^data:,([a-z0-9-]+)$/);
          if (match && match[1].length <= 32) {
            const ethscriptionId = await getEthscriptionIdAsync(match[1]);
            names.push({
              name: match[1],
              txHash: eth.transaction_hash,
              ethscriptionId,
            });
          }
        }

        if (data.pagination?.has_more && data.pagination?.page_key) {
          pageKey = data.pagination.page_key;
        } else {
          hasMore = false;
        }
      }
    } catch (err) {
      console.error("Scan error:", err);
    }

    setOwnedNames(names);
    setScanning(false);
  };

  const handleDeposit = async () => {
    if (!selectedName || !address) return;

    setLoading(true);
    setError("");

    try {
      const contractAddress = MARKETPLACE_CONTRACT[chain];
      setChain(chain);
      const walletClient = await getUserWalletClient();

      // Step 1: Transfer ethscription to marketplace contract
      // This is done by sending the ethscription to the contract address
      const dataUri = `data:,${selectedName.name}`;
      const hexData = ("0x" +
        Array.from(new TextEncoder().encode(dataUri))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")) as `0x${string}`;

      const hash = await walletClient.sendTransaction({
        to: contractAddress as `0x${string}`,
        data: hexData,
        value: 0n,
      });

      setDepositTx(hash);
      setStep("list");
    } catch (err: unknown) {
      console.error("Deposit error:", err);
      setError((err as Error).message || "Failed to deposit");
    }

    setLoading(false);
  };

  const handleList = async () => {
    if (!selectedName || !price || !address) return;

    setLoading(true);
    setError("");

    try {
      const priceWei = ethToWei(price);
      const contractAddress = MARKETPLACE_CONTRACT[chain];
      setChain(chain);
      const walletClient = await getUserWalletClient();

      // Step 2: Call depositAndList on the contract to register deposit and create listing
      const listTxHash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            name: "depositAndList",
            type: "function",
            inputs: [
              { name: "ethscriptionId", type: "bytes32" },
              { name: "price", type: "uint256" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "depositAndList",
        args: [
          selectedName.ethscriptionId as `0x${string}`,
          BigInt(priceWei),
        ],
      });

      // Step 3: Create listing in database only after contract call succeeds
      const res = await fetch("/api/marketplace/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedName.name,
          sellerAddress: address,
          priceWei,
          depositTx,
          listTx: listTxHash,
          chain,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create listing");
      }

      setListingId(data.listing.id);
      setStep("done");
    } catch (err: unknown) {
      console.error("List error:", err);
      setError((err as Error).message || "Failed to create listing");
    }

    setLoading(false);
  };

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!address) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-zinc-800 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold flex items-center gap-2">
              <img src="/favicon.png" alt="" className="w-6 h-6" />
              <span><span className="text-white">Chain</span><span className="text-[#C3FF00]">Host</span></span>
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
          <h1 className="text-3xl font-bold mb-6">Sell Your Names</h1>
          <p className="text-gray-400 mb-8">
            Connect your wallet to list your names for sale
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
      <header className="border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold flex items-center gap-2">
            <img src="/favicon.png" alt="" className="w-6 h-6" />
            <span><span className="text-white">Chain</span><span className="text-[#C3FF00]">Host</span></span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className="text-[#C3FF00]">
              Marketplace
            </Link>
            <span className="text-gray-400 font-mono">{formatAddress(address)}</span>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <Link
          href="/marketplace"
          className="text-gray-400 hover:text-white mb-6 inline-block"
        >
          &larr; Back to marketplace
        </Link>

        <h1 className="text-3xl font-bold mb-8">List Name for Sale</h1>

        {/* Progress */}
        <div className="flex items-center gap-4 mb-8">
          {["select", "deposit", "list", "done"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === s
                    ? "bg-[#C3FF00] text-black"
                    : ["select", "deposit", "list", "done"].indexOf(step) > i
                    ? "bg-[#C3FF00]/50 text-black"
                    : "bg-zinc-700"
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && <div className="w-12 h-0.5 bg-zinc-700 mx-2" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300 mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Select Name */}
        {step === "select" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">1. Select Name to Sell</h2>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Chain</label>
              <select
                value={chain}
                onChange={(e) => {
                  setChainState(e.target.value as ChainOption);
                  setOwnedNames([]);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
              >
                <option value="eth">Ethereum</option>
                <option value="base">Base</option>
              </select>
            </div>

            {scanning ? (
              <div className="text-center py-8 text-gray-400">
                Scanning wallet for names...
              </div>
            ) : ownedNames.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  No names found in your wallet
                </div>
                <Link href="/register" className="text-[#C3FF00] hover:underline">
                  Register a name first
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {ownedNames.map((n) => (
                  <button
                    key={n.txHash}
                    onClick={() => setSelectedName(n)}
                    className={`p-3 rounded-lg font-mono text-left ${
                      selectedName?.txHash === n.txHash
                        ? "bg-[#C3FF00] text-black"
                        : "bg-zinc-800 hover:bg-zinc-700"
                    }`}
                  >
                    {n.name}
                  </button>
                ))}
              </div>
            )}

            {selectedName && (
              <div className="mt-6">
                <label className="block text-gray-400 text-sm mb-2">
                  Price (ETH)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-xl focus:outline-none focus:border-[#C3FF00]"
                />

                <button
                  onClick={() => setStep("deposit")}
                  disabled={!price || parseFloat(price) <= 0}
                  className="w-full mt-4 bg-[#C3FF00] text-black hover:bg-[#d4ff4d] disabled:bg-zinc-600 disabled:text-gray-400 px-6 py-3 rounded-lg font-bold"
                >
                  Continue with {selectedName.name}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Deposit */}
        {step === "deposit" && selectedName && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">2. Deposit to Escrow</h2>

            <div className="bg-zinc-800 rounded-lg p-4 mb-6">
              <div className="text-2xl font-mono text-[#C3FF00] mb-2">
                {selectedName.name}
              </div>
              <div className="text-gray-400">
                Price: <span className="text-white">{price} ETH</span>
              </div>
            </div>

            <p className="text-gray-400 mb-6">
              To list your name, you need to deposit it to the marketplace
              escrow contract. This ensures trustless trading - the name will be
              automatically transferred to the buyer when they pay.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setStep("select")}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 px-6 py-3 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleDeposit}
                disabled={loading}
                className="flex-1 bg-[#C3FF00] text-black hover:bg-[#d4ff4d] disabled:bg-zinc-600 disabled:text-gray-400 px-6 py-3 rounded-lg font-bold"
              >
                {loading ? "Depositing..." : "Deposit Name"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: List */}
        {step === "list" && selectedName && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">3. Register & List on Contract</h2>

            <div className="bg-[#C3FF00]/10 border border-[#C3FF00] rounded-lg p-4 mb-6">
              Ethscription transferred! TX: {depositTx.slice(0, 10)}...
            </div>

            <div className="bg-zinc-800 rounded-lg p-4 mb-6">
              <div className="text-2xl font-mono text-[#C3FF00] mb-2">
                {selectedName.name}
              </div>
              <div className="text-gray-400">
                Price: <span className="text-white">{price} ETH</span>
              </div>
              <div className="text-gray-400 text-sm mt-2">
                2.5% fee on sale = {(parseFloat(price) * 0.025).toFixed(4)} ETH
              </div>
              <div className="text-gray-400 text-sm">
                You receive = {(parseFloat(price) * 0.975).toFixed(4)} ETH
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              This transaction will register your deposit and create the listing on the smart contract.
              You&apos;ll need to sign one more transaction.
            </p>

            <button
              onClick={handleList}
              disabled={loading}
              className="w-full bg-[#C3FF00] text-black hover:bg-[#d4ff4d] disabled:bg-zinc-600 disabled:text-gray-400 px-6 py-3 rounded-lg font-bold"
            >
              {loading ? "Registering on Contract..." : "Register & List"}
            </button>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && selectedName && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <div className="text-6xl mb-4 text-[#C3FF00]">&#10003;</div>
            <h2 className="text-2xl font-bold mb-4 text-[#C3FF00]">
              Listed Successfully!
            </h2>

            <div className="bg-zinc-800 rounded-lg p-4 mb-6">
              <div className="text-2xl font-mono text-[#C3FF00] mb-2">
                {selectedName.name}
              </div>
              <div className="text-xl">{price} ETH</div>
            </div>

            <div className="flex gap-4">
              <Link
                href={`/marketplace/${listingId}`}
                className="flex-1 bg-[#C3FF00] text-black hover:bg-[#d4ff4d] px-6 py-3 rounded-lg font-bold"
              >
                View Listing
              </Link>
              <Link
                href="/marketplace"
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 px-6 py-3 rounded-lg"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
