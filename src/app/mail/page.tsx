import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Chainhost Mail - Email for Your On-Chain Identity',
  description: 'Email for chainhost names. Understand the security model - what we protect and what we cannot.',
}

export default function MailSecurityPage() {
  return (
    <div className="min-h-screen bg-black text-gray-200">
      <div className="max-w-4xl mx-auto px-5 py-10">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Chainhost Mail</h1>
          <p className="text-[#C3FF00] font-mono text-xl">yourname@chainhost.online</p>
          <p className="text-gray-500 mt-4">Email for your on-chain identity</p>
        </div>

        {/* What is it */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">What is Chainhost Mail?</h2>
          <p className="text-gray-400 mb-4">
            Every chainhost name comes with a free email address. If you own{' '}
            <span className="text-[#C3FF00]">yourname</span> on Ethereum, you can receive and send
            emails from <span className="text-[#C3FF00]">yourname@chainhost.online</span>.
          </p>
          <p className="text-gray-400">
            Your wallet is your login. No passwords to remember, no accounts to create.
          </p>
        </section>

        {/* The Hard Truth */}
        <section className="mb-12">
          <h2 className="text-red-400 text-xs uppercase tracking-widest mb-4">The Hard Truth About Email</h2>
          <div className="bg-[#1a0a0a] border border-red-900/50 rounded-xl p-6 mb-6">
            <p className="text-gray-300 mb-4">
              <strong className="text-white">Email is fundamentally insecure.</strong> It was designed in 1982
              when the internet was a few dozen trusted universities. Security was not a consideration.
            </p>
            <p className="text-gray-400">
              No matter what any email provider tells you, standard email cannot be truly end-to-end encrypted.
              Here&apos;s why:
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3">Incoming Email</h3>
              <div className="font-mono text-xs text-gray-500 mb-3">
                Sender → Their Server → Internet → Our Server → You
              </div>
              <p className="text-gray-500 text-sm">
                When someone emails you, it travels through the internet as <span className="text-red-400">plaintext</span>.
                By the time it reaches us, we&apos;ve already seen it. We encrypt it for storage, but we saw it first.
              </p>
            </div>

            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3">Outgoing Email</h3>
              <div className="font-mono text-xs text-gray-500 mb-3">
                You → Our Server → Resend → Recipient&apos;s Server → Recipient
              </div>
              <p className="text-gray-500 text-sm">
                When you send an email, we pass it to Resend (our email delivery service) in <span className="text-red-400">plaintext</span>.
                They need to read it to deliver it. The recipient&apos;s server also sees it.
              </p>
            </div>
          </div>
        </section>

        {/* Who Can Read Your Email */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Who Can Read Your Email</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222]">
                  <th className="text-left py-3 text-gray-400 font-medium">Party</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Incoming</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Outgoing</th>
                </tr>
              </thead>
              <tbody className="text-gray-500">
                <tr className="border-b border-[#222]">
                  <td className="py-3">Sender&apos;s email provider</td>
                  <td className="py-3 text-red-400">Yes</td>
                  <td className="py-3 text-gray-600">N/A</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Our servers (momentarily)</td>
                  <td className="py-3 text-red-400">Yes</td>
                  <td className="py-3 text-red-400">Yes</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Resend (delivery service)</td>
                  <td className="py-3 text-gray-600">N/A</td>
                  <td className="py-3 text-red-400">Yes</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Recipient&apos;s email provider</td>
                  <td className="py-3 text-gray-600">N/A</td>
                  <td className="py-3 text-red-400">Yes</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Our storage (R2)</td>
                  <td className="py-3 text-[#C3FF00]">Encrypted</td>
                  <td className="py-3 text-[#C3FF00]">Encrypted</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Law enforcement (with warrant)</td>
                  <td className="py-3 text-red-400">Yes*</td>
                  <td className="py-3 text-red-400">Yes*</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-600 text-xs mt-3">
            * Via Resend, Cloudflare, or any party in the chain. We cannot decrypt stored content, but others retain copies.
          </p>
        </section>

        {/* What We Actually Protect */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">What We Actually Protect</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-[#C3FF00] font-semibold mb-4">Protected (Storage)</h3>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li className="flex items-center gap-2"><span className="text-[#C3FF00]">+</span> Email bodies at rest (encrypted in R2)</li>
                <li className="flex items-center gap-2"><span className="text-[#C3FF00]">+</span> Attachments at rest</li>
                <li className="flex items-center gap-2"><span className="text-[#C3FF00]">+</span> Your private key (encrypted with wallet)</li>
                <li className="flex items-center gap-2"><span className="text-[#C3FF00]">+</span> Casual browsing by admin</li>
              </ul>
              <p className="text-gray-600 text-xs mt-4">
                If someone breaches our R2 storage, they get encrypted blobs they cannot decrypt without your wallet.
              </p>
            </div>
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-red-400 font-semibold mb-4">Not Protected</h3>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li className="flex items-center gap-2"><span className="text-red-400">-</span> Email in transit</li>
                <li className="flex items-center gap-2"><span className="text-red-400">-</span> Content visible to Resend</li>
                <li className="flex items-center gap-2"><span className="text-red-400">-</span> Metadata (sender, recipient, subject)</li>
                <li className="flex items-center gap-2"><span className="text-red-400">-</span> A malicious admin who modifies code</li>
              </ul>
              <p className="text-gray-600 text-xs mt-4">
                We could theoretically log plaintext before encryption. You&apos;re trusting that we don&apos;t.
              </p>
            </div>
          </div>
        </section>

        {/* Metadata */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Metadata Is Not Encrypted</h2>
          <p className="text-gray-400 mb-4">
            The following is stored in plaintext for search and functionality:
          </p>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6 font-mono text-sm">
            <p className="text-gray-500"><span className="text-gray-400">from:</span> alice@gmail.com</p>
            <p className="text-gray-500"><span className="text-gray-400">to:</span> yourname@chainhost.online</p>
            <p className="text-gray-500"><span className="text-gray-400">subject:</span> Meeting tomorrow</p>
            <p className="text-gray-500"><span className="text-gray-400">date:</span> 2025-01-26 14:32:00</p>
            <p className="text-gray-500"><span className="text-gray-400">snippet:</span> Hey, just wanted to confirm our...</p>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            Metadata often reveals as much as content. We know who emailed you, when, and what about.
          </p>
        </section>

        {/* The Admin Problem */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">The Admin Problem</h2>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
            <p className="text-gray-400 mb-4">
              As the system administrator, I have access to:
            </p>
            <ul className="space-y-2 text-gray-500 text-sm mb-4">
              <li>• Cloudflare account (Workers, D1, R2)</li>
              <li>• Resend dashboard (all sent emails in plaintext)</li>
              <li>• Server logs</li>
              <li>• The ability to deploy modified code</li>
            </ul>
            <p className="text-gray-400">
              I encrypt your emails at rest and don&apos;t read them. But you&apos;re <strong className="text-white">trusting</strong> that.
              There&apos;s no cryptographic guarantee. This is the same trust model as Gmail, ProtonMail, or any hosted email.
            </p>
          </div>
        </section>

        {/* Comparison */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Compared to Other Providers</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222]">
                  <th className="text-left py-3 text-gray-400 font-medium">Provider</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Storage</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Transit</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Admin Access</th>
                </tr>
              </thead>
              <tbody className="text-gray-500">
                <tr className="border-b border-[#222]">
                  <td className="py-3">Gmail</td>
                  <td className="py-3 text-yellow-500">Encrypted (Google&apos;s keys)</td>
                  <td className="py-3 text-red-400">Plaintext</td>
                  <td className="py-3 text-red-400">Full access</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">ProtonMail</td>
                  <td className="py-3 text-[#C3FF00]">Encrypted (your keys)*</td>
                  <td className="py-3 text-red-400">Plaintext to non-Proton</td>
                  <td className="py-3 text-yellow-500">Metadata only*</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Chainhost Mail</td>
                  <td className="py-3 text-[#C3FF00]">Encrypted (your keys)</td>
                  <td className="py-3 text-red-400">Plaintext</td>
                  <td className="py-3 text-yellow-500">Metadata + trust</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-600 text-xs mt-3">
            * ProtonMail-to-ProtonMail is better. External email has the same limitations as everyone else.
          </p>
        </section>

        {/* What We Do Right */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">What We Do Right</h2>
          <div className="space-y-4">
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Wallet Authentication</h3>
              <p className="text-gray-500 text-sm">
                No passwords to leak. Your Ethereum wallet is your identity. Sign a message to prove ownership.
              </p>
            </div>
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Encrypted Storage</h3>
              <p className="text-gray-500 text-sm">
                Email bodies are encrypted with RSA-2048 + AES-256-GCM. Decryption requires your wallet signature.
                A storage breach yields useless encrypted blobs.
              </p>
            </div>
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">No Password Database</h3>
              <p className="text-gray-500 text-sm">
                We don&apos;t store passwords or recovery keys. Nothing to leak, nothing to subpoena.
              </p>
            </div>
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Ownership Transfers</h3>
              <p className="text-gray-500 text-sm">
                When a chainhost name transfers, old encryption keys are deleted. New owner gets fresh keys.
                Old emails remain sealed forever.
              </p>
            </div>
          </div>
        </section>

        {/* If You Need Real Privacy */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">If You Need Real Privacy</h2>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
            <p className="text-gray-400 mb-4">
              Email is not the answer. For truly private communication, use:
            </p>
            <ul className="space-y-3 text-gray-500">
              <li className="flex items-start gap-3">
                <span className="text-[#C3FF00] font-bold">→</span>
                <div>
                  <span className="text-white">Signal</span>
                  <p className="text-sm">Industry-standard E2E encryption, no metadata leakage</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#C3FF00] font-bold">→</span>
                <div>
                  <span className="text-white">Matrix</span>
                  <p className="text-sm">Decentralized, E2E encrypted, self-hostable</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#C3FF00] font-bold">→</span>
                <div>
                  <span className="text-white">PGP Email</span>
                  <p className="text-sm">If recipient also uses PGP (rare, but actually secure)</p>
                </div>
              </li>
            </ul>
            <p className="text-gray-500 text-sm mt-4">
              Use Chainhost Mail for convenience and identity. Use secure messengers for sensitive communication.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Features</h2>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Wallet Login</h3>
              <p className="text-gray-500 text-sm">
                Sign in with Ethereum. No passwords, no accounts. Your wallet owns your name, your wallet accesses your mail.
              </p>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Plus Addressing</h3>
              <p className="text-gray-500 text-sm">
                Use name+shopping@chainhost.online to filter and organize incoming mail automatically.
              </p>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Encrypted Storage</h3>
              <p className="text-gray-500 text-sm">
                Email bodies encrypted at rest with your personal RSA key. Storage breaches yield nothing.
              </p>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl p-6 relative">
              <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider bg-[#222] text-gray-400 px-2 py-1 rounded">Coming Soon</div>
              <h3 className="text-white font-semibold mb-2">API Access</h3>
              <p className="text-gray-500 text-sm">
                Generate API keys to send emails programmatically from your applications.
              </p>
            </div>
          </div>
        </section>

        {/* Technical Specs */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Technical Specifications</h2>

          <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6 font-mono text-sm text-gray-500 space-y-4">
            <div>
              <p className="text-gray-400 mb-1">Storage Encryption</p>
              <p>RSA-OAEP (2048-bit) + AES-256-GCM (hybrid)</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Key Derivation</p>
              <p>SHA-256 hash of EIP-191 wallet signature</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Authentication</p>
              <p>EIP-191 signatures, nonce-based challenges, 7-day sessions</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Infrastructure</p>
              <p>Cloudflare Workers, D1 (metadata), R2 (encrypted bodies)</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Outbound Delivery</p>
              <p>Resend API (third-party, sees plaintext)</p>
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Getting Started</h2>
          <p className="text-gray-400 mb-4">To use Chainhost Mail:</p>
          <ol className="list-decimal list-inside text-gray-500 space-y-2 ml-2">
            <li>Own a chainhost name (inscribe <code className="bg-[#111] px-2 py-0.5 rounded">data:,yourname</code> on Ethereum)</li>
            <li>Go to <code className="bg-[#111] px-2 py-0.5 rounded">yourname.chainhost.online/mail</code></li>
            <li>Connect your wallet and sign the authentication challenge</li>
            <li>Sign the encryption setup message (generates your keys)</li>
            <li>Start sending and receiving email</li>
          </ol>
        </section>

        {/* CTA */}
        <div className="text-center bg-[#111] rounded-2xl p-10">
          <h3 className="text-xl font-semibold mb-2">Get your chainhost email</h3>
          <p className="text-gray-500 mb-6">Convenient email tied to your on-chain identity</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="/register"
              className="inline-block px-7 py-3.5 bg-[#C3FF00] text-black rounded-lg font-semibold hover:bg-[#d4ff4d] transition-colors"
            >
              Claim a Name
            </a>
            <a
              href="/"
              className="inline-block px-7 py-3.5 border border-[#333] text-gray-200 rounded-lg font-semibold hover:border-[#C3FF00] transition-colors"
            >
              Learn About Chainhost
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-[#222]">
          <p className="text-gray-600 text-sm">
            Questions? <a href="https://github.com/jefdiesel/chainhost" className="text-gray-400 hover:text-[#C3FF00] transition-colors">View source on GitHub</a>
          </p>
        </div>
      </div>
    </div>
  )
}
