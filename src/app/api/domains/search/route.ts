import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkDomainAvailability } from "@/lib/dynadot";
import { DOMAIN_PRICING } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "Domain required" }, { status: 400 });
  }

  // Clean the domain name
  const cleanDomain = domain.toLowerCase().replace(/[^a-z0-9-]/g, "");

  if (cleanDomain.length < 2) {
    return NextResponse.json(
      { error: "Domain must be at least 2 characters" },
      { status: 400 }
    );
  }

  // Check availability for supported TLDs
  const tlds = Object.keys(DOMAIN_PRICING);
  const isSandbox = process.env.DYNADOT_API_KEY?.startsWith("sandbox_");

  const results = await Promise.all(
    tlds.map(async (tld) => {
      // In sandbox mode, mock availability (odd-length domains = available)
      if (isSandbox) {
        const mockAvailable = cleanDomain.length % 2 === 1;
        return {
          domain: cleanDomain,
          tld,
          fullDomain: `${cleanDomain}.${tld}`,
          available: mockAvailable,
          price: DOMAIN_PRICING[tld].price / 100,
          renewal: DOMAIN_PRICING[tld].renewal / 100,
        };
      }

      try {
        const availability = await checkDomainAvailability(
          `${cleanDomain}.${tld}`
        );
        return {
          domain: cleanDomain,
          tld,
          fullDomain: `${cleanDomain}.${tld}`,
          available: availability.available,
          price: DOMAIN_PRICING[tld].price / 100,
          renewal: DOMAIN_PRICING[tld].renewal / 100,
        };
      } catch (error) {
        console.error(`Error checking ${cleanDomain}.${tld}:`, error);
        return {
          domain: cleanDomain,
          tld,
          fullDomain: `${cleanDomain}.${tld}`,
          available: false,
          error: true,
        };
      }
    })
  );

  return NextResponse.json({ results });
}
