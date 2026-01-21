import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Chainhost Mail Security - End-to-End Encrypted Email',
  description: 'Complete security documentation for Chainhost Mail. RSA-2048 + AES-256-GCM encryption, wallet authentication, zero-knowledge architecture.',
}

export default function MailSecurityPage() {
  return (
    <div className="min-h-screen bg-black text-gray-200">
      <div className="max-w-4xl mx-auto px-5 py-10">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Chainhost Mail</h1>
          <p className="text-[#C3FF00] font-mono text-xl">yourname@chainhost.online</p>
          <p className="text-gray-500 mt-4">End-to-end encrypted email for your on-chain identity</p>
        </div>

        {/* What is it */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">What is Chainhost Mail?</h2>
          <p className="text-gray-400 mb-4">
            Every chainhost name comes with a free, encrypted email address. If you own{' '}
            <span className="text-[#C3FF00]">yourname</span> on Ethereum, you can receive and send
            emails from <span className="text-[#C3FF00]">yourname@chainhost.online</span>.
          </p>
          <p className="text-gray-400">
            Your wallet is your login. No passwords to remember, no accounts to create.
          </p>
        </section>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Features</h2>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">End-to-End Encryption</h3>
              <p className="text-gray-500 text-sm">
                Email bodies are encrypted with your personal key. Even server admins cannot read your messages.
              </p>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Wallet Authentication</h3>
              <p className="text-gray-500 text-sm">
                Sign in with your Ethereum wallet using EIP-191 signatures. No passwords stored anywhere.
              </p>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Plus Addressing</h3>
              <p className="text-gray-500 text-sm">
                Use name+shopping@chainhost.online to filter and organize incoming mail automatically.
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

        {/* Security Architecture */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Security Architecture</h2>
          <p className="text-gray-400 mb-6">
            Chainhost Mail implements a <strong className="text-white">zero-knowledge architecture</strong> where
            the server cannot decrypt your email content even with full database access.
          </p>

          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6 font-mono text-xs text-gray-500 mb-6 overflow-x-auto">
            <pre className="whitespace-pre">{`┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐     ┌──────────────────┐     ┌────────────┐  │
│   │ Email        │     │ Subdomain Router │     │ D1         │  │
│   │ Routing      │────▶│ Worker           │────▶│ Database   │  │
│   │ (MX)         │     │                  │     │ (metadata) │  │
│   └──────────────┘     └──────────────────┘     └────────────┘  │
│          │                      │                      │         │
│          ▼                      │                      │         │
│   ┌──────────────┐              │               ┌────────────┐  │
│   │ Email        │              │               │ R2         │  │
│   │ Receiver     │──────────────┼──────────────▶│ Storage    │  │
│   │ Worker       │              │               │ (encrypted)│  │
│   └──────────────┘              │               └────────────┘  │
│                                 │                               │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
                                  ▼
                          ┌──────────────┐
                          │ Resend API   │
                          │ (outbound)   │
                          └──────────────┘`}</pre>
          </div>
        </section>

        {/* Encryption Flow */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">How Encryption Works</h2>
          <p className="text-gray-400 mb-6">
            Chainhost Mail uses <strong className="text-white">hybrid RSA-AES encryption</strong> - the same
            approach used by PGP, S/MIME, and other industry-standard encryption systems.
          </p>

          <div className="space-y-6">
            {/* Phase 1 */}
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Phase 1: First Login (Key Setup)</h3>
              <div className="font-mono text-xs text-gray-500 overflow-x-auto">
                <pre className="whitespace-pre">{`┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ Wallet     │───▶│ Sign       │───▶│ SHA-256    │───▶│ AES Key    │
│ Connect    │    │ Message    │    │ Hash       │    │ (derived)  │
└────────────┘    └────────────┘    └────────────┘    └─────┬──────┘
                                                            │
┌────────────┐    ┌────────────┐    ┌────────────┐          │
│ Store      │◀───│ Encrypt    │◀───│ Generate   │◀─────────┘
│ in R2      │    │ Private Key│    │ RSA Keypair│
└────────────┘    └────────────┘    └────────────┘`}</pre>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                Your wallet signature is hashed to create a unique AES key. This key encrypts your RSA private key
                before storage. The AES key is <strong className="text-white">never stored</strong> - it&apos;s derived
                fresh each login.
              </p>
            </div>

            {/* Phase 2 */}
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Phase 2: Receiving Email</h3>
              <div className="font-mono text-xs text-gray-500 overflow-x-auto">
                <pre className="whitespace-pre">{`┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ Email      │───▶│ Generate   │───▶│ Encrypt    │───▶│ Encrypt    │
│ Body       │    │ Random AES │    │ with AES   │    │ AES Key    │
└────────────┘    │ Key        │    └────────────┘    │ with RSA   │
                  └────────────┘                      └─────┬──────┘
                                                            │
                                          ┌────────────┐    │
                                          │ Store in   │◀───┘
                                          │ R2         │
                                          └────────────┘`}</pre>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                Each email is encrypted with a <strong className="text-white">fresh random AES key</strong>.
                That key is then encrypted with your RSA public key. Only your private key can decrypt it.
              </p>
            </div>

            {/* Phase 3 */}
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Phase 3: Reading Email</h3>
              <div className="font-mono text-xs text-gray-500 overflow-x-auto">
                <pre className="whitespace-pre">{`┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ Wallet     │───▶│ Sign Same  │───▶│ Derive     │───▶│ Decrypt    │
│ Connect    │    │ Message    │    │ AES Key    │    │ RSA Private│
└────────────┘    └────────────┘    └────────────┘    └─────┬──────┘
                                                            │
┌────────────┐    ┌────────────┐    ┌────────────┐          │
│ Decrypted  │◀───│ Decrypt    │◀───│ Decrypt    │◀─────────┘
│ Email      │    │ Body       │    │ AES Key    │
└────────────┘    └────────────┘    └────────────┘`}</pre>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                Decryption happens <strong className="text-white">entirely in your browser</strong>. The server
                sends encrypted data, your wallet derives the decryption key, and plaintext never touches our servers.
              </p>
            </div>
          </div>
        </section>

        {/* Key Storage */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Key Storage & Management</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222]">
                  <th className="text-left py-3 text-gray-400 font-medium">Key</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Location</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Admin Visible?</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Admin Usable?</th>
                </tr>
              </thead>
              <tbody className="text-gray-500">
                <tr className="border-b border-[#222]">
                  <td className="py-3">RSA Public Key</td>
                  <td className="py-3 font-mono text-xs">D1 Database</td>
                  <td className="py-3 text-[#C3FF00]">Yes</td>
                  <td className="py-3 text-gray-400">Only encrypts</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">RSA Private Key (encrypted)</td>
                  <td className="py-3 font-mono text-xs">R2 Storage</td>
                  <td className="py-3 text-[#C3FF00]">Yes</td>
                  <td className="py-3 text-red-400">No - needs wallet</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">AES Decryption Key</td>
                  <td className="py-3 font-mono text-xs">Nowhere (derived)</td>
                  <td className="py-3 text-red-400">No</td>
                  <td className="py-3 text-red-400">Impossible</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Decrypted Private Key</td>
                  <td className="py-3 font-mono text-xs">Browser sessionStorage</td>
                  <td className="py-3 text-red-400">No</td>
                  <td className="py-3 text-red-400">Client-only</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">What an admin with full access sees:</h3>
            <div className="font-mono text-xs text-gray-500">
              <p className="mb-2"><span className="text-gray-400">D1:</span> encryption_public_key = {`{"`}kty{`"`}:{`"`}RSA{`"`},{`"`}n{`"`}:{`"`}xK7d2...{`"`}...{`}`}</p>
              <p><span className="text-gray-400">R2:</span> private_key.enc = [encrypted binary blob]</p>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              The public key can only encrypt. The private key is useless without your wallet signature to derive the
              AES decryption key.
            </p>
          </div>
        </section>

        {/* What's Encrypted */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">What&apos;s Protected</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-[#C3FF00] font-semibold mb-4">Encrypted (Protected)</h3>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li className="flex items-center gap-2"><span className="text-[#C3FF00]">+</span> Email body (HTML/text)</li>
                <li className="flex items-center gap-2"><span className="text-[#C3FF00]">+</span> Attachments</li>
                <li className="flex items-center gap-2"><span className="text-[#C3FF00]">+</span> Raw email (.eml)</li>
                <li className="flex items-center gap-2"><span className="text-[#C3FF00]">+</span> Your private key</li>
              </ul>
            </div>
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-gray-400 font-semibold mb-4">Not Encrypted (Metadata)</h3>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li className="flex items-center gap-2"><span className="text-gray-600">-</span> Sender address & name</li>
                <li className="flex items-center gap-2"><span className="text-gray-600">-</span> Subject line</li>
                <li className="flex items-center gap-2"><span className="text-gray-600">-</span> Timestamps</li>
                <li className="flex items-center gap-2"><span className="text-gray-600">-</span> Snippet (preview)</li>
              </ul>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            Metadata remains searchable for functionality. Email content is fully encrypted.
          </p>
        </section>

        {/* Threat Analysis */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Threat Analysis</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222]">
                  <th className="text-left py-3 text-gray-400 font-medium">Threat</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Protected?</th>
                  <th className="text-left py-3 text-gray-400 font-medium">How</th>
                </tr>
              </thead>
              <tbody className="text-gray-500">
                <tr className="border-b border-[#222]">
                  <td className="py-3">Admin reads emails</td>
                  <td className="py-3 text-[#C3FF00]">Yes</td>
                  <td className="py-3">Bodies encrypted with your RSA key</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Database breach</td>
                  <td className="py-3 text-[#C3FF00]">Yes</td>
                  <td className="py-3">Only encrypted blobs, no decryption keys</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">R2 storage breach</td>
                  <td className="py-3 text-[#C3FF00]">Yes</td>
                  <td className="py-3">Private key encrypted with wallet-derived AES</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Man-in-the-middle</td>
                  <td className="py-3 text-[#C3FF00]">Yes</td>
                  <td className="py-3">HTTPS + decryption requires wallet signature</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Stolen device (logged in)</td>
                  <td className="py-3 text-yellow-500">Partial</td>
                  <td className="py-3">sessionStorage cleared on browser close</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Compromised wallet</td>
                  <td className="py-3 text-red-400">No</td>
                  <td className="py-3">Wallet = identity, full compromise</td>
                </tr>
                <tr className="border-b border-[#222]">
                  <td className="py-3">Lost wallet</td>
                  <td className="py-3 text-red-400">No</td>
                  <td className="py-3">No recovery by design</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Ownership Transfers */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Ownership Transfers</h2>
          <p className="text-gray-400 mb-4">
            When a chainhost name is transferred to a new wallet:
          </p>

          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6 font-mono text-sm text-gray-500 mb-6">
            <p>1. User A owns {`"`}bob{`"`} → creates keypair A</p>
            <p>2. User A transfers {`"`}bob{`"`} to User B</p>
            <p>3. User B logs in → system detects owner change</p>
            <p>4. Old encryption keys are <span className="text-red-400">deleted</span></p>
            <p>5. User B creates fresh keypair B</p>
            <p>6. <span className="text-gray-400">Old emails:</span> encrypted with key A (unreadable)</p>
            <p>7. <span className="text-[#C3FF00]">New emails:</span> encrypted with key B</p>
          </div>

          <p className="text-gray-500 text-sm">
            Old emails remain in the inbox (metadata visible) but the body is permanently sealed. This is intentional -
            it prevents key recovery attacks and ensures previous owners cannot access new messages.
          </p>
        </section>

        {/* Trust Model */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Trust Model</h2>

          <ul className="space-y-3">
            {[
              { title: 'Server cannot read email content', desc: 'Bodies encrypted with your RSA public key only you can decrypt' },
              { title: 'Server cannot decrypt your private key', desc: 'Encrypted with AES key derived from wallet signature' },
              { title: 'Decryption is client-side only', desc: 'Private key never leaves your browser unencrypted' },
              { title: 'Wallet signature = access', desc: 'No passwords, no recovery - your wallet is your identity' },
              { title: 'No backdoors by design', desc: 'Even we cannot access your encrypted content' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 py-3 border-b border-[#222] last:border-0">
                <span className="text-[#C3FF00] font-bold shrink-0">+</span>
                <div>
                  <span className="text-white">{item.title}</span>
                  <p className="text-gray-500 text-sm mt-1">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Technical Specifications */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Technical Specifications</h2>

          <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6 font-mono text-sm text-gray-500 space-y-4">
            <div>
              <p className="text-gray-400 mb-1">Asymmetric Encryption</p>
              <p>RSA-OAEP, 2048-bit keys, SHA-256 hash</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Symmetric Encryption</p>
              <p>AES-256-GCM, 12-byte IV, authenticated</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Key Derivation</p>
              <p>SHA-256 hash of EIP-191 wallet signature</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Authentication</p>
              <p>EIP-191 message signatures, nonce-based challenges</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Session</p>
              <p>7-day tokens, HMAC-verified, HttpOnly cookies</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Infrastructure</p>
              <p>Cloudflare Workers, D1 (metadata), R2 (encrypted content)</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Crypto Library</p>
              <p>Web Crypto API (native browser, audited)</p>
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Getting Started</h2>
          <p className="text-gray-400 mb-4">To use Chainhost Mail:</p>
          <ol className="list-decimal list-inside text-gray-500 space-y-2 ml-2">
            <li>Own a chainhost name (inscribe <code className="bg-[#111] px-2 py-0.5 rounded">data:,yourname</code> on Ethereum)</li>
            <li>Connect the wallet that owns the name</li>
            <li>Sign the authentication challenge</li>
            <li>Sign the encryption setup message (generates your keys)</li>
            <li>Start sending and receiving encrypted emails</li>
          </ol>
        </section>

        {/* CTA */}
        <div className="text-center bg-[#111] rounded-2xl p-10">
          <h3 className="text-xl font-semibold mb-2">Ready to get your encrypted email?</h3>
          <p className="text-gray-500 mb-6">Claim a chainhost name or access your existing inbox</p>
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
            Questions about security? <a href="https://github.com/jefdiesel/chainhost" className="text-gray-400 hover:text-[#C3FF00] transition-colors">View source on GitHub</a>
          </p>
        </div>
      </div>
    </div>
  )
}
