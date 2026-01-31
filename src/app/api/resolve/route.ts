import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing name parameter" }, { status: 400 });
  }

  try {
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
      return NextResponse.json({
        name,
        owner: data.result.ethscription.current_owner.toLowerCase(),
      });
    }

    return NextResponse.json({ name, owner: null });
  } catch {
    return NextResponse.json({ error: "Failed to resolve name" }, { status: 500 });
  }
}
