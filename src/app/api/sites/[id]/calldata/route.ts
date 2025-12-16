import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { htmlToCalldata, estimateGas } from "@/lib/inscription";

// GET - Generate calldata for inscription
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
    .select("html_minified")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const calldata = htmlToCalldata(site.html_minified);
  const gasEstimate = estimateGas(site.html_minified);

  return NextResponse.json({
    calldata,
    gasEstimate,
    instructions: [
      "1. Copy the calldata below",
      "2. Open your wallet (MetaMask, Rainbow, etc.)",
      "3. Send a transaction to your own address",
      "4. Paste the calldata in the data/hex field",
      "5. Set value to 0 ETH",
      "6. Confirm the transaction",
      "7. Copy the transaction hash and save it to your site",
    ],
  });
}
