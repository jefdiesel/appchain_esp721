import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET - fetch user's blog posts
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user from Supabase - try clerk_id first
  let { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  // If not found, the dashboard will handle linking by email on next visit
  if (!user) {
    return NextResponse.json({ posts: [] });
  }

  // Get all blog posts for this user, ordered by date
  const { data: posts, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id, title, author, keywords, tx_hash, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching blog posts:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }

  return NextResponse.json({ posts: posts || [] });
}

// POST - save a new blog post
export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, author, content, keywords, tx_hash } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Get or create user in Supabase
  let { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!user) {
    // Create user if doesn't exist
    const { data: newUser, error: createError } = await supabaseAdmin
      .from("users")
      .insert({ clerk_id: userId, email: "unknown@chainhost.online" })
      .select("id")
      .single();

    if (createError) {
      console.error("Error creating user:", createError);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
    user = newUser;
  }

  // Insert the blog post
  const { data: post, error } = await supabaseAdmin
    .from("blog_posts")
    .insert({
      user_id: user.id,
      title,
      author,
      content,
      keywords,
      tx_hash,
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving blog post:", error);
    return NextResponse.json({ error: "Failed to save post" }, { status: 500 });
  }

  return NextResponse.json({ success: true, post });
}

// PATCH - update a blog post (mainly for adding tx_hash after inscription)
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, tx_hash } = body;

  if (!id) {
    return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
  }

  // Get user
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Update the post (only if owned by user)
  const { data: post, error } = await supabaseAdmin
    .from("blog_posts")
    .update({ tx_hash })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating blog post:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }

  return NextResponse.json({ success: true, post });
}
