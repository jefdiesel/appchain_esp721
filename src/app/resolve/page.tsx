"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";

const COMMON_TOKENS: { symbol: string; address: string; decimals: number }[] = [
  { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5c4F27eAD9083C756Cc2", decimals: 18 },
];

type SendMode = "eth" | "erc20" | "raw";
type TxStatus = "idle" | "pending" | "confirmed" | "error";

function encodeErc20Transfer(to: string, amountHex: string): string {
  const selector = "0xa9059cbb";
  const paddedTo = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const paddedAmt = amountHex.replace("0x", "").padStart(64, "0");
  return selector + paddedTo + paddedAmt;
}

function parseUnits(value: string, decimals: number): string {
  const [whole = "0", frac = ""] = value.split(".");
  const paddedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
  const raw = BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFrac || "0");
  return "0x" + raw.toString(16);
}

interface Ethscription {
  transaction_hash: string;
  content_uri?: string;
  mimetype?: string;
}

export default function ResolvePage() {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "resolving" | "found" | "not_found" | "error">("idle");
  const [error, setError] = useState("");
  const [holdings, setHoldings] = useState<Ethscription[]>([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  // Send card state
  const [sendMode, setSendMode] = useState<SendMode>("eth");
  const [senderAddr, setSenderAddr] = useState<string | null>(null);
  const [ethAmount, setEthAmount] = useState("");
  const [tokenAddr, setTokenAddr] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [tokenAmount, setTokenAmount] = useState("");
  const [rawData, setRawData] = useState("");
  const [rawValue, setRawValue] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txError, setTxError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    if (!(window as any).ethereum) { alert("No wallet found"); return; }
    try {
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      if (accounts[0]) setSenderAddr(accounts[0]);
    } catch { /* user rejected */ }
  }, []);

  const sendTx = useCallback(async () => {
    if (!owner || !senderAddr) return;
    const eth = (window as any).ethereum;
    if (!eth) return;
    setTxStatus("pending"); setTxError(null); setTxHash(null);
    try {
      let txParams: any = { from: senderAddr, to: owner };
      if (sendMode === "eth") {
        const wei = parseUnits(ethAmount, 18);
        txParams.value = wei;
      } else if (sendMode === "erc20") {
        const amt = parseUnits(tokenAmount, tokenDecimals);
        txParams.to = tokenAddr;
        txParams.data = encodeErc20Transfer(owner, amt);
      } else {
        txParams.data = rawData.startsWith("0x") ? rawData : "0x" + rawData;
        if (rawValue) txParams.value = parseUnits(rawValue, 18);
      }
      const hash = await eth.request({ method: "eth_sendTransaction", params: [txParams] });
      setTxHash(hash);
      setTxStatus("confirmed");
    } catch (e: any) {
      setTxStatus("error");
      setTxError(e?.message || "Transaction failed");
    }
  }, [owner, senderAddr, sendMode, ethAmount, tokenAddr, tokenDecimals, tokenAmount, rawData, rawValue]);

  const resolve = async (n?: string) => {
    const query = (n || name).trim();
    if (!query) return;

    setStatus("resolving");
    setError("");
    setOwner(null);
    setHoldings([]);

    try {
      const content = `data:,${query}`;
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
        fetchHoldings(addr);
      } else {
        setStatus("not_found");
      }
    } catch {
      setStatus("error");
      setError("Failed to resolve name");
    }
  };

  const fetchHoldings = async (addr: string) => {
    setLoadingHoldings(true);
    try {
      const res = await fetch(
        `https://api.ethscriptions.com/v2/ethscriptions?current_owner=${addr}&per_page=50`
      );
      const data = await res.json();
      setHoldings(data.result || []);
    } catch {
      // silent fail for holdings
    } finally {
      setLoadingHoldings(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />

      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-center mb-4">Resolve Name</h1>
        <p className="text-gray-400 text-center mb-12">
          Look up any ethscription name to find its owner and their holdings.
        </p>

        {/* Search */}
        <div className="space-y-4">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden focus-within:border-[#C3FF00]">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value.toLowerCase().replace(/\s/g, ""));
                setStatus("idle");
              }}
              onKeyDown={(e) => e.key === "Enter" && resolve()}
              className="flex-1 bg-transparent px-4 py-4 text-xl focus:outline-none"
              placeholder="Look up ethscription name"
            />
            <button
              onClick={() => resolve()}
              disabled={!name.trim() || status === "resolving"}
              className="px-6 py-4 bg-[#C3FF00] text-black font-semibold hover:bg-[#d4ff4d] transition disabled:opacity-40"
            >
              {status === "resolving" ? "..." : "Resolve"}
            </button>
          </div>

          {/* Not found */}
          {status === "not_found" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-gray-400 mb-2">
                <span className="text-red-400 font-semibold">Not found.</span>{" "}
                <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">data:,{name}</code> is not inscribed.
              </p>
              <Link
                href={`/register`}
                className="text-sm text-[#C3FF00] hover:underline"
              >
                Register this name →
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

          {/* Found - Owner */}
          {status === "found" && owner && (
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Owner
                </h2>
                <p className="font-mono text-sm break-all text-white mb-3">{owner}</p>
                <div className="flex gap-3">
                  <a href={`https://etherscan.io/address/${owner}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C3FF00] hover:underline">Etherscan</a>
                  <a href={`https://ethscriptions.com/profiles/${owner}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C3FF00] hover:underline">Ethscriptions</a>
                </div>
              </div>

              {/* Send to name */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Send to {name}
                </h2>

                {!senderAddr ? (
                  <button
                    onClick={connectWallet}
                    className="w-full py-2.5 rounded-lg bg-[#C3FF00] text-black font-semibold text-sm hover:brightness-110 transition"
                  >
                    Connect Wallet
                  </button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400">
                      Connected: <span className="font-mono text-gray-300">{senderAddr.slice(0, 6)}…{senderAddr.slice(-4)}</span>
                    </p>

                    {/* Mode tabs */}
                    <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
                      {(["eth", "erc20", "raw"] as SendMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => { setSendMode(m); setTxStatus("idle"); setTxHash(null); setTxError(null); }}
                          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${
                            sendMode === m ? "bg-[#C3FF00] text-black" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          {m === "eth" ? "ETH" : m === "erc20" ? "ERC-20" : "Raw TX"}
                        </button>
                      ))}
                    </div>

                    {/* ETH mode */}
                    {sendMode === "eth" && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Amount (ETH)"
                          value={ethAmount}
                          onChange={(e) => setEthAmount(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C3FF00]"
                        />
                      </div>
                    )}

                    {/* ERC-20 mode */}
                    {sendMode === "erc20" && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {COMMON_TOKENS.map((t) => (
                            <button
                              key={t.symbol}
                              onClick={() => { setTokenAddr(t.address); setTokenDecimals(t.decimals); }}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                                tokenAddr === t.address
                                  ? "bg-[#C3FF00] text-black"
                                  : "bg-zinc-800 text-gray-400 hover:text-white"
                              }`}
                            >
                              {t.symbol}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Token contract address"
                          value={tokenAddr}
                          onChange={(e) => { setTokenAddr(e.target.value); setTokenDecimals(18); }}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C3FF00] font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Amount"
                          value={tokenAmount}
                          onChange={(e) => setTokenAmount(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C3FF00]"
                        />
                      </div>
                    )}

                    {/* Raw TX mode */}
                    {sendMode === "raw" && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Data (hex, e.g. 0x...)"
                          value={rawData}
                          onChange={(e) => setRawData(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C3FF00] font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Value in ETH (optional)"
                          value={rawValue}
                          onChange={(e) => setRawValue(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C3FF00]"
                        />
                      </div>
                    )}

                    {/* Send button */}
                    <button
                      onClick={sendTx}
                      disabled={txStatus === "pending"}
                      className="w-full py-2.5 rounded-lg bg-[#C3FF00] text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
                    >
                      {txStatus === "pending" ? "Sending…" : "Send"}
                    </button>

                    {/* TX status */}
                    {txStatus === "confirmed" && txHash && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                        <p className="text-green-400 text-sm font-medium mb-1">Transaction sent</p>
                        <a
                          href={`https://etherscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#C3FF00] hover:underline font-mono break-all"
                        >
                          {txHash}
                        </a>
                      </div>
                    )}
                    {txStatus === "error" && txError && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <p className="text-red-400 text-sm">{txError}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* API / Link */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  API &amp; Links
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Direct link</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-xs text-gray-300 break-all">
                        {`https://chainhost.online/resolve/${name}`}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(`https://chainhost.online/resolve/${name}`)}
                        className="shrink-0 px-3 py-2 bg-zinc-800 rounded text-xs text-gray-400 hover:text-[#C3FF00] transition"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">JSON API</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-xs text-gray-300 break-all">
                        {`https://chainhost.online/api/resolve?name=${name}`}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(`https://chainhost.online/api/resolve?name=${name}`)}
                        className="shrink-0 px-3 py-2 bg-zinc-800 rounded text-xs text-gray-400 hover:text-[#C3FF00] transition"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action links */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/register"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:border-[#C3FF00] transition"
                >
                  <p className="text-[#C3FF00] font-semibold text-sm">Register Names</p>
                  <p className="text-gray-400 text-xs mt-1">Claim more names</p>
                </Link>
                <Link
                  href="/mail"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:border-[#C3FF00] transition"
                >
                  <p className="text-[#C3FF00] font-semibold text-sm">Mail</p>
                  <p className="text-gray-400 text-xs mt-1">{name}@chainhost.online</p>
                </Link>
                <Link
                  href="/upload"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:border-[#C3FF00] transition"
                >
                  <p className="text-[#C3FF00] font-semibold text-sm">Upload Site</p>
                  <p className="text-gray-400 text-xs mt-1">{name}.chainhost.online</p>
                </Link>
                <Link
                  href="/mint"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:border-[#C3FF00] transition"
                >
                  <p className="text-[#C3FF00] font-semibold text-sm">Mint Token</p>
                  <p className="text-gray-400 text-xs mt-1">${name}</p>
                </Link>
              </div>

              {/* Holdings */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Holdings
                </h2>
                {loadingHoldings ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-zinc-600 border-t-[#C3FF00] rounded-full animate-spin" />
                  </div>
                ) : holdings.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No ethscriptions found.</p>
                ) : (
                  <div className="max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                    <div className="grid grid-cols-5 gap-2">
                      {holdings.map((e) => {
                        const mime = e.mimetype || "";
                        const uri = e.content_uri || "";
                        const isImage = mime.startsWith("image/");
                        const isHtml = mime.startsWith("text/html");
                        let label = "";
                        if (!isImage && !isHtml) {
                          try {
                            const prefix = "data:" + mime + ",";
                            const altPrefix = "data:,";
                            if (uri.startsWith(prefix)) label = decodeURIComponent(uri.slice(prefix.length)).slice(0, 40);
                            else if (uri.startsWith(altPrefix)) label = decodeURIComponent(uri.slice(altPrefix.length)).slice(0, 40);
                            else label = mime || "?";
                          } catch { label = mime || "?"; }
                        }

                        return (
                          <a
                            key={e.transaction_hash}
                            href={`https://ethscriptions.com/ethscriptions/${e.transaction_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square bg-zinc-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-[#C3FF00] transition relative"
                          >
                            {isImage ? (
                              <img
                                src={uri}
                                alt=""
                                className="w-full h-full object-contain"
                                style={{ imageRendering: "pixelated" }}
                                loading="lazy"
                              />
                            ) : isHtml ? (
                              <iframe
                                srcDoc={uri.startsWith("data:text/html;base64,") ? atob(uri.slice(22)) : undefined}
                                src={!uri.startsWith("data:text/html;base64,") ? uri : undefined}
                                sandbox="allow-scripts"
                                loading="lazy"
                                className="w-full h-full border-0 pointer-events-none scale-[0.25] origin-top-left"
                                style={{ width: "400%", height: "400%" }}
                              />
                            ) : (
                              <span className="flex items-center justify-center w-full h-full text-[10px] text-gray-400 p-1 break-all leading-tight text-center">
                                {label}
                              </span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
