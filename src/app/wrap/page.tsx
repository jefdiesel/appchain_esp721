"use client";

import { useState, useEffect, useCallback } from "react";
import Nav from "@/components/Nav";

// Contract address — update after deployment on Ethereum mainnet
const WRAPPED_ADDRESS = process.env.NEXT_PUBLIC_WRAPPED_ADDRESS || "0x0000000000000000000000000000000000000000";

const ETHSCRIPTIONS_API = "https://api.ethscriptions.com/v2/ethscriptions";
const MAINNET_CHAIN_ID = "0x1";

type Tab = "wrap" | "unwrap";

type WrapStatus = "idle" | "transferring" | "wrapping" | "wrapped" | "error";
type UnwrapStatus = "idle" | "unwrapping" | "unwrapped" | "error";

interface Ethscription {
  id: string;
  contentUri: string;
  name?: string;
}

interface WrappedNFT {
  tokenId: string;
  ethscriptionId: string;
}

// Function selectors (cast sig "wrap(bytes32)" / "unwrap(uint256)")
const WRAP_SELECTOR = "0x5f029ebe";
const UNWRAP_SELECTOR = "0xde0e9a3e";

export default function WrapPage() {
  const [tab, setTab] = useState<Tab>("wrap");
  const [wallet, setWallet] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Wrap state
  const [ethscriptions, setEthscriptions] = useState<Ethscription[]>([]);
  const [selectedEsc, setSelectedEsc] = useState<Ethscription | null>(null);
  const [wrapStatus, setWrapStatus] = useState<WrapStatus>("idle");
  const [wrapTx, setWrapTx] = useState("");
  const [loadingEsc, setLoadingEsc] = useState(false);

  // Unwrap state
  const [wrappedNFTs, setWrappedNFTs] = useState<WrappedNFT[]>([]);
  const [selectedNFT, setSelectedNFT] = useState<WrappedNFT | null>(null);
  const [unwrapStatus, setUnwrapStatus] = useState<UnwrapStatus>("idle");
  const [unwrapTx, setUnwrapTx] = useState("");
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  const connectWallet = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) { setError("No wallet found"); return; }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" }) as string[];
      if (accounts.length) setWallet(accounts[0].toLowerCase());
    } catch { setError("Wallet connection failed"); }
  }, []);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((accs: string[]) => {
      if (accs.length) setWallet(accs[0].toLowerCase());
    }).catch(() => {});
    const onChange = (accs: string[]) => setWallet(accs.length ? accs[0].toLowerCase() : null);
    eth.on?.("accountsChanged", onChange);
    return () => eth.removeListener?.("accountsChanged", onChange);
  }, []);

  // Fetch user's ethscriptions when wallet connects (for wrap tab)
  useEffect(() => {
    if (!wallet || tab !== "wrap") return;
    setLoadingEsc(true);
    fetch(`${ETHSCRIPTIONS_API}?current_owner=${wallet}&per_page=50`)
      .then(r => r.json())
      .then(data => {
        const items = (data.result || data || []).map((e: any) => ({
          id: e.transaction_hash || e.ethscription_id,
          contentUri: e.content_uri || "",
          name: e.content_uri?.startsWith("data:,") ? e.content_uri.slice(6) : undefined,
        }));
        setEthscriptions(items);
      })
      .catch(() => setEthscriptions([]))
      .finally(() => setLoadingEsc(false));
  }, [wallet, tab]);

  // Fetch user's wrapped NFTs (for unwrap tab)
  useEffect(() => {
    if (!wallet || tab !== "unwrap") return;
    setLoadingNFTs(true);

    const fetchWrapped = async () => {
      try {
        const eth = (window as any).ethereum;
        if (!eth) return;

        // Ensure we're on mainnet
        try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MAINNET_CHAIN_ID }] }); } catch {}

        // Transfer(address,address,uint256) topic
        const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
        const paddedAddr = "0x" + wallet.slice(2).padStart(64, "0");

        // Get transfers TO this wallet
        const logs = await eth.request({
          method: "eth_getLogs",
          params: [{
            address: WRAPPED_ADDRESS,
            topics: [transferTopic, null, paddedAddr],
            fromBlock: "0x0",
            toBlock: "latest",
          }],
        });

        // Get transfers FROM this wallet (including burns to 0x0)
        const logsFrom = await eth.request({
          method: "eth_getLogs",
          params: [{
            address: WRAPPED_ADDRESS,
            topics: [transferTopic, paddedAddr, null],
            fromBlock: "0x0",
            toBlock: "latest",
          }],
        });

        // Compute owned set: received - sent
        const owned = new Set<string>();
        for (const log of (logs || [])) {
          owned.add(log.topics[3]);
        }
        for (const log of (logsFrom || [])) {
          owned.delete(log.topics[3]);
        }

        const nfts: WrappedNFT[] = Array.from(owned).map(tokenId => ({
          tokenId,
          ethscriptionId: tokenId,
        }));

        setWrappedNFTs(nfts);
      } catch {
        setWrappedNFTs([]);
      } finally {
        setLoadingNFTs(false);
      }
    };

    fetchWrapped();
  }, [wallet, tab]);

  // Switch to Ethereum mainnet
  const ensureMainnet = async (eth: any) => {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MAINNET_CHAIN_ID }] });
    } catch (switchErr: any) {
      if (switchErr.code === 4902) throw new Error("Please add Ethereum mainnet to your wallet");
      throw switchErr;
    }
  };

  // --- Wrap: transfer ethscription to contract + call wrap() ---
  const handleWrap = async () => {
    if (!selectedEsc || !wallet) return;
    setError("");
    setWrapStatus("transferring");

    try {
      const eth = (window as any).ethereum;
      await ensureMainnet(eth);

      // Step 1: Transfer ethscription to contract via ESIP-2
      // (send 0 ETH tx to contract with ethscriptionId as calldata)
      await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet,
          to: WRAPPED_ADDRESS,
          value: "0x0",
          data: selectedEsc.id,
        }],
      });

      setWrapStatus("wrapping");

      // Step 2: Call wrap(bytes32 ethscriptionId) to mint the NFT
      const wrapData = WRAP_SELECTOR + selectedEsc.id.slice(2).padStart(64, "0");
      const tx = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet,
          to: WRAPPED_ADDRESS,
          value: "0x0",
          data: wrapData,
        }],
      });

      setWrapTx(tx);
      setWrapStatus("wrapped");
    } catch (err: any) {
      setError(err.message || "Wrap failed");
      setWrapStatus("error");
    }
  };

  // --- Unwrap: call unwrap(tokenId) to burn NFT + get ethscription back ---
  const handleUnwrap = async () => {
    if (!selectedNFT || !wallet) return;
    setError("");
    setUnwrapStatus("unwrapping");

    try {
      const eth = (window as any).ethereum;
      await ensureMainnet(eth);

      // unwrap(uint256 tokenId)
      const unwrapData = UNWRAP_SELECTOR + selectedNFT.tokenId.slice(2).padStart(64, "0");
      const tx = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet,
          to: WRAPPED_ADDRESS,
          value: "0x0",
          data: unwrapData,
        }],
      });

      setUnwrapTx(tx);
      setUnwrapStatus("unwrapped");
    } catch (err: any) {
      setError(err.message || "Unwrap failed");
      setUnwrapStatus("error");
    }
  };

  const formatId = (id: string) => id.slice(0, 10) + "…" + id.slice(-6);

  return (
    <div className="min-h-screen bg-black text-gray-300">
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Wrap Ethscriptions</h1>
        <p className="text-gray-500 mb-8">
          Wrap ethscriptions as ERC-721 NFTs on Ethereum for OpenSea compatibility. Unwrap anytime to restore ownership.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {(["wrap", "unwrap"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                tab === t
                  ? "bg-[#C3FF00] text-black"
                  : "bg-zinc-800 text-gray-400 hover:text-white"
              }`}
            >
              {t === "wrap" ? "Wrap" : "Unwrap"}
            </button>
          ))}
        </div>

        {/* Connect wallet */}
        {!wallet && (
          <button
            onClick={connectWallet}
            className="w-full py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
          >
            Connect Wallet
          </button>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* === WRAP TAB === */}
        {wallet && tab === "wrap" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-3">Your Ethscriptions</h2>
              {loadingEsc ? (
                <p className="text-gray-500">Loading…</p>
              ) : ethscriptions.length === 0 ? (
                <p className="text-gray-500">No ethscriptions found for this wallet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
                  {ethscriptions.map(esc => (
                    <button
                      key={esc.id}
                      onClick={() => { setSelectedEsc(esc); setWrapStatus("idle"); setWrapTx(""); }}
                      className={`p-3 rounded-lg border text-left transition ${
                        selectedEsc?.id === esc.id
                          ? "border-[#C3FF00] bg-zinc-800"
                          : "border-zinc-800 hover:border-zinc-600"
                      }`}
                    >
                      <span className="font-mono text-sm text-white">
                        {esc.name || formatId(esc.id)}
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">{formatId(esc.id)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedEsc && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                  <p className="text-sm text-gray-400">Selected</p>
                  <p className="font-mono text-white">{selectedEsc.name || formatId(selectedEsc.id)}</p>
                  <p className="text-xs text-gray-500 mt-1">{selectedEsc.id}</p>
                </div>

                {wrapStatus === "idle" && (
                  <button
                    onClick={handleWrap}
                    className="w-full py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
                  >
                    Wrap as NFT
                  </button>
                )}

                {wrapStatus === "transferring" && (
                  <div className="text-center py-4">
                    <p className="text-[#C3FF00] animate-pulse">Transferring ethscription to contract…</p>
                    <p className="text-xs text-gray-500 mt-2">Confirm the ESIP-2 transfer in your wallet</p>
                  </div>
                )}

                {wrapStatus === "wrapping" && (
                  <div className="text-center py-4">
                    <p className="text-[#C3FF00] animate-pulse">Minting ERC-721…</p>
                    <p className="text-xs text-gray-500 mt-2">Confirm the wrap transaction in your wallet</p>
                  </div>
                )}

                {wrapStatus === "wrapped" && (
                  <div className="text-center py-4">
                    <p className="text-green-400 text-lg font-semibold">Wrapped!</p>
                    <p className="text-xs text-gray-500 mt-1">TX: {formatId(wrapTx)}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Your ethscription is now an ERC-721 on Ethereum. It will appear on OpenSea shortly.
                    </p>
                  </div>
                )}

                {wrapStatus === "error" && (
                  <button
                    onClick={handleWrap}
                    className="w-full py-3 bg-zinc-800 text-white font-semibold rounded-lg hover:bg-zinc-700 transition"
                  >
                    Retry Wrap
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* === UNWRAP TAB === */}
        {wallet && tab === "unwrap" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-3">Your Wrapped NFTs</h2>
              {loadingNFTs ? (
                <p className="text-gray-500">Loading…</p>
              ) : wrappedNFTs.length === 0 ? (
                <p className="text-gray-500">No wrapped ethscriptions found.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
                  {wrappedNFTs.map(nft => (
                    <button
                      key={nft.tokenId}
                      onClick={() => { setSelectedNFT(nft); setUnwrapStatus("idle"); setUnwrapTx(""); }}
                      className={`p-3 rounded-lg border text-left transition ${
                        selectedNFT?.tokenId === nft.tokenId
                          ? "border-[#C3FF00] bg-zinc-800"
                          : "border-zinc-800 hover:border-zinc-600"
                      }`}
                    >
                      <span className="font-mono text-sm text-white">{formatId(nft.ethscriptionId)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedNFT && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                  <p className="text-sm text-gray-400">Selected NFT</p>
                  <p className="font-mono text-white text-sm break-all">{selectedNFT.ethscriptionId}</p>
                </div>

                {unwrapStatus === "idle" && (
                  <button
                    onClick={handleUnwrap}
                    className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition"
                  >
                    Burn NFT &amp; Unwrap
                  </button>
                )}

                {unwrapStatus === "unwrapping" && (
                  <div className="text-center py-4">
                    <p className="text-red-400 animate-pulse">Burning NFT &amp; returning ethscription…</p>
                    <p className="text-xs text-gray-500 mt-2">Confirm the transaction in your wallet</p>
                  </div>
                )}

                {unwrapStatus === "unwrapped" && (
                  <div className="text-center py-4">
                    <p className="text-green-400 text-lg font-semibold">Ethscription Restored!</p>
                    <p className="text-xs text-gray-500 mt-1">TX: {formatId(unwrapTx)}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Your ethscription has been returned via ESIP-2. Ownership will update once indexed.
                    </p>
                  </div>
                )}

                {unwrapStatus === "error" && (
                  <button
                    onClick={handleUnwrap}
                    className="w-full py-3 bg-zinc-800 text-white font-semibold rounded-lg hover:bg-zinc-700 transition"
                  >
                    Retry Unwrap
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-12 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <h3 className="text-sm font-semibold text-white mb-2">How it works</h3>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>Transfer your ethscription to the wrapper contract via ESIP-2</li>
            <li>Call wrap to mint an ERC-721 NFT on Ethereum mainnet</li>
            <li>Your NFT appears on OpenSea and other EVM marketplaces</li>
            <li>Burn the NFT anytime to get your ethscription back via ESIP-2</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
