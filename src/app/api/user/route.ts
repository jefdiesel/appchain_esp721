import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// Username constraints
const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 20;

// Bad words filter (lowercase)
const BLOCKED_WORDS = [
  // Profanity
  "fuck", "shit", "ass", "damn", "bitch", "cunt", "dick", "cock", "pussy",
  "fag", "faggot", "nigger", "nigga", "retard", "slut", "whore",
  // Variations
  "f4ck", "sh1t", "a55", "b1tch", "d1ck", "c0ck", "pu55y", "f4g", "n1gger", "n1gga",
  // Offensive terms
  "nazi", "hitler", "kkk", "rape", "molest", "pedo", "pedophile",
  // Impersonation risks
  "admin", "moderator", "official", "support", "chainhost", "staff",
];

// Check if username contains bad words
function containsBadWord(username: string): boolean {
  const lower = username.toLowerCase();
  return BLOCKED_WORDS.some(word => lower.includes(word));
}

// GET - get current user's info including sites
export async function GET(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // First try to find by clerk_id
  let { data: user } = await supabaseAdmin
    .from("users")
    .select("id, username, plan, credits_used, email")
    .eq("clerk_id", userId)
    .single();

  // If not found, user might have logged in with different provider
  // The dashboard will handle linking by email
  if (!user) {
    return NextResponse.json({
      username: null,
      plan: "free",
      creditsUsed: 0,
      sites: [],
    });
  }

  // Fetch user's sites
  const { data: sites } = await supabaseAdmin
    .from("sites")
    .select("id, name, slug, status, inscription_tx, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    username: user.username,
    plan: user.plan || "free",
    creditsUsed: user.credits_used || 0,
    isPaid: user.plan === "paid",
    sites: sites || [],
    subdomain: user.username ? `${user.username}.chainhost.online` : null,
  });
}

// PATCH - update username
export async function PATCH(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await req.json();

  // Validate username
  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const cleanUsername = username.toLowerCase().trim();

  // Check length
  if (cleanUsername.length < USERNAME_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Username must be at least ${USERNAME_MIN_LENGTH} characters` },
      { status: 400 }
    );
  }

  if (cleanUsername.length > USERNAME_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Username must be at most ${USERNAME_MAX_LENGTH} characters` },
      { status: 400 }
    );
  }

  // Check format (alphanumeric + underscore only)
  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    return NextResponse.json(
      { error: "Username can only contain letters, numbers, and underscores" },
      { status: 400 }
    );
  }

  // Check for bad words
  if (containsBadWord(cleanUsername)) {
    return NextResponse.json(
      { error: "This username is not allowed" },
      { status: 400 }
    );
  }

  // Reserved usernames
  const reserved = ["www", "api", "app", "dashboard", "admin", "mail", "ftp", "help", "support"];
  if (reserved.includes(cleanUsername)) {
    return NextResponse.json({ error: "This username is reserved" }, { status: 400 });
  }

  // Check if username is taken
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", cleanUsername)
    .neq("clerk_id", userId)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Username is already taken" }, { status: 400 });
  }

  // Update username
  const { error } = await supabaseAdmin
    .from("users")
    .update({ username: cleanUsername })
    .eq("clerk_id", userId);

  if (error) {
    console.error("Failed to update username:", error);
    return NextResponse.json({ error: "Failed to update username" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    username: cleanUsername,
    subdomain: `${cleanUsername}.chainhost.online`
  });
}
