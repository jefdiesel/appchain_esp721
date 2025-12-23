import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { useCredit, canInscribe } from "@/lib/credits";

// POST - use a credit after successful inscription
export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user can inscribe first
  const check = await canInscribe(userId);
  if (!check.allowed) {
    return NextResponse.json(
      { error: check.reason || "Cannot use credit" },
      { status: 403 }
    );
  }

  // Use a credit
  const success = await useCredit(userId);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to use credit" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
