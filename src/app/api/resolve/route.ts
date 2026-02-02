import { NextRequest, NextResponse } from "next/server";

// Ethscriptions AppChain RPC + contract
const APPCHAIN_RPC = "https://mainnet.ethscriptions.com";
const ETHSCRIPTIONS_CONTRACT = "0x3300000000000000000000000000000000000001";

// Function selectors
const FIRST_BY_CONTENT_URI = "0xf7c2f2d2"; // firstEthscriptionByContentUri(bytes32)
const OWNER_OF = "0x7dd56411";              // ownerOf(bytes32)

// In-memory cache (AppChain RPC is rate-limited)
const CACHE_TTL = 60_000;
const cache = new Map<string, { owner: string | null; ts: number }>();

async function ethCall(data: string): Promise<string> {
  const res = await fetch(APPCHAIN_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "eth_call",
      params: [{ to: ETHSCRIPTIONS_CONTRACT, data }, "latest"],
    }),
  });
  const json = await res.json();
  return json.result || "0x";
}

async function resolveViaAppChain(name: string): Promise<string | null> {
  const cached = cache.get(name);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.owner;

  try {
    // Step 1: sha256("data:,{name}") → content SHA
    const content = `data:,${name}`;
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const contentSha = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Step 2: firstEthscriptionByContentUri(bytes32) → ethscription ID
    const ethscriptionId = await ethCall(FIRST_BY_CONTENT_URI + contentSha);
    if (!ethscriptionId || ethscriptionId === "0x" || ethscriptionId === "0x" + "0".repeat(64)) {
      cache.set(name, { owner: null, ts: Date.now() });
      return null;
    }

    // Step 3: ownerOf(bytes32) → owner address
    const ownerResult = await ethCall(OWNER_OF + ethscriptionId.slice(2));
    if (ownerResult && ownerResult.length >= 66) {
      const addr = "0x" + ownerResult.slice(26);
      if (addr !== "0x0000000000000000000000000000000000000000") {
        const owner = addr.toLowerCase();
        cache.set(name, { owner, ts: Date.now() });
        return owner;
      }
    }

    cache.set(name, { owner: null, ts: Date.now() });
  } catch { /* fall through to indexer */ }
  return null;
}

async function resolveViaIndexer(name: string): Promise<string | null> {
  const content = `data:,${name}`;
  const msgBuffer = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const sha = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const res = await fetch(
    `https://api.ethscriptions.com/v2/ethscriptions/exists/0x${sha}`,
    { next: { revalidate: 30 } }
  );
  const data = await res.json();

  if (data.result?.exists) {
    return data.result.ethscription.current_owner.toLowerCase();
  }
  return null;
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing name parameter" }, { status: 400 });
  }

  try {
    // Try AppChain contract first, fall back to indexer API
    const appchainResult = await resolveViaAppChain(name);
    if (appchainResult) {
      return NextResponse.json({ name, owner: appchainResult, source: "appchain" });
    }

    const indexerResult = await resolveViaIndexer(name);
    return NextResponse.json({
      name,
      owner: indexerResult ?? null,
      source: indexerResult ? "indexer" : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to resolve name" }, { status: 500 });
  }
}
