"use client";

import { useState, useEffect, useCallback } from "react";
import Nav from "@/components/Nav";

// Contract addresses — update after deployment
const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000";
const WRAPPED_ADDRESS = process.env.NEXT_PUBLIC_WRAPPED_ADDRESS || "0x0000000000000000000000000000000000000000";

const APPCHAIN_RPC = "https://mainnet.ethscriptions.com";
const APPCHAIN_CHAIN_ID = "0xeee2"; // 61154
const ETHSCRIPTIONS_API = "https://api.ethscriptions.com/v2/ethscriptions";

// Minimal ABIs for user interactions
const VAULT_DEPOSIT_SIG = "0xe2bbb158"; // deposit(bytes32)
const WRAPPED_BURN_SIG = "0x42966c68"; // burn(uint256)

type Tab = "wrap" | "unwrap";

type WrapStatus = "idle" | "depositing" | "deposited" | "minting" | "minted" | "error";
type UnwrapStatus = "idle" | "burning" | "burned" | "withdrawing" | "withdrawn" | "error";

interface Ethscription {
  id: string;
  contentUri: string;
  name?: string;
}

interface WrappedNFT {
  tokenId: string;
  ethscriptionId: string;
}

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
  // Uses Transfer events to find tokens owned by user
  useEffect(() => {
    if (!wallet || tab !== "unwrap") return;
    setLoadingNFTs(true);

    // Query WrappedEthscription Transfer events where `to` is the user
    // For simplicity, use etherscan/basescan API or direct RPC
    // Here we'll use a basic eth_getLogs approach
    const fetchWrapped = async () => {
      try {
        const eth = (window as any).ethereum;
        if (!eth) return;

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

        // Get transfers FROM this wallet
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
          owned.add(log.topics[3]); // tokenId
        }
        for (const log of (logsFrom || [])) {
          owned.delete(log.topics[3]);
        }

        const nfts: WrappedNFT[] = Array.from(owned).map(tokenId => ({
          tokenId,
          ethscriptionId: tokenId, // tokenId == ethscriptionId as uint256
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

  // --- Wrap: deposit ethscription to vault ---
  const handleWrap = async () => {
    if (!selectedEsc || !wallet) return;
    setError("");
    setWrapStatus("depositing");

    try {
      const eth = (window as any).ethereum;

      // Step 1: Switch to AppChain
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: APPCHAIN_CHAIN_ID }] });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: APPCHAIN_CHAIN_ID,
              chainName: "Ethscriptions Mainnet",
              rpcUrls: [APPCHAIN_RPC],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            }],
          });
        } else throw switchErr;
      }

      // Step 2: Transfer ethscription to vault via ESIP-2 (send 0 ETH tx with ethscriptionId as calldata)
      const transferTx = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet,
          to: VAULT_ADDRESS,
          value: "0x0",
          data: selectedEsc.id, // ethscription transfer = send tx with ethscription ID as data
        }],
      });

      // Step 3: Call deposit() on vault to register
      const depositData = VAULT_DEPOSIT_SIG + selectedEsc.id.slice(2).padStart(64, "0");
      const depositTx = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet,
          to: VAULT_ADDRESS,
          value: "0x0",
          data: depositData,
        }],
      });

      setWrapTx(depositTx);
      setWrapStatus("deposited");

      // Poll for mint (relayer will mint on Base)
      pollForMint(selectedEsc.id);
    } catch (err: any) {
      setError(err.message || "Wrap failed");
      setWrapStatus("error");
    }
  };

  const pollForMint = (ethscriptionId: string) => {
    setWrapStatus("minting");
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 60) { // ~5 minutes
        clearInterval(interval);
        setWrapStatus("deposited"); // Still deposited, mint pending
        return;
      }
      try {
        const eth = (window as any).ethereum;
        // Check if token exists on Base by calling ownerOf
        const tokenId = ethscriptionId.padStart(66, "0x".padStart(2, "0"));
        // ownerOf(uint256) = 0x6352211e
        const data = "0x6352211e" + ethscriptionId.slice(2).padStart(64, "0");

        // Switch to Base for the check
        const baseChainId = process.env.NEXT_PUBLIC_USE_TESTNET === "true" ? "0x14a34" : "0x2105";
        try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: baseChainId }] }); } catch {}

        const result = await eth.request({
          method: "eth_call",
          params: [{ to: WRAPPED_ADDRESS, data }, "latest"],
        });
        if (result && result !== "0x") {
          clearInterval(interval);
          setWrapStatus("minted");
        }
      } catch {
        // Token doesn't exist yet, keep polling
      }
    }, 5000);
  };

  // --- Unwrap: burn NFT on Base ---
  const handleUnwrap = async () => {
    if (!selectedNFT || !wallet) return;
    setError("");
    setUnwrapStatus("burning");

    try {
      const eth = (window as any).ethereum;

      // Switch to Base
      const baseChainId = process.env.NEXT_PUBLIC_USE_TESTNET === "true" ? "0x14a34" : "0x2105";
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: baseChainId }] });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: baseChainId,
              chainName: "Base",
              rpcUrls: ["https://mainnet.base.org"],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            }],
          });
        } else throw switchErr;
      }

      // burn(uint256 tokenId)
      const burnData = WRAPPED_BURN_SIG + selectedNFT.tokenId.slice(2).padStart(64, "0");
      const tx = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet,
          to: WRAPPED_ADDRESS,
          value: "0x0",
          data: burnData,
        }],
      });

      setUnwrapTx(tx);
      setUnwrapStatus("burned");

      // Poll for withdrawal on AppChain
      pollForWithdraw(selectedNFT.ethscriptionId);
    } catch (err: any) {
      setError(err.message || "Unwrap failed");
      setUnwrapStatus("error");
    }
  };

  const pollForWithdraw = (ethscriptionId: string) => {
    setUnwrapStatus("withdrawing");
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        clearInterval(interval);
        setUnwrapStatus("burned");
        return;
      }
      try {
        // Check if ethscription ownership returned via API
        const res = await fetch(`${ETHSCRIPTIONS_API}/${ethscriptionId}`);
        const data = await res.json();
        const esc = data.result || data;
        if (esc.current_owner?.toLowerCase() === wallet) {
          clearInterval(interval);
          setUnwrapStatus("withdrawn");
        }
      } catch {}
    }, 5000);
  };

  const formatId = (id: string) => id.slice(0, 10) + "…" + id.slice(-6);

  return (
    <div className="min-h-screen bg-black text-gray-300">
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Wrap Ethscriptions</h1>
        <p className="text-gray-500 mb-8">
          Wrap ethscriptions as ERC-721 NFTs on Base for OpenSea compatibility. Unwrap anytime to restore ownership.
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

                {wrapStatus === "depositing" && (
                  <div className="text-center py-4">
                    <p className="text-[#C3FF00] animate-pulse">Depositing to vault…</p>
                    <p className="text-xs text-gray-500 mt-2">Confirm both transactions in your wallet</p>
                  </div>
                )}

                {wrapStatus === "deposited" && (
                  <div className="text-center py-4">
                    <p className="text-green-400">Deposited!</p>
                    <p className="text-xs text-gray-500 mt-1">TX: {formatId(wrapTx)}</p>
                    <p className="text-xs text-gray-500">Waiting for relayer to mint NFT on Base…</p>
                  </div>
                )}

                {wrapStatus === "minting" && (
                  <div className="text-center py-4">
                    <p className="text-[#C3FF00] animate-pulse">Minting NFT on Base…</p>
                  </div>
                )}

                {wrapStatus === "minted" && (
                  <div className="text-center py-4">
                    <p className="text-green-400 text-lg font-semibold">NFT Minted!</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Your wrapped ethscription is now an ERC-721 on Base. It will appear on OpenSea shortly.
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

                {unwrapStatus === "burning" && (
                  <div className="text-center py-4">
                    <p className="text-red-400 animate-pulse">Burning NFT on Base…</p>
                  </div>
                )}

                {unwrapStatus === "burned" && (
                  <div className="text-center py-4">
                    <p className="text-yellow-400">NFT Burned</p>
                    <p className="text-xs text-gray-500 mt-1">TX: {formatId(unwrapTx)}</p>
                    <p className="text-xs text-gray-500">Waiting for relayer to return ethscription…</p>
                  </div>
                )}

                {unwrapStatus === "withdrawing" && (
                  <div className="text-center py-4">
                    <p className="text-yellow-400 animate-pulse">Withdrawing from vault…</p>
                  </div>
                )}

                {unwrapStatus === "withdrawn" && (
                  <div className="text-center py-4">
                    <p className="text-green-400 text-lg font-semibold">Ethscription Restored!</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Your ethscription has been returned to your wallet on the AppChain.
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
            <li>Deposit your ethscription into the vault on the AppChain</li>
            <li>The relayer mints a corresponding ERC-721 NFT on Base</li>
            <li>Your NFT appears on OpenSea and other marketplaces</li>
            <li>Burn the NFT anytime to get your ethscription back</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
