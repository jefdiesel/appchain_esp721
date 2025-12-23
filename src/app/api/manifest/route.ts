import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { manifestTx, routes } = await request.json();

    if (!manifestTx) {
      return NextResponse.json(
        { error: "Missing manifestTx" },
        { status: 400 }
      );
    }

    // Get user
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, username")
      .eq("clerk_id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update site with manifest tx
    const { error: updateError } = await supabaseAdmin
      .from("sites")
      .update({
        manifest_tx: manifestTx,
        status: "live",
        updated_at: new Date().toISOString(),
      })
      .eq("slug", user.username);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      manifestTx,
      routes,
    });
  } catch (error) {
    console.error("Manifest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save manifest" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's site
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, username")
      .eq("clerk_id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: site } = await supabaseAdmin
      .from("sites")
      .select("manifest_tx, inscription_tx, status")
      .eq("slug", user.username)
      .single();

    return NextResponse.json({
      username: user.username,
      manifestTx: site?.manifest_tx,
      nameTx: site?.inscription_tx,
      status: site?.status,
    });
  } catch (error) {
    console.error("Manifest GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get manifest" },
      { status: 500 }
    );
  }
}
