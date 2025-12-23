import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check if user already has a username
  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("username")
    .eq("clerk_id", user.id)
    .single();

  if (dbUser?.username) {
    redirect("/dashboard");
  }

  // Suggest username based on email or name
  const emailPrefix = user.emailAddresses[0]?.emailAddress?.split("@")[0] || "";
  const firstName = user.firstName?.toLowerCase() || "";
  const suggestion = (firstName || emailPrefix).replace(/[^a-z0-9]/g, "").slice(0, 15);

  return <OnboardingClient initialSuggestion={suggestion} />;
}
