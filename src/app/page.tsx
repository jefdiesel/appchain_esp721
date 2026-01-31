import Link from "next/link";
import SiteFeed from "@/components/SiteFeed";
import Nav from "@/components/Nav";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Nav />

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Host websites
            <br />
            <span className="text-[#C3FF00]">on Ethereum</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto">
            Your site lives forever in blockchain calldata. No servers, no
            renewals, no takedowns. Just permanent, censorship-resistant
            hosting.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
            >
              Claim Your Name
            </Link>
            <Link
              href="#how"
              className="px-8 py-3 border border-zinc-700 rounded-lg hover:border-[#C3FF00] transition"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 border border-zinc-800 rounded-xl">
              <div className="text-3xl mb-4">&#x26D3;</div>
              <h3 className="text-white text-lg font-semibold mb-2">
                Permanent Storage
              </h3>
              <p className="text-sm">
                Content inscribed as Ethereum calldata exists forever. As long
                as Ethereum runs, your site is live.
              </p>
            </div>
            <div className="p-6 border border-zinc-800 rounded-xl">
              <div className="text-3xl mb-4">&#x1F512;</div>
              <h3 className="text-white text-lg font-semibold mb-2">
                Censorship Resistant
              </h3>
              <p className="text-sm">
                No server to take down, no host to pressure. Your content is
                distributed across thousands of nodes.
              </p>
            </div>
            <div className="p-6 border border-zinc-800 rounded-xl">
              <div className="text-3xl mb-4">&#x1F4B0;</div>
              <h3 className="text-white text-lg font-semibold mb-2">
                One-Time Cost
              </h3>
              <p className="text-sm">
                Pay once for inscription gas. No monthly hosting fees, no
                surprise bills, no renewals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Marketplace CTA */}
      <section className="py-20 px-6 border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Name Marketplace
          </h2>
          <p className="text-gray-400 mb-8">
            Buy and sell ethscription names with trustless escrow.
            No middlemen, instant transfers.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/marketplace"
              className="px-8 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
            >
              Browse Names
            </Link>
            <Link
              href="/marketplace/sell"
              className="px-8 py-3 border border-zinc-700 rounded-lg hover:border-[#C3FF00] transition"
            >
              Sell Your Names
            </Link>
          </div>
        </div>
      </section>

      {/* Live Sites Feed */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            Live Sites
          </h2>
          <p className="text-gray-500 text-center mb-8">
            Recently deployed on chainhost
          </p>
          <SiteFeed />
          <div className="text-center mt-6">
            <Link href="/feed" className="text-sm text-gray-500 hover:text-[#C3FF00]">
              View all sites →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            How it works
          </h2>
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#C3FF00] text-black font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">
                  Claim your name
                </h3>
                <p className="text-sm">
                  Register a name on Ethscriptions. First come, first served, forever yours.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#C3FF00] text-black font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">
                  Upload your HTML
                </h3>
                <p className="text-sm">
                  Upload your HTML files. Choose Ethereum for permanence or Base for lower costs.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#C3FF00] text-black font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">
                  Inscribe your manifest
                </h3>
                <p className="text-sm">
                  Create a manifest linking your routes to your content. One tx to rule them all.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#C3FF00] text-black font-bold flex items-center justify-center shrink-0">
                4
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Go live</h3>
                <p className="text-sm">
                  Your site is now live at yourname.chainhost.online. Forever.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Built on Ethereum. Powered by Ethscriptions.
          </div>
          <div className="flex gap-6 text-sm">
            <a href="https://github.com/jefdiesel/chainhost" className="hover:text-[#C3FF00]">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
