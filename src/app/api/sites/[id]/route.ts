import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  minifyHtml,
  htmlToCalldata,
  estimateGas,
  validateForInscription,
} from "@/lib/inscription";

// GET - Get single site
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: site, error } = await supabaseAdmin
    .from("sites")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ site });
}

// PATCH - Update site
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updates = await req.json();

  // If HTML content is being updated, validate and re-minify
  if (updates.html_content) {
    const validation = validateForInscription(updates.html_content);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "HTML validation failed",
          issues: validation.issues,
        },
        { status: 400 }
      );
    }
    updates.html_minified = minifyHtml(updates.html_content);
  }

  // If inscription tx is provided, update status
  if (updates.inscription_tx) {
    updates.status = "inscribed";
  }

  const { data: site, error } = await supabaseAdmin
    .from("sites")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !site) {
    console.error("Site update error:", error);
    return NextResponse.json({ error: "Failed to update site" }, { status: 500 });
  }

  // Return updated calldata if HTML was changed
  let calldata, gasEstimate;
  if (updates.html_content || updates.html_minified) {
    calldata = htmlToCalldata(site.html_minified);
    gasEstimate = estimateGas(site.html_minified);
  }

  return NextResponse.json({ site, calldata, gasEstimate });
}

// DELETE - Delete site
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("sites")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Site delete error:", error);
    return NextResponse.json({ error: "Failed to delete site" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
