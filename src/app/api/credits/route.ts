import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserCredits, canInscribe } from "@/lib/credits";

// GET - get user's credit status
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credits = await getUserCredits(userId);

  return NextResponse.json({
    plan: credits.plan,
    creditsUsed: credits.creditsUsed,
    creditsRemaining: credits.creditsRemaining,
    canUploadTemplates: credits.canUploadTemplates,
    isPaid: credits.plan === "paid",
  });
}
