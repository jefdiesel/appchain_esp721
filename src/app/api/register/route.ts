import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, txHash, wallet } = await request.json();

    if (!name || !txHash || !wallet) {
      return NextResponse.json(
        { error: "Missing name, txHash, or wallet" },
        { status: 400 }
      );
    }

    // Validate name format
    if (!/^[a-z0-9-]+$/.test(name) || name.length > 32) {
      return NextResponse.json(
        { error: "Invalid name format" },
        { status: 400 }
      );
    }

    // Check if name already registered in our DB
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("username", name)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "Name already registered" },
        { status: 409 }
      );
    }

    // Get or create user
    let { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("clerk_id", userId)
      .single();

    if (!user) {
      // Create user
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          clerk_id: userId,
          email: "", // Will be updated from Clerk
          username: name,
          wallet_address: wallet,
        })
        .select()
        .single();

      if (createError) throw createError;
      user = newUser;
    } else {
      // Update existing user with username and wallet
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          username: name,
          wallet_address: wallet,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;
    }

    // Create site entry for this name
    const { error: siteError } = await supabaseAdmin.from("sites").insert({
      user_id: user.id,
      name: name,
      slug: name,
      status: "draft",
      inscription_tx: txHash, // The name claim tx
    });

    if (siteError && !siteError.message.includes("duplicate")) {
      throw siteError;
    }

    return NextResponse.json({
      success: true,
      name,
      txHash,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    );
  }
}
