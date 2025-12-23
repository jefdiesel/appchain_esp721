import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  minifyHtml,
  htmlToCalldata,
  estimateGas,
  generateServiceWorker,
  generateBootstrapHtml,
  validateForInscription,
} from "@/lib/inscription";

// GET - List user's sites
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ sites: [] });
  }

  const { data: sites, error } = await supabaseAdmin
    .from("sites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching sites:", error);
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
  }

  return NextResponse.json({ sites });
}

// POST - Create new site
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const clerkUser = await currentUser();

  if (!userId || !clerkUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, slug, template, style, html, htmlContent, inscription_tx, chain } = await req.json();

  if (!name || !slug) {
    return NextResponse.json(
      { error: "Name and slug required" },
      { status: 400 }
    );
  }

  const htmlToSave = html || htmlContent;

  // Get or create user
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        clerk_id: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
      },
      { onConflict: "clerk_id" }
    )
    .select()
    .single();

  if (userError) {
    console.error("User upsert error:", userError);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }

  // Validate HTML if provided
  if (htmlToSave) {
    const validation = validateForInscription(htmlToSave);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "HTML validation failed",
          issues: validation.issues,
        },
        { status: 400 }
      );
    }
  }

  // Generate minified HTML
  const finalHtml = htmlToSave || generateBootstrapHtml(name);
  const minified = minifyHtml(finalHtml);

  // Generate service worker
  const sw = generateServiceWorker(user.wallet_address || userId, {});

  // Calculate gas estimate
  const gasEstimate = estimateGas(minified);

  // Create or update site
  const siteSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const { data: site, error: siteError } = await supabaseAdmin
    .from("sites")
    .upsert({
      user_id: user.id,
      name,
      slug: siteSlug,
      template,
      style,
      html_content: finalHtml,
      html_minified: minified,
      sw_content: sw,
      status: inscription_tx ? "live" : "draft",
      inscription_tx: inscription_tx || null,
      chain: chain || "base",
    }, { onConflict: "user_id,slug" })
    .select()
    .single();

  if (siteError) {
    console.error("Site creation error:", siteError);
    if (siteError.code === "23505") {
      return NextResponse.json(
        { error: "A site with this slug already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create site" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    site,
    calldata: htmlToCalldata(minified),
    gasEstimate,
  });
}
