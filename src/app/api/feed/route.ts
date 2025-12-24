import { NextResponse } from "next/server";

const ETHSCRIPTIONS_API = "https://api.ethscriptions.com/v2";

interface ChainhostSite {
  name: string;
  owner: string;
  manifestTx: string;
  timestamp: number;
}

export async function GET() {
  try {
    const sites: ChainhostSite[] = [];
    const seenNames = new Set<string>();
    const allEthscriptions: any[] = [];

    // Fetch JSON ethscriptions using cursor pagination (up to 1000)
    let pageKey: string | null = null;
    let pageCount = 0;
    const maxPages = 10;

    while (pageCount < maxPages) {
      const url = pageKey
        ? `${ETHSCRIPTIONS_API}/ethscriptions?mime_subtype=json&per_page=100&page_key=${pageKey}`
        : `${ETHSCRIPTIONS_API}/ethscriptions?mime_subtype=json&per_page=100`;

      const res = await fetch(url, { next: { revalidate: 60 } });
      const data = await res.json();

      if (!data.result?.length) break;
      allEthscriptions.push(...data.result);

      if (data.pagination?.has_more && data.pagination?.page_key) {
        pageKey = data.pagination.page_key;
        pageCount++;
      } else {
        break;
      }
    }

    for (const eth of allEthscriptions) {
      try {
        const uri = eth.content_uri;
        if (!uri) continue;

        let json: string;

        // Decode data URI
        if (uri.includes(";base64,")) {
          const base64 = uri.split(";base64,")[1];
          json = atob(base64);
        } else if (uri.startsWith("data:application/json,")) {
          json = decodeURIComponent(uri.slice(22));
        } else {
          continue;
        }

        const parsed = JSON.parse(json);

        // Check for chainhost manifest format
        if (parsed.chainhost && typeof parsed.chainhost === "object") {
          for (const [name, routes] of Object.entries(parsed.chainhost)) {
            // Only lowercase names, skip if already seen (we want latest only)
            if (
              /^[a-z0-9-]+$/.test(name) &&
              typeof routes === "object" &&
              routes !== null &&
              !seenNames.has(name)
            ) {
              seenNames.add(name);
              sites.push({
                name,
                owner: eth.current_owner,
                manifestTx: eth.transaction_hash,
                timestamp: eth.block_timestamp || 0,
              });
            }
          }
        }
      } catch {
        // Skip invalid manifests
      }
    }

    // Sort by timestamp descending (newest first)
    sites.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ sites });
  } catch (error) {
    console.error("Feed error:", error);
    return NextResponse.json({ sites: [], error: "Failed to fetch feed" });
  }
}
