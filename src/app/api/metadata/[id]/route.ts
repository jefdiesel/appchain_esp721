import { NextRequest, NextResponse } from "next/server";

const ETHSCRIPTIONS_API = "https://api.ethscriptions.com/v2/ethscriptions";

// Cache: ethscription content is immutable
const cache = new Map<string, { json: object; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate hex id
  if (!/^0x[0-9a-f]{64}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid ethscription ID" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.json, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  try {
    // Fetch ethscription data from indexer
    const res = await fetch(`${ETHSCRIPTIONS_API}/${id}`);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Ethscription not found" },
        { status: 404 }
      );
    }

    const data = await res.json();
    const esc = data.result || data;

    const contentUri: string = esc.content_uri || "";
    const creator: string = esc.creator || "";
    const blockNumber: string = esc.block_number || "";
    const txHash: string = esc.transaction_hash || id;

    // Determine content type and build image URL
    let image: string;
    let contentType = "unknown";

    if (contentUri.startsWith("data:text/plain") || contentUri.startsWith("data:,")) {
      // Text ethscription — render as SVG
      contentType = "text";
      const text = decodeContentUri(contentUri);
      image = textToSvgDataUri(text);
    } else if (
      contentUri.startsWith("data:image/") ||
      contentUri.startsWith("data:image/png") ||
      contentUri.startsWith("data:image/svg")
    ) {
      // Image ethscription — use the data URI directly
      contentType = "image";
      image = contentUri;
    } else {
      // Fallback: use ethscriptions.com attachment endpoint
      contentType = "other";
      image = `https://api.ethscriptions.com/v2/ethscriptions/${id}/attachment`;
    }

    const metadata = {
      name: contentType === "text" ? decodeContentUri(contentUri) : `Ethscription ${id.slice(0, 10)}...`,
      description: `Wrapped ethscription ${id}. Originally created by ${creator} in block ${blockNumber}.`,
      image,
      external_url: `https://ethscriptions.com/ethscriptions/${id}`,
      attributes: [
        { trait_type: "Content Type", value: contentType },
        { trait_type: "Creator", value: creator },
        { trait_type: "Block Number", value: blockNumber },
        { trait_type: "Original TX", value: txHash },
      ],
    };

    cache.set(id, { json: metadata, ts: Date.now() });

    return NextResponse.json(metadata, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch (err) {
    console.error("Metadata fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 500 });
  }
}

function decodeContentUri(uri: string): string {
  if (uri.startsWith("data:,")) return decodeURIComponent(uri.slice(6));
  // data:text/plain;...,content
  const commaIdx = uri.indexOf(",");
  if (commaIdx === -1) return uri;
  const meta = uri.slice(0, commaIdx);
  const body = uri.slice(commaIdx + 1);
  if (meta.includes("base64")) {
    return Buffer.from(body, "base64").toString("utf-8");
  }
  return decodeURIComponent(body);
}

function textToSvgDataUri(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const fontSize = text.length > 20 ? 16 : text.length > 10 ? 24 : 32;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <rect width="500" height="500" fill="#000"/>
  <text x="250" y="250" font-family="monospace" font-size="${fontSize}" fill="#C3FF00"
    text-anchor="middle" dominant-baseline="central">${escaped}</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
