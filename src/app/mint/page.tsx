"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Script from "next/script";
import Nav from "@/components/Nav";

export default function MintPage() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Redirect ?tick= to subdomain
    const params = new URLSearchParams(window.location.search);
    const tick = params.get("tick");
    if (tick) {
      window.location.href = "https://" + tick.toLowerCase() + ".chainhost.online";
    }
  }, []);

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center text-[#C3FF00] mb-2">Token Launcher</h1>
        <p className="text-center text-gray-500 text-sm mb-8">Launch an Ethereum bonding curve token on a gentler polynomial curve</p>

        <button className="w-full py-3 bg-[#C3FF00] text-black font-bold rounded-lg hover:bg-[#d4ff4d] transition mb-4 text-lg" id="cb" onClick={() => (window as any).cw?.()}>
          Connect Wallet
        </button>
        <div className="text-center text-sm text-gray-500 mb-4 hidden" id="wf">
          <span className="text-[#C3FF00]" id="wa"></span>
        </div>

        {/* Info card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4 text-sm text-gray-500 leading-relaxed">
          <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">How it works</h2>
          <ul className="space-y-1">
            <li><span className="text-[#C3FF00] font-bold mr-2">&middot;</span>Token names are tied to <b className="text-gray-300">ethscription names</b> you own (SHA256 secured)</li>
            <li><span className="text-[#C3FF00] font-bold mr-2">&middot;</span>Tokens trade on a <b className="text-gray-300">polynomial bonding curve</b> (x<sup>1.5</sup>) — gentler than exponential</li>
            <li><span className="text-[#C3FF00] font-bold mr-2">&middot;</span>At <b className="text-gray-300">69% supply sold</b>, auto-migrates to <b className="text-gray-300">Uniswap V2</b> with LP burned forever</li>
            <li><span className="text-[#C3FF00] font-bold mr-2">&middot;</span><b className="text-gray-300">0.69% fee</b> on sells during bonding phase</li>
            <li><span className="text-[#C3FF00] font-bold mr-2">&middot;</span>Creator receives <b className="text-gray-300">0.069 ETH</b> at migration</li>
            <li><span className="text-[#C3FF00] font-bold mr-2">&middot;</span>1% of supply minted to platform at migration (half sold, half kept)</li>
            <li><span className="text-[#C3FF00] font-bold mr-2">&middot;</span>Your token lives at <b className="text-gray-300">name.chainhost.online</b> — instant trade page</li>
          </ul>
        </div>

        <Link href="/register" className="block text-center bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4 text-[#C3FF00] text-sm font-semibold hover:border-[#C3FF00] hover:bg-zinc-800 transition">
          Don&apos;t have a name? Register one on Ethereum
        </Link>

        {/* Create token panel */}
        <div id="create-panel" className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
          <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">Launch Token</h2>
          <p className="text-gray-500 text-sm text-center py-4" id="names-loading">Connect wallet to see your names</p>
          <ul className="flex flex-wrap gap-2 mb-4 hidden" id="name-list" style={{ listStyle: "none" }}></ul>
          <p className="text-gray-500 text-sm text-center py-4 hidden" id="no-names">
            No ethscription names found. <Link href="/register" className="text-[#C3FF00]">Register a name</Link> first.
          </p>
          <div id="create-options" className="hidden">
            <div className="mb-4">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Max Supply</label>
              <input type="number" id="supply-input" defaultValue="694200000" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-gray-200 font-mono focus:border-[#C3FF00] outline-none" />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Base Price (gwei)</label>
              <input type="number" id="price-input" defaultValue="100" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-gray-200 font-mono focus:border-[#C3FF00] outline-none" />
            </div>
            <div className="bg-zinc-950 rounded-lg p-3 mb-4 text-sm font-mono" id="launch-preview">
              <div className="flex justify-between py-1"><span className="text-gray-500">Price at migration (69%)</span><span id="pv-migprice">&mdash;</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Market cap at migration</span><span id="pv-migmc">&mdash;</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-500">Liquidity at migration</span><span id="pv-raised">&mdash;</span></div>
              <div className="flex justify-between py-1 border-t border-zinc-800 mt-1 pt-2 font-bold"><span className="text-gray-500">Price at full supply</span><span id="pv-fullprice">&mdash;</span></div>
              <div className="flex justify-between py-1 font-bold"><span className="text-gray-500">Fully diluted MC</span><span id="pv-fdmc">&mdash;</span></div>
            </div>
            <button className="w-full py-3 bg-[#C3FF00] text-black font-bold rounded-lg hover:bg-[#d4ff4d] transition" id="create-btn" onClick={() => (window as any).createToken?.()}>
              Launch $<span id="selected-name-btn"></span>
            </button>
          </div>
          <div className="text-center py-3 rounded-lg text-sm mt-3 hidden" id="create-status"></div>
        </div>

        {/* Trade panel (hidden until token loaded) */}
        <div id="token-panel" className="hidden">
          <div className="text-xl font-bold text-[#C3FF00] text-center mb-2">$<span id="token-name"></span></div>
          <div className="text-center text-sm text-gray-500 mb-4 hidden" id="token-bal-wrap"><span className="text-green-400" id="wb">0</span> tokens</div>
          <div id="migrated-msg" className="bg-[#C3FF00] text-black text-center p-4 rounded-xl mb-4 font-bold hidden">
            Migrated! <a id="uni-link" href="#" target="_blank" className="text-black underline">Trade on Uniswap</a>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
            <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">Price</h2>
            <div className="text-2xl font-bold text-center py-2 font-mono" id="sp">0.000000 <span className="text-sm text-gray-500 font-normal">ETH</span></div>
            <div className="flex justify-between py-1 text-sm"><span className="text-gray-500">Supply</span><span className="font-semibold"><span id="cs">0</span> / <span id="ms">0</span></span></div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden my-2"><div className="h-full bg-[#C3FF00] rounded-full transition-all" id="sb" style={{ width: "0%" }}></div></div>
            <div className="flex justify-between py-1 text-sm"><span className="text-gray-500">Reserve</span><span className="font-semibold" id="rv">0 ETH</span></div>
            <div className="flex justify-between py-1 text-sm"><span className="text-gray-500">Curve</span><span className="font-semibold">x<sup>1.5</sup></span></div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
            <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">Price Curve</h2>
            <canvas id="cc" height="160" className="w-full rounded-lg" style={{ height: "160px" }}></canvas>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4" id="trade-card">
            <div className="flex mb-4 rounded-lg overflow-hidden border border-zinc-800">
              <button className="flex-1 py-2 text-center text-sm font-semibold bg-[#C3FF00] text-black" id="tb" onClick={() => (window as any).sm?.("b")}>Buy</button>
              <button className="flex-1 py-2 text-center text-sm font-semibold bg-zinc-900 text-gray-500 hover:bg-zinc-800" id="ts2" onClick={() => (window as any).sm?.("s")}>Sell</button>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1" id="amt-label">Amount</label>
              <div className="flex gap-2 items-center">
                <input type="number" id="am" placeholder="0" min="0" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-gray-200 font-mono focus:border-[#C3FF00] outline-none" />
                <button className="bg-zinc-800 border-none rounded-md px-3 py-2 text-gray-400 text-xs hover:bg-[#C3FF00] hover:text-black transition" onClick={() => (window as any).mx?.()}>MAX</button>
              </div>
            </div>
            <div className="bg-zinc-950 rounded-lg p-3 mb-4 text-sm font-mono">
              <div className="flex justify-between py-1"><span>Avg price</span><span id="ap">&mdash;</span></div>
              <div className="flex justify-between py-1"><span>Slippage</span><span id="slp">&mdash;</span></div>
              <div className="flex justify-between py-1 border-t border-zinc-800 mt-1 pt-2 font-bold"><span id="cl">Total cost</span><span id="tc">&mdash;</span></div>
            </div>
            <button className="w-full py-3 bg-green-500 text-black font-bold rounded-lg hover:opacity-85 transition disabled:opacity-40 disabled:cursor-not-allowed" id="ab" disabled onClick={() => (window as any).ex?.()}>Enter amount</button>
            <div className="text-center py-3 rounded-lg text-sm mt-3 hidden" id="tx"></div>
          </div>
        </div>

        <div className="text-center text-gray-600 text-xs mt-8">
          powered by smart contracts &middot; <Link href="/" className="text-[#C3FF00] no-underline">chainhost.online</Link>
        </div>
      </main>

      <Script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.1/ethers.umd.min.js" strategy="beforeInteractive" />
      <Script id="mint-logic" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: MINT_SCRIPT }} />
    </div>
  );
}

const MINT_SCRIPT = `
const FACTORY_ADDRESS = "0x72B23955FFeEb864589D94C0661D6BCcEB44e49d";
const FACTORY_ABI = [
    "function createToken(string _tick, uint256 _maxSupply, uint256 _basePrice) returns (address)",
    "function tokenByTick(string) view returns (address)",
    "function allTokens(uint256) view returns (address)",
    "function allTokensLength() view returns (uint256)"
];
const TOKEN_ABI = [
    "function name() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function maxSupply() view returns (uint256)",
    "function basePrice() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function getPrice() view returns (uint256)",
    "function getBuyCost(uint256) view returns (uint256)",
    "function getSellProceeds(uint256) view returns (uint256)",
    "function migrated() view returns (bool)",
    "function buy(uint256 amount) payable",
    "function sell(uint256 amount, uint256 minEth)",
    "function approve(address spender, uint256 value) returns (bool)"
];

var md = "b", provider = null, signer = null;
var factory = null, factoryW = null;
var token = null, tokenW = null, tokenAddr = null;
var userBal = 0n, curSupply = 0n, maxSupply = 0n, basePrice = 0n, isMigrated = false;
var tickName = "", selectedName = "";

function gp(s, M, B) { return B * Math.pow(s / M, 1.5); }

async function fetchNames(addr) {
    const names = [];
    let pageKey = null;
    do {
        let url = "https://api.ethscriptions.com/v2/ethscriptions?current_owner=" + addr + "&mimetype=text/plain&per_page=100";
        if (pageKey) url += "&page_key=" + pageKey;
        const res = await fetch(url);
        const data = await res.json();
        for (const e of (data.result || [])) {
            const uri = e.content_uri || "";
            if (uri.startsWith("data:,")) {
                const name = decodeURIComponent(uri.slice(6)).trim();
                if (name.length > 0 && name.length <= 32) names.push(name);
            }
        }
        pageKey = data.pagination?.page_key || null;
    } while (pageKey);
    return names;
}

async function renderNames(addr) {
    const loading = document.getElementById("names-loading");
    const list = document.getElementById("name-list");
    const noNames = document.getElementById("no-names");
    loading.textContent = "Loading names for " + addr.slice(0,6) + "...";
    try {
        const names = await fetchNames(addr);
        loading.style.display = "none";
        if (names.length === 0) { noNames.classList.remove("hidden"); return; }
        const checks = await Promise.all(names.map(async n => {
            try { const existing = await factory.tokenByTick(n); return { name: n, used: existing !== "0x0000000000000000000000000000000000000000" }; }
            catch { return { name: n, used: false }; }
        }));
        list.innerHTML = "";
        list.classList.remove("hidden");
        for (const { name, used } of checks) {
            const li = document.createElement("li");
            li.textContent = "$" + name;
            li.className = used
                ? "opacity-30 cursor-not-allowed line-through bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
                : "bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-[#C3FF00] hover:text-[#C3FF00] transition";
            if (used) { li.title = "Already launched"; li.onclick = () => loadToken(name); }
            else { li.onclick = () => selectName(name, li); }
            list.appendChild(li);
        }
    } catch (e) {
        loading.style.display = "block";
        loading.textContent = "Failed to load names: " + (e.message || e);
    }
}

function selectName(name, el) {
    document.querySelectorAll("#name-list li").forEach(li => { li.style.background = ""; li.style.color = ""; li.style.borderColor = ""; });
    el.style.background = "#C3FF00"; el.style.color = "#000"; el.style.borderColor = "#C3FF00";
    selectedName = name;
    document.getElementById("create-options").classList.remove("hidden");
    document.getElementById("selected-name-btn").textContent = name;
    calcPreview();
}

function calcPreview() {
    const M = parseFloat(document.getElementById("supply-input").value) || 0;
    const B = parseFloat(document.getElementById("price-input").value) || 0;
    if (M <= 0 || B <= 0) return;
    const bpEth = B * 1e-9;
    const migS = M * 0.69;
    const migPrice = bpEth * Math.pow(migS / M, 1.5);
    const fullPrice = bpEth;
    const migRaised = bpEth * M * Math.pow(0.69, 2.5) / 2.5;
    const migMC = migPrice * migS;
    const fdMC = fullPrice * M;
    function fmt(eth) {
        if (eth >= 1) return eth.toFixed(4) + " ETH";
        if (eth >= 0.001) return eth.toFixed(6) + " ETH";
        return eth.toExponential(4) + " ETH";
    }
    document.getElementById("pv-migprice").textContent = fmt(migPrice);
    document.getElementById("pv-migmc").textContent = fmt(migMC);
    document.getElementById("pv-raised").textContent = fmt(migRaised);
    document.getElementById("pv-fullprice").textContent = fmt(fullPrice);
    document.getElementById("pv-fdmc").textContent = fmt(fdMC);
}

window.cw = async function() {
    if (!window.ethereum) { alert("No Ethereum wallet detected."); return; }
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const addr = await signer.getAddress();
    document.getElementById("cb").style.display = "none";
    document.getElementById("wf").classList.remove("hidden");
    document.getElementById("wa").textContent = addr.slice(0, 6) + "\\u2026" + addr.slice(-4);
    factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    factoryW = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
    await renderNames(addr);
};

window.createToken = async function() {
    const tick = selectedName;
    const supply = document.getElementById("supply-input").value.trim();
    const price = document.getElementById("price-input").value.trim();
    if (!tick || !supply || !price) return;
    const st = document.getElementById("create-status");
    st.className = "text-center py-3 rounded-lg text-sm mt-3 bg-zinc-800 text-gray-400";
    st.textContent = "Creating $" + tick + "...";
    try {
        const existing = await factory.tokenByTick(tick);
        if (existing !== "0x0000000000000000000000000000000000000000") {
            st.className = "text-center py-3 rounded-lg text-sm mt-3 bg-red-900/20 text-red-400";
            st.textContent = "$" + tick + " already exists!";
            setTimeout(() => loadToken(tick), 1000);
            return;
        }
        const supplyWei = ethers.parseEther(supply);
        const priceWei = BigInt(price) * 1000000000n;
        const tx = await factoryW.createToken(tick, supplyWei, priceWei);
        st.textContent = "Confirming...";
        await tx.wait();
        st.className = "text-center py-3 rounded-lg text-sm mt-3 bg-green-900/20 text-green-400";
        st.textContent = "\\u2713 $" + tick + " created! Redirecting...";
        setTimeout(() => { window.location.href = "https://" + tick + ".chainhost.online"; }, 1500);
    } catch (e) {
        st.className = "text-center py-3 rounded-lg text-sm mt-3 bg-red-900/20 text-red-400";
        st.textContent = "\\u2717 " + (e.reason || e.message || "Failed");
    }
};

async function loadToken(tick) {
    tick = tick.toLowerCase();
    tickName = tick;
    tokenAddr = await factory.tokenByTick(tick);
    if (tokenAddr === "0x0000000000000000000000000000000000000000") { alert("$" + tick + " not found"); return; }
    token = new ethers.Contract(tokenAddr, TOKEN_ABI, provider);
    tokenW = signer ? new ethers.Contract(tokenAddr, TOKEN_ABI, signer) : null;
    document.getElementById("token-name").textContent = tick;
    document.getElementById("create-panel").style.display = "none";
    document.getElementById("token-panel").classList.remove("hidden");
    if (signer) document.getElementById("token-bal-wrap").classList.remove("hidden");
    await refresh();
}

async function refresh() {
    if (!token) return;
    try {
        const [supply, price, ms, bp, bal, migFlag] = await Promise.all([
            token.totalSupply(), token.getPrice(), token.maxSupply(), token.basePrice(),
            signer ? token.balanceOf(await signer.getAddress()) : 0n, token.migrated()
        ]);
        curSupply = supply; maxSupply = ms; basePrice = bp; userBal = bal; isMigrated = migFlag;
        const supplyNum = Number(ethers.formatEther(supply));
        const maxNum = Number(ethers.formatEther(ms));
        const priceEth = Number(ethers.formatEther(price));
        const reserve = await provider.getBalance(tokenAddr);
        document.getElementById("sp").innerHTML = priceEth.toFixed(10) + ' <span class="text-sm text-gray-500 font-normal">ETH</span>';
        document.getElementById("cs").textContent = Math.floor(supplyNum).toLocaleString();
        document.getElementById("ms").textContent = Math.floor(maxNum).toLocaleString();
        document.getElementById("rv").textContent = Number(ethers.formatEther(reserve)).toFixed(6) + " ETH";
        document.getElementById("wb").textContent = Math.floor(Number(ethers.formatEther(bal))).toLocaleString();
        document.getElementById("sb").style.width = (supplyNum / maxNum * 100) + "%";
        document.getElementById("amt-label").textContent = "Amount ($" + tickName + ")";
        if (isMigrated) {
            document.getElementById("migrated-msg").classList.remove("hidden");
            document.getElementById("trade-card").style.display = "none";
            document.getElementById("uni-link").href = "https://app.uniswap.org/#/swap?outputCurrency=" + tokenAddr;
        }
        dc(supplyNum, maxNum, Number(ethers.formatEther(bp)));
    } catch (e) { console.error("refresh error", e); }
}

window.sm = function(m) {
    md = m;
    const tb = document.getElementById("tb"), ts = document.getElementById("ts2"), ab = document.getElementById("ab");
    tb.className = m === "b" ? "flex-1 py-2 text-center text-sm font-semibold bg-[#C3FF00] text-black" : "flex-1 py-2 text-center text-sm font-semibold bg-zinc-900 text-gray-500 hover:bg-zinc-800";
    ts.className = m === "s" ? "flex-1 py-2 text-center text-sm font-semibold bg-red-500 text-white" : "flex-1 py-2 text-center text-sm font-semibold bg-zinc-900 text-gray-500 hover:bg-zinc-800";
    ab.className = m === "b"
        ? "w-full py-3 bg-green-500 text-black font-bold rounded-lg hover:opacity-85 transition disabled:opacity-40 disabled:cursor-not-allowed"
        : "w-full py-3 bg-red-500 text-white font-bold rounded-lg hover:opacity-85 transition disabled:opacity-40 disabled:cursor-not-allowed";
    document.getElementById("cl").textContent = m === "b" ? "Total cost" : "You receive";
    window.up();
};

window.mx = function() {
    if (md === "s") { document.getElementById("am").value = Math.floor(Number(ethers.formatEther(userBal))); }
    else {
        const maxNum = Number(ethers.formatEther(maxSupply));
        const curNum = Number(ethers.formatEther(curSupply));
        document.getElementById("am").value = Math.floor(Math.max(0, maxNum * 0.69 - curNum));
    }
    window.up();
};

window.up = async function() {
    const a = parseFloat(document.getElementById("am").value) || 0;
    const b = document.getElementById("ab");
    if (a <= 0 || !token) {
        document.getElementById("ap").textContent = "\\u2014";
        document.getElementById("slp").textContent = "\\u2014";
        document.getElementById("tc").textContent = "\\u2014";
        b.disabled = true; b.textContent = "Enter amount"; return;
    }
    try {
        const w = ethers.parseEther(String(a));
        if (md === "b") {
            const c = await token.getBuyCost(w), cE = Number(ethers.formatEther(c));
            document.getElementById("ap").textContent = (cE/a).toFixed(10) + " ETH";
            document.getElementById("slp").textContent = "~1%";
            document.getElementById("tc").textContent = cE.toFixed(8) + " ETH";
            b.disabled = !signer; b.textContent = signer ? "Buy " + a.toLocaleString() + " $" + tickName : "Connect wallet";
        } else {
            const p = await token.getSellProceeds(w), pE = Number(ethers.formatEther(p));
            document.getElementById("ap").textContent = (pE/a).toFixed(10) + " ETH";
            document.getElementById("slp").textContent = "~1%";
            document.getElementById("tc").textContent = pE.toFixed(8) + " ETH";
            b.disabled = !signer; b.textContent = signer ? "Sell " + a.toLocaleString() + " $" + tickName : "Connect wallet";
        }
    } catch (e) { b.disabled = true; b.textContent = "Invalid amount"; }
};

window.ex = async function() {
    const a = parseFloat(document.getElementById("am").value);
    if (!a || !tokenW) return;
    const st = document.getElementById("tx");
    st.className = "text-center py-3 rounded-lg text-sm mt-3 bg-zinc-800 text-gray-400";
    st.textContent = "Waiting for wallet...";
    try {
        const w = ethers.parseEther(String(a));
        let tx;
        if (md === "b") { const c = await token.getBuyCost(w); tx = await tokenW.buy(w, { value: c * 101n / 100n }); }
        else { const p = await token.getSellProceeds(w); const minE = p * 99n / 100n; const at = await tokenW.approve(tokenAddr, w); await at.wait(); tx = await tokenW.sell(w, minE); }
        st.textContent = "Confirming..."; await tx.wait();
        st.className = "text-center py-3 rounded-lg text-sm mt-3 bg-green-900/20 text-green-400";
        st.innerHTML = "\\u2713 Done! <a href='https://etherscan.io/tx/" + tx.hash + "' target='_blank' class='text-green-400'>" + tx.hash.slice(0,18) + "\\u2026</a>";
        document.getElementById("am").value = ""; await refresh(); window.up();
    } catch (e) {
        st.className = "text-center py-3 rounded-lg text-sm mt-3 bg-red-900/20 text-red-400";
        st.textContent = "\\u2717 " + (e.reason || e.message || "Rejected");
    }
};

function dc(supplyNum, maxNum, bp) {
    supplyNum = supplyNum || 0; maxNum = maxNum || 1; bp = bp || 1;
    const cv = document.getElementById("cc"), cx = cv.getContext("2d");
    const d = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * d; cv.height = H * d; cx.scale(d, d); cx.clearRect(0, 0, W, H);
    cx.strokeStyle = "#1e1e2e"; cx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = H / 4 * i; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    cx.beginPath(); cx.strokeStyle = "#c3ff00"; cx.lineWidth = 2;
    const maxP = gp(maxNum, maxNum, bp);
    for (let i = 0; i <= 200; i++) {
        const s = maxNum / 200 * i, p = gp(s, maxNum, bp), x = i / 200 * W, y = H - (p / maxP) * (H - 10) - 5;
        i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
    }
    cx.stroke();
    const sp = supplyNum / maxNum;
    cx.beginPath(); cx.fillStyle = "#c3ff0022";
    for (let i = 0; i <= Math.floor(sp * 200); i++) {
        const s = maxNum / 200 * i, p = gp(s, maxNum, bp), x = i / 200 * W, y = H - (p / maxP) * (H - 10) - 5;
        i === 0 ? (cx.moveTo(x, H), cx.lineTo(x, y)) : cx.lineTo(x, y);
    }
    cx.lineTo(sp * W, H); cx.closePath(); cx.fill();
    if (supplyNum > 0) {
        const cx2 = sp * W, cy2 = H - (gp(supplyNum, maxNum, bp) / maxP) * (H - 10) - 5;
        cx.beginPath(); cx.arc(cx2, cy2, 5, 0, Math.PI * 2); cx.fillStyle = "#c3ff00"; cx.fill();
        cx.strokeStyle = "#fff"; cx.lineWidth = 2; cx.stroke();
    }
}

// Wire up oninput for preview calc
document.getElementById("supply-input")?.addEventListener("input", calcPreview);
document.getElementById("price-input")?.addEventListener("input", calcPreview);
document.getElementById("am")?.addEventListener("input", function() { window.up(); });
`;
