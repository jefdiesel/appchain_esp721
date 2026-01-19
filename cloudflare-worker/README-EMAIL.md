# Chainhost Mail

End-to-end encrypted email for ethscription names. Every chainhost name gets a free email address at `name@chainhost.online`.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐     ┌──────────────────┐     ┌────────────┐  │
│   │ Email        │     │ Subdomain Router │     │ D1         │  │
│   │ Routing      │────▶│ Worker           │────▶│ Database   │  │
│   │ (MX)         │     │                  │     │            │  │
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
                          └──────────────┘
```

## Components

### 1. Subdomain Router (`subdomain-router.js`)
- Routes `*.chainhost.online` requests
- Handles `/mail/*` routes via `mail-routes.js`
- Wallet-based authentication (EIP-191 signatures)

### 2. Mail Routes (`mail-routes.js`)
- Inbox, sent, compose UI
- Authentication (challenge/verify flow)
- Encryption key setup and retrieval
- Email sending via Resend API

### 3. Email Receiver (`email-receiver.js`)
- Handles inbound emails via Cloudflare Email Routing
- Parses emails with `postal-mime`
- Encrypts bodies with user's public key before storage
- Supports plus addressing (`name+tag@chainhost.online`)

### 4. Database Schema (`sql/email-schema.sql`)
- `email_addresses` - Chainhost name to email mapping
- `emails` - Email metadata (encrypted bodies in R2)
- `email_threads` - Conversation grouping
- `email_contacts` - Auto-collected contacts
- `email_api_keys` - API key management (coming soon)

## Security Model

### Encryption Flow

```
First Login:
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ Wallet     │───▶│ Sign       │───▶│ SHA-256    │───▶│ AES Key    │
│ Connect    │    │ Message    │    │ Hash       │    │            │
└────────────┘    └────────────┘    └────────────┘    └─────┬──────┘
                                                            │
┌────────────┐    ┌────────────┐    ┌────────────┐          │
│ Store      │◀───│ Encrypt    │◀───│ Generate   │◀─────────┘
│ in R2      │    │ Private Key│    │ RSA Keypair│
└────────────┘    └────────────┘    └────────────┘
      │
      ▼
┌────────────┐
│ Store      │
│ Public Key │
│ in D1      │
└────────────┘
```

```
Incoming Email:
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ Email      │───▶│ Generate   │───▶│ Encrypt    │───▶│ Encrypt    │
│ Body       │    │ AES Key    │    │ with AES   │    │ AES Key    │
└────────────┘    └────────────┘    └────────────┘    │ with RSA   │
                                                      └─────┬──────┘
                                                            │
                                          ┌────────────┐    │
                                          │ Store in   │◀───┘
                                          │ R2         │
                                          └────────────┘
```

```
Reading Email:
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ Wallet     │───▶│ Sign Same  │───▶│ Derive     │───▶│ Decrypt    │
│ Connect    │    │ Message    │    │ AES Key    │    │ RSA Private│
└────────────┘    └────────────┘    └────────────┘    └─────┬──────┘
                                                            │
┌────────────┐    ┌────────────┐    ┌────────────┐          │
│ Decrypted  │◀───│ Decrypt    │◀───│ Decrypt    │◀─────────┘
│ Email      │    │ Body       │    │ AES Key    │
└────────────┘    └────────────┘    └────────────┘
```

### What's Protected

| Data | Storage | Encrypted? |
|------|---------|------------|
| Email body (HTML/text) | R2 | Yes (RSA-OAEP + AES-256-GCM) |
| Raw email (.eml) | R2 | Yes |
| Attachments | R2 | Yes |
| Private encryption key | R2 | Yes (AES-256-GCM) |
| Subject, sender, date | D1 | No (searchable) |
| Public encryption key | D1 | No |

### Trust Model

- **Server cannot read email content** - Bodies encrypted with user's public key
- **Server cannot decrypt private key** - Encrypted with wallet-derived key
- **Decryption is client-side only** - Private key never leaves browser unencrypted
- **Wallet signature = access** - No passwords, no recovery if wallet lost

### Key Storage Locations

| Key | Location | Admin Can See? | Admin Can Use? |
|-----|----------|----------------|----------------|
| RSA Public Key | D1 `email_addresses.encryption_public_key` | Yes | Only encrypts, can't decrypt |
| Encrypted RSA Private Key | R2 `encryption/{address_id}/private_key.enc` | Yes | No - needs wallet signature |
| AES Key (protects private key) | **Nowhere** | No | Derived on-demand from wallet |
| Decrypted RSA Private Key | Browser `sessionStorage` | No | Only in user's browser |

**What an admin with full database access sees:**
```
D1: encryption_public_key = {"kty":"RSA","n":"xK7d2..."...}  ← Can only encrypt
R2: private_key.enc = [encrypted binary blob]                ← Useless without wallet
```

**To decrypt emails, an attacker needs:**
1. ✓ Encrypted private key (stored in R2)
2. ✗ User's wallet signature of the exact message (never stored)

The AES key that decrypts the private key is derived from: `SHA-256(wallet_signature("Chainhost Email Encryption Key - DO NOT share this signature"))`

This signature can only be produced by the wallet that owns the private key. It's never transmitted to or stored on the server.

### Key Generation

| Component | Generation Method | Deterministic? |
|-----------|-------------------|----------------|
| AES key (protects private key) | SHA-256 of wallet signature | Yes - same wallet = same key |
| RSA keypair (encrypts emails) | `crypto.subtle.generateKey()` | No - random each time |

The RSA keypair is randomly generated, NOT derived from the wallet. This means:
- Fresh keys on every encryption setup
- No way to recover keys even with the same wallet
- Maximum forward secrecy

### Ownership Transfers

When a chainhost name is transferred to a new wallet:

```
1. User A owns "bob" → creates keypair A, emails encrypted with key A
2. User A transfers "bob" to User B
3. User B logs in → system detects owner_address changed
4. Old encryption keys are deleted
5. User B creates fresh keypair B
6. Old emails: encrypted with key A (unreadable by B)
7. New emails: encrypted with key B
```

**What happens to old emails after transfer:**
- Stay in the inbox (metadata visible: sender, subject, date)
- Body encrypted with previous owner's key
- Cannot be decrypted by new owner
- Cannot be decrypted by previous owner (keys deleted)
- Effectively "sealed" forever

**If the name transfers back to original owner:**
- New random keypair is generated (not the original)
- Old emails from first ownership period remain unreadable
- This is intentional - prevents key recovery attacks

### Threat Analysis

| Threat | Protected? | How |
|--------|------------|-----|
| Admin reads emails | ✅ Yes | Bodies encrypted with user's RSA key |
| Database breach | ✅ Yes | Only encrypted blobs, no decryption keys |
| R2 bucket breach | ✅ Yes | Private key encrypted with wallet-derived AES |
| Man-in-the-middle | ✅ Yes | HTTPS + decryption requires wallet signature |
| Stolen laptop (logged in) | ⚠️ Partial | sessionStorage cleared on browser close |
| Compromised wallet | ❌ No | Wallet = identity, game over |
| User loses wallet | ❌ No | No recovery possible by design |

### What's NOT Encrypted (Searchable Metadata)

These remain in plaintext for server-side search:
- Sender address (`from_address`)
- Sender name (`from_name`)
- Recipient addresses (`to_addresses`, `cc_addresses`)
- Subject line (`subject`)
- Snippet/preview (`snippet` - first 200 chars of body)
- Timestamps (`received_at`, `sent_at`)
- Thread IDs, read status, folder

If metadata privacy is required, a future enhancement could encrypt subjects client-side.

## Deployment

### Prerequisites

```bash
# Create D1 database
npx wrangler d1 create chainhost-email

# Create R2 bucket
npx wrangler r2 bucket create chainhost-email

# Set Resend API key
npx wrangler secret put RESEND_API_KEY
```

### Deploy Workers

```bash
# Main subdomain router (includes mail routes)
npx wrangler deploy

# Email receiver worker
npx wrangler deploy -c wrangler-email-receiver.toml
```

### Configure Email Routing

1. Go to Cloudflare Dashboard > Email > Email Routing
2. Add catch-all rule: `*@chainhost.online` → Worker: `chainhost-email-receiver`

### DNS Records

```
MX    chainhost.online    route1.mx.cloudflare.net    9
MX    chainhost.online    route2.mx.cloudflare.net    70
MX    chainhost.online    route3.mx.cloudflare.net    13
TXT   chainhost.online    v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all
```

## API Endpoints

### Authentication (no session required)

```
POST /mail/api/auth/challenge    - Get signing challenge
POST /mail/api/auth/verify       - Verify signature, create session
POST /mail/api/auth/logout       - Clear session
POST /mail/api/encryption/setup  - Store encryption keys
```

### Mail (session required)

```
GET  /mail/api/inbox             - List inbox emails
GET  /mail/api/sent              - List sent emails
GET  /mail/api/email/:id         - Get single email
DELETE /mail/api/email/:id       - Delete email
POST /mail/api/send              - Send email
POST /mail/api/mark-read         - Mark as read
GET  /mail/api/contacts          - Get contacts
GET  /mail/api/encryption/private-key - Get encrypted private key
```

## Features

### Plus Addressing (Subaddressing)

Users can receive mail at `name+anything@chainhost.online`:
- `name+shopping@chainhost.online`
- `name+newsletters@chainhost.online`
- `name+github@chainhost.online`

The tag is stored in `subaddress_tag` and can be filtered in the inbox.

### Auto-Registration

When an email arrives for a valid chainhost name that hasn't used email yet:
1. Worker checks if `data:,name` exists on-chain
2. If yes, creates email_addresses record automatically
3. Email is delivered (unencrypted until user logs in and sets up encryption)

### Thread Grouping

Emails are grouped into threads by:
1. `In-Reply-To` header matching existing `Message-ID`
2. Normalized subject matching (strips Re:, Fwd:, etc.)

## Files

```
cloudflare-worker/
├── subdomain-router.js      # Main router, imports mail-routes
├── mail-routes.js           # All email functionality
├── email-receiver.js        # Inbound email handler
├── wrangler.toml            # Main worker config
├── wrangler-email-receiver.toml  # Email receiver config
└── package.json             # Dependencies (postal-mime)

sql/
└── email-schema.sql         # D1 database schema

src/app/mail/about/
└── page.tsx                 # Public documentation (Next.js)
```

## Environment Variables

### Subdomain Router (wrangler.toml)
- `DB` - D1 database binding
- `R2` - R2 bucket binding
- `CACHE` - KV namespace for caching
- `RESEND_API_KEY` - Secret for sending emails

### Email Receiver (wrangler-email-receiver.toml)
- `DB` - Same D1 database
- `R2` - Same R2 bucket

## Troubleshooting

### Emails not being received
1. Check MX records: `dig MX chainhost.online`
2. Check Email Routing rules in Cloudflare dashboard
3. Tail the receiver: `npx wrangler tail chainhost-email-receiver`

### D1 errors with undefined
D1 doesn't accept JavaScript `undefined`. Use `|| null` for optional fields:
```javascript
parsed.messageId || null
```

### Encryption setup fails
- Ensure browser supports Web Crypto API
- Check console for detailed errors
- Verify wallet is connected and can sign messages

## License

MIT
