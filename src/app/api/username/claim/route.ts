import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateUsername } from "@/lib/username";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await req.json();
  const cleanUsername = username?.toLowerCase();

  if (!cleanUsername) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  // Validate format
  const validation = validateUsername(cleanUsername);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Get or create user record
  const { data: dbUser, error: userError } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        clerk_id: userId,
        email: user.emailAddresses[0]?.emailAddress || "",
      },
      { onConflict: "clerk_id" }
    )
    .select()
    .single();

  if (userError) {
    console.error("User upsert error:", userError);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }

  // Check if user already has a username
  if (dbUser.username) {
    return NextResponse.json(
      { error: "You already have a username", currentUsername: dbUser.username },
      { status: 400 }
    );
  }

  // Check if username is taken (race condition protection)
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", cleanUsername)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Username is already taken" }, { status: 400 });
  }

  // Claim the username
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("users")
    .update({ username: cleanUsername })
    .eq("id", dbUser.id)
    .select()
    .single();

  if (updateError) {
    // Unique constraint violation means someone grabbed it
    if (updateError.code === "23505") {
      return NextResponse.json({ error: "Username was just taken" }, { status: 400 });
    }
    console.error("Username claim error:", updateError);
    return NextResponse.json({ error: "Failed to claim username" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    username: cleanUsername,
    subdomain: `${cleanUsername}.chainhost.online`,
    user: updated,
  });
}
