import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // TODO: Fetch user's sites and domains from Supabase

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
            <Link href="/builder" className="hover:text-[#C3FF00] transition">
              New Site
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-gray-500">
              Welcome back, {user.firstName || user.emailAddresses[0]?.emailAddress}
            </p>
          </div>
          <Link
            href="/builder"
            className="px-6 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
          >
            + New Site
          </Link>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 border border-zinc-800 rounded-xl">
            <div className="text-3xl font-bold text-white mb-1">0</div>
            <div className="text-sm text-gray-500">Active Sites</div>
          </div>
          <div className="p-6 border border-zinc-800 rounded-xl">
            <div className="text-3xl font-bold text-white mb-1">0</div>
            <div className="text-sm text-gray-500">Domains</div>
          </div>
          <div className="p-6 border border-zinc-800 rounded-xl">
            <div className="text-3xl font-bold text-white mb-1">0</div>
            <div className="text-sm text-gray-500">Inscriptions</div>
          </div>
        </div>

        {/* Sites List */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-4">Your Sites</h2>
          <div className="border border-zinc-800 rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">&#x1F310;</div>
            <h3 className="text-white font-semibold mb-2">No sites yet</h3>
            <p className="text-gray-500 mb-6">
              Create your first site and inscribe it on Ethereum
            </p>
            <Link
              href="/builder"
              className="inline-block px-6 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
            >
              Create Site
            </Link>
          </div>
        </div>

        {/* Domains List */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Your Domains</h2>
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
        </div>
      </main>
    </div>
  );
}
