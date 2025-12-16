import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            <span className="text-white">CHAIN</span>
            <span className="text-[#C3FF00]">HOST</span>
          </Link>
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-sm hover:text-[#C3FF00] transition">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm hover:text-[#C3FF00] transition"
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

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
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition">
                  Get Started
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="px-8 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
              >
                Go to Dashboard
              </Link>
            </SignedIn>
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
                  Build your site
                </h3>
                <p className="text-sm">
                  Choose a template or paste your own HTML. Our editor shows you
                  exactly what will be inscribed.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#C3FF00] text-black font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">
                  Register a domain
                </h3>
                <p className="text-sm">
                  Search and register a .com, .xyz, or other TLD. We handle DNS
                  and SSL automatically.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#C3FF00] text-black font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">
                  Inscribe on Ethereum
                </h3>
                <p className="text-sm">
                  We encode your HTML as calldata and you sign the transaction.
                  Your site is now permanent.
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
                  A service worker fetches your content from the blockchain.
                  Visitors see your site instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Simple pricing</h2>
          <p className="text-gray-400 mb-12">
            Pay for what you use. No subscriptions required.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-8 border border-zinc-800 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">
                Domain Registration
              </h3>
              <div className="text-4xl font-bold text-white mb-2">
                $9.99<span className="text-lg text-gray-500">/year</span>
              </div>
              <p className="text-sm text-gray-500 mb-6">.xyz domains from</p>
              <ul className="text-sm text-left space-y-2">
                <li>- Domain registration</li>
                <li>- Automatic DNS setup</li>
                <li>- Free SSL certificate</li>
                <li>- Cloudflare CDN</li>
              </ul>
            </div>
            <div className="p-8 border border-zinc-800 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">
                Inscription
              </h3>
              <div className="text-4xl font-bold text-white mb-2">
                ~$0.30<span className="text-lg text-gray-500">/page</span>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Gas cost for 10KB page
              </p>
              <ul className="text-sm text-left space-y-2">
                <li>- Permanent storage</li>
                <li>- One-time payment</li>
                <li>- No recurring fees</li>
                <li>- Version history included</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Built on Ethereum. Powered by ethscriptions.
          </div>
          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-[#C3FF00]">
              Docs
            </a>
            <a href="#" className="hover:text-[#C3FF00]">
              GitHub
            </a>
            <a href="#" className="hover:text-[#C3FF00]">
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
