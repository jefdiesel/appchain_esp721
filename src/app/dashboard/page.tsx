import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  console.log("CLERK USER ID:", user.id, "EMAIL:", user.emailAddresses[0]?.emailAddress);

  // Get or create user record - check by email first to handle multiple login providers
  const userEmail = user.emailAddresses[0]?.emailAddress || "";

  // First try to find by clerk_id
  let { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("clerk_id", user.id)
    .single();

  // If not found by clerk_id, try by email (handles different login providers)
  if (!dbUser && userEmail) {
    const { data: emailUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (emailUser) {
      // Found by email - update clerk_id to link this login method
      await supabaseAdmin
        .from("users")
        .update({ clerk_id: user.id })
        .eq("id", emailUser.id);
      dbUser = { ...emailUser, clerk_id: user.id };
      console.log("Linked existing user by email:", userEmail);
    }
  }

  console.log("DB USER:", dbUser, "EMAIL:", userEmail);

  // Create user if doesn't exist at all
  if (!dbUser) {
    const { data: newUser } = await supabaseAdmin
      .from("users")
      .insert({
        clerk_id: user.id,
        email: userEmail,
      })
      .select()
      .single();
    dbUser = newUser;
  }

  console.log("FINAL USER:", dbUser, "USERNAME:", dbUser?.username);

  // Redirect to onboarding if no username
  if (!dbUser?.username) {
    redirect("/onboarding");
  }

  // Fetch user's sites and domains
  const [{ data: sites }, { data: domains }] = await Promise.all([
    supabaseAdmin
      .from("sites")
      .select("*")
      .eq("user_id", dbUser.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("domains")
      .select("*")
      .eq("user_id", dbUser.id)
      .order("created_at", { ascending: false }),
  ]);

  const siteCount = sites?.length || 0;
  const domainCount = domains?.length || 0;
  const inscriptionCount = sites?.filter((s) => s.inscription_tx).length || 0;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            <span className="text-white">CHAIN</span>
            <span className="text-[#C3FF00]">HOST</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-[#C3FF00]">
              Dashboard
            </Link>
            {dbUser.plan !== "paid" && (
              <Link
                href="/upgrade"
                className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-pink-500 transition"
              >
                PRO
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-gray-500">
              Welcome back, {user.firstName || dbUser.username}
            </p>
          </div>
          <Link
            href="/builder"
            className="px-6 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
          >
            + New Post
          </Link>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 border border-zinc-800 rounded-xl">
            <div className="text-3xl font-bold text-white mb-1">{siteCount}</div>
            <div className="text-sm text-gray-500">Active Sites</div>
          </div>
          <div className="p-6 border border-zinc-800 rounded-xl">
            <div className="text-3xl font-bold text-white mb-1">{domainCount}</div>
            <div className="text-sm text-gray-500">Domains</div>
          </div>
          <div className="p-6 border border-zinc-800 rounded-xl">
            <div className="text-3xl font-bold text-white mb-1">{inscriptionCount}</div>
            <div className="text-sm text-gray-500">Inscriptions</div>
          </div>
        </div>

        {/* Sites List */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-4">Your Sites</h2>
          <div className="space-y-4">
            {/* Primary subdomain site */}
            <div className="border border-[#C3FF00]/50 bg-[#C3FF00]/5 rounded-xl p-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://${dbUser.username}.chainhost.online`}
                    target="_blank"
                    className="text-white font-semibold font-mono hover:text-[#C3FF00] transition"
                  >
                    {dbUser.username}.chainhost.online
                  </a>
                  <span className="text-xs px-2 py-0.5 bg-[#C3FF00]/20 text-[#C3FF00] rounded">
                    primary
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Your main site</p>
                <div className="flex items-center gap-2 mt-2">
                  {sites?.find(s => s.slug === dbUser.username)?.inscription_tx ? (
                    <>
                      <span className="text-xs px-2 py-1 rounded bg-green-900/50 text-green-400">
                        inscribed
                      </span>
                      <a
                        href={`https://basescan.org/tx/${sites.find(s => s.slug === dbUser.username)?.inscription_tx}`}
                        target="_blank"
                        className="text-xs text-gray-500 hover:text-[#C3FF00]"
                      >
                        View tx
                      </a>
                    </>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-gray-400">
                      not inscribed
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/builder"
                  className="px-4 py-2 bg-[#C3FF00] text-black rounded-lg text-sm font-medium hover:bg-[#d4ff4d] transition"
                >
                  Post
                </Link>
              </div>
            </div>

            {/* Additional sites for paid users */}
            {sites?.filter(s => s.slug !== dbUser.username).map((site) => (
              <div
                key={site.id}
                className="border border-zinc-800 rounded-xl p-6 flex items-center justify-between"
              >
                <div>
                  <a
                    href={`https://${site.slug}.chainhost.online`}
                    target="_blank"
                    className="text-white font-semibold font-mono hover:text-[#C3FF00] transition"
                  >
                    {site.slug}.chainhost.online
                  </a>
                  <p className="text-sm text-gray-500">{site.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        site.status === "live"
                          ? "bg-green-900/50 text-green-400"
                          : site.status === "inscribed"
                          ? "bg-blue-900/50 text-blue-400"
                          : "bg-zinc-800 text-gray-400"
                      }`}
                    >
                      {site.status}
                    </span>
                    {site.inscription_tx && (
                      <a
                        href={`https://basescan.org/tx/${site.inscription_tx}`}
                        target="_blank"
                        className="text-xs text-gray-500 hover:text-[#C3FF00]"
                      >
                        View tx
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/builder?edit=${site.id}`}
                    className="px-4 py-2 bg-[#C3FF00] text-black rounded-lg text-sm font-medium hover:bg-[#d4ff4d] transition"
                  >
                    Post
                  </Link>
                </div>
              </div>
            ))}

            {/* Add new site - PRO for free users, enabled for paid */}
            {dbUser.plan === "paid" ? (
              <Link
                href="/builder?new=true"
                className="block border border-dashed border-zinc-700 rounded-xl p-6 text-center hover:border-[#C3FF00] transition group"
              >
                <span className="text-gray-500 group-hover:text-[#C3FF00] transition">
                  + Add another site
                </span>
              </Link>
            ) : (
              <div className="border border-dashed border-zinc-700 rounded-xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-gray-400">Want more sites?</p>
                  <p className="text-sm text-gray-600">Upgrade to create unlimited sites</p>
                </div>
                <Link
                  href="/upgrade"
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition flex items-center gap-2"
                >
                  <span>PRO</span>
                  <span className="text-xs opacity-80">$5</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Domains List */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Your Domains</h2>
          {domains && domains.length > 0 ? (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  className="border border-zinc-800 rounded-xl p-6 flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-white font-semibold font-mono">
                      {domain.domain}.{domain.tld}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          domain.status === "active"
                            ? "bg-green-900/50 text-green-400"
                            : domain.status === "registered"
                            ? "bg-blue-900/50 text-blue-400"
                            : domain.status === "pending"
                            ? "bg-yellow-900/50 text-yellow-400"
                            : "bg-zinc-800 text-gray-400"
                        }`}
                      >
                        {domain.status}
                      </span>
                      {domain.expires_at && (
                        <span className="text-xs text-gray-500">
                          Expires: {new Date(domain.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://${domain.domain}.${domain.tld}`}
                    target="_blank"
                    className="px-4 py-2 border border-zinc-700 rounded-lg text-sm hover:border-[#C3FF00] transition"
                  >
                    Visit
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-xl p-12 text-center">
              <div className="text-4xl mb-4">&#x1F517;</div>
              <h3 className="text-white font-semibold mb-2">No domains yet</h3>
              <p className="text-gray-500 mb-6">
                Register a domain to connect to your site
              </p>
              <Link
                href="/builder?step=domain"
                className="inline-block px-6 py-3 border border-zinc-700 rounded-lg hover:border-[#C3FF00] transition"
              >
                Search Domains
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
