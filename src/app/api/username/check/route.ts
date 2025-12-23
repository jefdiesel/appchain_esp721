import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateUsername, generateSuggestions } from "@/lib/username";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  // Validate format
  const validation = validateUsername(username);
  if (!validation.valid) {
    return NextResponse.json({
      available: false,
      error: validation.error,
      suggestions: generateSuggestions(username),
    });
  }

  // Check if user already has this username
  const { data: currentUser } = await supabaseAdmin
    .from("users")
    .select("username")
    .eq("clerk_id", userId)
    .single();

  if (currentUser?.username === username) {
    return NextResponse.json({
      available: true,
      username,
      subdomain: `${username}.chainhost.online`,
      isOwned: true,
    });
  }

  // Check if taken by someone else
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", username)
    .single();

  if (existing) {
    return NextResponse.json({
      available: false,
      error: "Username is already taken",
      suggestions: generateSuggestions(username),
    });
  }

  return NextResponse.json({
    available: true,
    username,
    subdomain: `${username}.chainhost.online`,
  });
}
