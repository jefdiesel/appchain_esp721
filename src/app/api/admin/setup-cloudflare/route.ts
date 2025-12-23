import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { setupSubdomainSystem } from "@/lib/cloudflare";

// Admin-only endpoint to set up Cloudflare subdomain system
// Call this once to create the worker, route, and DNS

const ADMIN_USER_IDS = [
  // Add your Clerk user ID here
  process.env.ADMIN_USER_ID,
].filter(Boolean);

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if admin (or allow if no admin configured yet)
  if (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Check required env vars
  const missing = [];
  if (!process.env.CLOUDFLARE_API_TOKEN) missing.push("CLOUDFLARE_API_TOKEN");
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Missing env vars", missing },
      { status: 400 }
    );
  }

  try {
    const result = await setupSubdomainSystem();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Setup failed", details: String(error) },
      { status: 500 }
    );
  }
}
