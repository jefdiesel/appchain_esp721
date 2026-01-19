import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Chainhost Mail - End-to-End Encrypted Email',
  description: 'Free encrypted email for every chainhost name. Wallet authentication, RSA-AES encryption, plus addressing, and API access.',
}

export default function MailAboutPage() {
  return (
    <div className="min-h-screen bg-black text-gray-200">
      <div className="max-w-3xl mx-auto px-5 py-10">
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
              <div className="text-2xl mb-3">🔐</div>
              <h3 className="text-white font-semibold mb-2">End-to-End Encryption</h3>
              <p className="text-gray-500 text-sm">
                Email bodies are encrypted with your personal key. Even server admins cannot read your messages.
              </p>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <div className="text-2xl mb-3">👛</div>
              <h3 className="text-white font-semibold mb-2">Wallet Authentication</h3>
              <p className="text-gray-500 text-sm">
                Sign in with your Ethereum wallet. Your private keys never leave your device.
              </p>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <div className="text-2xl mb-3">📧</div>
              <h3 className="text-white font-semibold mb-2">Plus Addressing</h3>
              <p className="text-gray-500 text-sm">
                Use name+shopping@chainhost.online to filter and organize incoming mail automatically.
              </p>
            </div>
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <div className="text-2xl mb-3">🔗</div>
              <h3 className="text-white font-semibold mb-2">API Access</h3>
              <p className="text-gray-500 text-sm">
                Generate API keys to send emails programmatically from your applications.
              </p>
            </div>
          </div>
        </section>

        {/* How Encryption Works */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">How Encryption Works</h2>
          <p className="text-gray-400 mb-4">
            Chainhost Mail uses <strong className="text-white">hybrid RSA-AES encryption</strong> to protect your email content:
          </p>

          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6 font-mono text-sm text-gray-500 text-center mb-6">
            <p className="text-gray-600 mb-2">1. First Login</p>
            <p>Wallet Signature <span className="text-[#C3FF00]">→</span> Derive AES Key <span className="text-[#C3FF00]">→</span> Generate RSA Keypair <span className="text-[#C3FF00]">→</span> Encrypt Private Key</p>
            <br />
            <p className="text-gray-600 mb-2">2. Incoming Email</p>
            <p>Email Body <span className="text-[#C3FF00]">→</span> Generate AES Key <span className="text-[#C3FF00]">→</span> Encrypt with AES <span className="text-[#C3FF00]">→</span> Encrypt AES Key with RSA</p>
            <br />
            <p className="text-gray-600 mb-2">3. Reading Email</p>
            <p>Wallet Signature <span className="text-[#C3FF00]">→</span> Decrypt RSA Private Key <span className="text-[#C3FF00]">→</span> Decrypt AES Key <span className="text-[#C3FF00]">→</span> Decrypt Email</p>
          </div>

          <ul className="space-y-3">
            {[
              'Your private encryption key is encrypted with a key derived from your wallet signature',
              'The server stores only your encrypted private key and public key',
              'Email bodies are encrypted before storage using RSA-OAEP + AES-256-GCM',
              'Decryption happens entirely in your browser - the server never sees your decrypted content',
              'Email metadata (sender, subject, date) remains searchable',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 py-3 border-b border-[#222] last:border-0">
                <span className="text-[#C3FF00] font-bold">✓</span>
                <span className="text-gray-400">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Getting Started */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Getting Started</h2>
          <p className="text-gray-400 mb-4">To use Chainhost Mail, you need to:</p>
          <ol className="list-decimal list-inside text-gray-500 space-y-2 ml-2">
            <li>Own a chainhost name (inscribe <code className="bg-[#111] px-2 py-0.5 rounded">data:,yourname</code> on Ethereum)</li>
            <li>Connect the wallet that owns the name</li>
            <li>Sign the authentication and encryption setup messages</li>
            <li>Start sending and receiving encrypted emails!</li>
          </ol>
        </section>

        {/* Technical Details */}
        <section className="mb-12">
          <h2 className="text-[#C3FF00] text-xs uppercase tracking-widest mb-4">Technical Details</h2>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4 font-mono text-sm text-gray-500">
            <p>Encryption: RSA-OAEP (2048-bit) + AES-256-GCM</p>
            <p>Key Derivation: SHA-256 of wallet signature</p>
            <p>Storage: D1 (metadata) + R2 (encrypted bodies)</p>
            <p>Authentication: EIP-191 message signatures</p>
            <p>Routing: Cloudflare Email Routing</p>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center bg-[#111] rounded-2xl p-10">
          <h3 className="text-xl font-semibold mb-2">Ready to get your email?</h3>
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
      </div>
    </div>
  )
}
