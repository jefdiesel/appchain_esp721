"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type ChainOption = "eth" | "base";

interface PageFile {
  name: string;
  content: string;
  size: number;
  txHash?: string;
  chain?: ChainOption;
  inscribing?: boolean;
}

function UploadContent() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState<string | null>(searchParams.get("name"));
  const [homeFile, setHomeFile] = useState<PageFile | null>(null);
  const [aboutFile, setAboutFile] = useState<PageFile | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainOption>("eth");
  const [manifestTx, setManifestTx] = useState<string | null>(null);
  const [inscribingManifest, setInscribingManifest] = useState(false);
  const [error, setError] = useState("");

  // Username is entered by user, no need to fetch

  // Handle file upload
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: PageFile | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      setError("Please upload an HTML file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFile({
        name: file.name,
        content,
        size: content.length,
      });
      setError("");
    };
    reader.readAsText(file);
  };

  // Inscribe a file
  const inscribeFile = async (
    file: PageFile,
    setFile: (f: PageFile | null) => void
  ) => {
    if (!window.ethereum) {
      setError("Please install MetaMask or another wallet");
      return;
    }

    setFile({ ...file, inscribing: true });

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      // Switch to correct chain
      const targetChainId = selectedChain === "eth" ? "0x1" : "0x2105"; // 1 = ETH, 8453 = Base
      const currentChain = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;

      if (currentChain !== targetChainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: targetChainId }],
          });
        } catch (switchError: unknown) {
          // Add Base if not in wallet
          if ((switchError as { code?: number })?.code === 4902 && selectedChain === "base") {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x2105",
                chainName: "Base",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      // Create calldata: data:text/html;base64,{base64content}
      const base64 = btoa(unescape(encodeURIComponent(file.content)));
      const dataUri = `data:text/html;base64,${base64}`;
      const hex =
        "0x" +
        Array.from(new TextEncoder().encode(dataUri))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      const tx = (await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: accounts[0],
            to: accounts[0],
            data: hex,
            value: "0x0",
          },
        ],
      })) as string;

      setFile({
        ...file,
        txHash: tx,
        chain: selectedChain,
        inscribing: false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inscription failed");
      setFile({ ...file, inscribing: false });
    }
  };

  // Create and inscribe manifest
  const inscribeManifest = async () => {
    if (!window.ethereum || !username) return;

    setInscribingManifest(true);
    setError("");

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      // Build manifest
      const manifest: Record<string, Record<string, string>> = {
        chainhost: {},
      };

      if (homeFile?.txHash) {
        manifest.chainhost.home = homeFile.txHash;
      }
      if (aboutFile?.txHash) {
        manifest.chainhost.about = aboutFile.txHash;
      }

      // Inscribe on Ethereum (manifest always on ETH for permanence)
      const currentChain = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      if (currentChain !== "0x1") {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x1" }],
        });
      }

      // Create calldata
      const json = JSON.stringify(manifest);
      const dataUri = `data:application/json,${json}`;
      const hex =
        "0x" +
        Array.from(new TextEncoder().encode(dataUri))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      const tx = (await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: accounts[0],
            to: accounts[0],
            data: hex,
            value: "0x0",
          },
        ],
      })) as string;

      setManifestTx(tx);
      // Manifest is now on-chain, the CF worker will find it
    } catch (e) {
      setError(e instanceof Error ? e.message : "Manifest inscription failed");
    } finally {
      setInscribingManifest(false);
    }
  };

  const canInscribeManifest = homeFile?.txHash || aboutFile?.txHash;
  const explorerUrl = (tx: string, chain: ChainOption) =>
    chain === "eth"
      ? `https://etherscan.io/tx/${tx}`
      : `https://basescan.org/tx/${tx}`;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            <span className="text-white">CHAIN</span>
            <span className="text-[#C3FF00]">HOST</span>
          </Link>
          <Link
            href="/register"
            className="text-sm text-gray-400 hover:text-white"
          >
            Register Name
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-center mb-2">Upload Your Site</h1>

        {/* Username input */}
        <div className="mb-8">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden focus-within:border-[#C3FF00] max-w-md mx-auto">
            <input
              type="text"
              value={username || ""}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
              className="flex-1 bg-transparent px-4 py-3 text-lg focus:outline-none text-center"
              placeholder="yourname"
              maxLength={32}
            />
            <span className="text-gray-500 pr-4">.chainhost.online</span>
          </div>
          <p className="text-center text-xs text-gray-600 mt-2">
            Enter the name you claimed on Ethscriptions
          </p>
        </div>

        {/* Chain selector */}
        <div className="flex justify-center gap-3 mb-8">
          <button
            onClick={() => setSelectedChain("eth")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedChain === "eth"
                ? "bg-[#C3FF00] text-black"
                : "bg-zinc-800 text-gray-400 hover:text-white"
            }`}
          >
            Ethereum
          </button>
          <button
            onClick={() => setSelectedChain("base")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedChain === "base"
                ? "bg-[#0052FF] text-white"
                : "bg-zinc-800 text-gray-400 hover:text-white"
            }`}
          >
            Base (cheap)
          </button>
        </div>

        {/* Routes explanation */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
          <h2 className="font-semibold mb-3">Your Site Routes</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <code className="text-[#C3FF00]">/</code>
              <span className="text-gray-400">Home page (upload below)</span>
            </div>
            <div className="flex justify-between">
              <code className="text-[#C3FF00]">/about</code>
              <span className="text-gray-400">About page (optional)</span>
            </div>
            <div className="flex justify-between">
              <code className="text-gray-500">/previous</code>
              <span className="text-gray-500">Auto-generated history</span>
            </div>
            <div className="flex justify-between">
              <code className="text-gray-500">/recovery</code>
              <span className="text-gray-500">Universal backup page</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Home file upload */}
        <div className="border border-zinc-800 rounded-xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Home Page</h3>
              <p className="text-sm text-gray-500">
                {username}.chainhost.online/
              </p>
            </div>
            {homeFile?.txHash && (
              <a
                href={explorerUrl(homeFile.txHash, homeFile.chain || "base")}
                target="_blank"
                className="text-xs text-[#C3FF00] hover:underline"
              >
                {homeFile.txHash.slice(0, 10)}...
              </a>
            )}
          </div>

          {!homeFile ? (
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center hover:border-[#C3FF00] transition">
                <p className="text-gray-400 mb-2">Drop HTML file or click</p>
                <p className="text-xs text-gray-600">index.html, home.html</p>
              </div>
              <input
                type="file"
                accept=".html,.htm"
                onChange={(e) => handleFileUpload(e, setHomeFile)}
                className="hidden"
              />
            </label>
          ) : !homeFile.txHash ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3">
                <span className="text-sm">{homeFile.name}</span>
                <span className="text-xs text-gray-500">
                  {(homeFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setHomeFile(null)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Remove
                </button>
                <button
                  onClick={() => inscribeFile(homeFile, setHomeFile)}
                  disabled={homeFile.inscribing}
                  className="flex-1 py-2 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] disabled:opacity-50"
                >
                  {homeFile.inscribing ? "Inscribing..." : "Inscribe"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#C3FF00]">
              <span>✓</span>
              <span>Inscribed on {homeFile.chain === "eth" ? "Ethereum" : "Base"}</span>
            </div>
          )}
        </div>

        {/* About file upload */}
        <div className="border border-zinc-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">About Page</h3>
              <p className="text-sm text-gray-500">
                {username}.chainhost.online/about
              </p>
            </div>
            {aboutFile?.txHash && (
              <a
                href={explorerUrl(aboutFile.txHash, aboutFile.chain || "base")}
                target="_blank"
                className="text-xs text-[#C3FF00] hover:underline"
              >
                {aboutFile.txHash.slice(0, 10)}...
              </a>
            )}
          </div>

          {!aboutFile ? (
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center hover:border-[#C3FF00] transition">
                <p className="text-gray-400 mb-2">Drop HTML file or click</p>
                <p className="text-xs text-gray-600">Optional profile page</p>
              </div>
              <input
                type="file"
                accept=".html,.htm"
                onChange={(e) => handleFileUpload(e, setAboutFile)}
                className="hidden"
              />
            </label>
          ) : !aboutFile.txHash ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3">
                <span className="text-sm">{aboutFile.name}</span>
                <span className="text-xs text-gray-500">
                  {(aboutFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setAboutFile(null)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Remove
                </button>
                <button
                  onClick={() => inscribeFile(aboutFile, setAboutFile)}
                  disabled={aboutFile.inscribing}
                  className="flex-1 py-2 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] disabled:opacity-50"
                >
                  {aboutFile.inscribing ? "Inscribing..." : "Inscribe"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#C3FF00]">
              <span>✓</span>
              <span>Inscribed on {aboutFile.chain === "eth" ? "Ethereum" : "Base"}</span>
            </div>
          )}
        </div>

        {/* Manifest inscription */}
        {canInscribeManifest && !manifestTx && (
          <div className="bg-zinc-900 border border-[#C3FF00] rounded-xl p-6 mb-8">
            <h3 className="font-semibold mb-2">Create Manifest</h3>
            <p className="text-sm text-gray-400 mb-4">
              Final step: inscribe your site manifest on Ethereum. This links
              your routes to your content.
            </p>
            <button
              onClick={inscribeManifest}
              disabled={inscribingManifest}
              className="w-full py-3 bg-[#C3FF00] text-black font-bold rounded-lg hover:bg-[#d4ff4d] disabled:opacity-50"
            >
              {inscribingManifest ? "Inscribing manifest..." : "Inscribe Manifest on Ethereum"}
            </button>
          </div>
        )}

        {/* Success */}
        {manifestTx && (
          <div className="bg-[#C3FF00]/10 border border-[#C3FF00] rounded-xl p-6 text-center space-y-4">
            <div className="text-[#C3FF00] text-3xl">✓</div>
            <h2 className="text-xl font-bold">Your site is live!</h2>
            <a
              href={`https://${username}.chainhost.online`}
              target="_blank"
              className="block text-[#C3FF00] hover:underline"
            >
              {username}.chainhost.online →
            </a>
            <p className="text-xs text-gray-500 font-mono mb-2">{manifestTx}</p>
            <p className="text-xs text-gray-400">Wait ~30 seconds for the block to confirm</p>
            <Link
              href="/register"
              className="inline-block mt-4 px-6 py-2 border border-zinc-700 rounded-lg hover:border-[#C3FF00]"
            >
              Register Another Name
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>}>
      <UploadContent />
    </Suspense>
  );
}
