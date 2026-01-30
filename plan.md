# Chainhost Mail: Hybrid On-Chain + Domain Email

## Overview

Two delivery methods for email - user chooses based on needs:

| | On-Chain | Domain |
|--|----------|--------|
| **Storage** | Base L2 | D1/R2 |
| **Cost** | ~$0.02 | Free |
| **Speed** | ~30s | Instant |
| **Mirrors** | All | Single domain |
| **Permanence** | Forever | 90 days (configurable) |
| **Use case** | Important, legal, permanent | Newsletters, notifications, high volume |

---

## The Pattern

Same as Chainhost websites:

```
Websites:  All mirrors → index chain for manifests → serve same content
Email:     All mirrors → index chain for wrap msgs → show same inbox (on-chain portion)
```

**Mirror setup includes email:**
```
Current:
1. Deploy subdomain-router.js
2. DNS wildcard
3. Done - serves websites

With email:
1. Deploy subdomain-router.js
2. Deploy email-bridge.js        ← new
3. DNS wildcard
4. MX records                    ← new
5. Fund bridge wallet            ← new
6. Done - serves websites + receives email
```

**All mirrors can receive email:**
```
bob@chainhost.online   → chainhost bridge   ─┐
bob@chost.app          → chost bridge       ├─→ same on-chain inbox
bob@immutable.church   → immutable bridge   ─┘
```

---

## User Experience

### Inbox View

Merges both sources seamlessly:

```
┌─────────────────────────────────────────────────────────────┐
│  Inbox                                    [Settings] [Compose]│
├─────────────────────────────────────────────────────────────┤
│  ⛓️  alice@gmail.com - Contract signed           2 min ago  │
│  📧  newsletter@substack.com - Weekly digest    15 min ago  │
│  ⛓️  bob@chost.app - Payment confirmed           1 hr ago   │
│  📧  github@notifications - PR merged            2 hr ago   │
│  📧  no-reply@amazon.com - Order shipped         5 hr ago   │
└─────────────────────────────────────────────────────────────┘

⛓️ = on-chain (permanent, visible on all mirrors)
📧 = domain (fast, this mirror only)
```

### Reading Email

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                                              ⛓️     │
├─────────────────────────────────────────────────────────────┤
│  From: alice@gmail.com                                      │
│  To: bob@chainhost.online                                   │
│  Subject: Contract signed                                   │
│  Date: Jan 21, 2026 10:30 AM                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Hi Bob,                                                    │
│                                                             │
│  The contract has been signed. Please find attached...      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Reply]  [Forward]  [Delete]                               │
│                                                             │
│  On-chain: 0x1234...abcd (Base L2, block 12345678)         │
└─────────────────────────────────────────────────────────────┘
```

For domain emails, show option to upgrade:

```
├─────────────────────────────────────────────────────────────┤
│  [Reply]  [Forward]  [Delete]  [⛓️ Save to Chain ~$0.02]   │
└─────────────────────────────────────────────────────────────┘
```

### Composing Email

```
┌─────────────────────────────────────────────────────────────┐
│  Compose                                              [Send] │
├─────────────────────────────────────────────────────────────┤
│  To:      alice@gmail.com                                   │
│  Subject: RE: Contract signed                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Thanks Alice, I've reviewed and everything looks good.     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Delivery:                                                  │
│  ○ Domain (instant, free)                                   │
│  ○ On-chain (permanent, ~$0.02)                            │
│                                                             │
│  ℹ️ External recipients (gmail, etc) always use domain.     │
│     On-chain stores your copy permanently.                  │
└─────────────────────────────────────────────────────────────┘
```

When sending to another chainhost user:

```
┌─────────────────────────────────────────────────────────────┐
│  To:      alice@chost.app                          ✓ ⛓️    │
├─────────────────────────────────────────────────────────────┤
│  Delivery:                                                  │
│  ○ Domain (instant, free, chainhost.online only)           │
│  ● On-chain (permanent, ~$0.02, all mirrors)               │
│                                                             │
│  ✓ alice has wrap-keys - both of you can decrypt           │
└─────────────────────────────────────────────────────────────┘
```

### Preferences

```
┌─────────────────────────────────────────────────────────────┐
│  Email Preferences                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Default Delivery                                           │
│  ● Domain (fast, free)                                      │
│  ○ On-chain (permanent, ~$0.02/email)                      │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Always On-Chain                                            │
│  Senders matching these patterns go on-chain automatically: │
│                                                             │
│  [*@bank.com                                           ] [+]│
│  [*@legal.com                                          ] [+]│
│  [*@chainhost.online                                   ] [+]│
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Keyword Triggers                                           │
│  Emails with these words in subject go on-chain:           │
│                                                             │
│  [contract] [payment] [invoice] [signed]              [+]   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Auto-Archive (Domain Only)                                 │
│  Domain emails are deleted after: [90 days ▼]              │
│  ☑ Prompt before deleting unread emails                    │
│  ☐ Auto-upgrade starred emails to on-chain                 │
│                                                             │
│  On-chain emails are permanent and never deleted.          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Receiving Email (Hybrid Bridge)

```
                         External Email
                              │
                              ▼
                    ┌─────────────────┐
                    │  Email Bridge   │
                    │                 │
                    │  1. Parse email │
                    │  2. Check prefs │
                    │  3. Route       │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
       ┌─────────────┐              ┌─────────────┐
       │   Domain    │              │  On-Chain   │
       │             │              │             │
       │ Encrypt RSA │              │ Encrypt X3DH│
       │ Store D1/R2 │              │ Broadcast   │
       │ Instant     │              │ Base L2     │
       └─────────────┘              └─────────────┘
```

**Bridge routing logic:**

```javascript
async function routeEmail(email, recipient) {
  const prefs = await getPreferences(recipient);

  // Check rules
  const shouldOnChain =
    prefs.default === 'onchain' ||
    prefs.alwaysSenders.some(p => matchPattern(email.from, p)) ||
    prefs.keywords.some(k => email.subject.includes(k));

  if (shouldOnChain) {
    await storeOnChain(email, recipient);
  } else {
    await storeDomain(email, recipient);
  }
}
```

### Reading Email (Merged Inbox)

```javascript
async function getInbox(user) {
  // Fetch from both sources in parallel
  const [domainEmails, onchainEmails] = await Promise.all([
    fetchFromD1(user.addressId),
    fetchFromIndexer(user.identityKey)
  ]);

  // Merge and sort by date
  const merged = [...domainEmails, ...onchainEmails]
    .map(e => ({ ...e, source: e.txHash ? 'onchain' : 'domain' }))
    .sort((a, b) => b.receivedAt - a.receivedAt);

  return merged;
}
```

### Sending Email

```
                         Compose
                            │
                            ▼
              ┌─────────────────────────┐
              │  Recipient type?        │
              └────────────┬────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
   External (gmail)                   Chainhost user
         │                                   │
         ▼                                   ▼
   Domain only                    User chooses delivery
   (Resend API)                          │
         │                    ┌──────────┴──────────┐
         │                    │                     │
         ▼                    ▼                     ▼
   Sent copy to           Domain path          On-chain path
   D1 or chain           (Resend API)         (Wrap protocol)
   (user choice)              │                     │
                              ▼                     ▼
                         Sent to D1          Both parties can
                                             decrypt from chain
```

### On-Chain Data Formats

**Wrap Keys (identity):**
```
Transaction: self-send on Base L2
Calldata: data:wrap-keys,{base64}

{
  "chainhostName": "bob",
  "identityKey": "abc123...",
  "signedPreKey": "def456...",
  "timestamp": 1705123456789
}
```

**Wrapped Email:**
```
Transaction: self-send on Base L2
Calldata: data:wrap,{base64}

{
  "version": 2,
  "senderIdentityKey": "...",
  "iv": "...",
  "ciphertext": "...",
  "authTag": "...",
  "keys": [
    {
      "recipientId": "bob",
      "recipientIdentityKey": "...",
      "ephemeralKey": "...",
      "wrappedKey": "...",
      "iv": "...",
      "authTag": "..."
    }
  ]
}
```

**Decrypted Email Payload:**
```json
{
  "type": "email",
  "from": "alice@gmail.com",
  "fromName": "Alice",
  "to": "bob@chainhost.online",
  "subject": "Contract signed",
  "body": "<html>...</html>",
  "bodyText": "Plain text...",
  "receivedAt": 1705123456789,
  "messageId": "<abc123@gmail.com>",
  "attachments": []
}
```

---

## Cost Analysis

### Domain Path (Current)
- Receiving: Free (Cloudflare Email Routing)
- Storage: Free (D1/R2 free tier)
- Sending: Free (Resend free tier, 100/day)

### On-Chain Path
- Receiving: ~$0.01-0.05 (bridge pays gas on Base L2)
- Storage: Free (on-chain forever)
- Sending: ~$0.01-0.05 (user pays gas)
- Reading: Free (indexer/RPC)

### Who Pays?

**Receiving (bridge gas):**
- Option A: Subsidized by mirror operator
- Option B: User prepays credits
- Option C: Rate limits for free tier

**Sending (user gas):**
- User pays directly from wallet
- Clear cost shown before send

---

## Security Model

### Domain Path
Same as current Chainhost Mail:
- RSA-2048 + AES-256-GCM
- Keys derived from wallet signature
- Decryption in browser
- Server cannot read content

### On-Chain Path
Wrap protocol (X3DH):
- X25519 key agreement
- AES-256-GCM encryption
- Multi-recipient support
- Decryption in browser
- Fully on-chain, any gateway can serve

### Key Management

Users have two key sets:
1. **RSA keys** (domain path) - existing, stored in D1/R2
2. **Wrap keys** (on-chain path) - new, published on Base L2

Both derived from wallet signature = same recovery model.

---

## Migration Path

### Phase 1: Add Wrap Keys
- Generate wrap keys during mail setup
- Publish to Base L2
- Store locally alongside RSA keys

### Phase 2: Hybrid Receiving
- Bridge checks user preferences
- Default: domain (no change)
- Optional: on-chain for matching rules

### Phase 3: Hybrid Sending
- Add delivery toggle to compose
- On-chain option for chainhost recipients
- Domain remains default

### Phase 4: Inbox Merge
- UI fetches from both D1 and indexer
- Seamless merge with source indicators
- "Save to Chain" upgrade button

### Phase 5: Mirror Email
- Document mirror email setup
- Any mirror can receive for any domain
- On-chain portion synced everywhere

### Phase 6: Preferences
- Per-sender rules
- Keyword triggers
- Auto-archive settings

---

## Implementation Checklist

### Infrastructure
- [ ] Deploy wrap-indexer (Cloudflare Worker + KV)
- [ ] Index wrap-keys from Base L2
- [ ] Index wrap messages by recipient
- [ ] API: `/keys/:name`, `/inbox/:identityKey`, `/message/:txHash`

### Mail Setup
- [ ] Generate wrap keys during encryption setup
- [ ] Publish wrap-keys to Base L2
- [ ] Store wrap keys locally (alongside RSA)

### Receiving
- [ ] Add preferences table to D1
- [ ] Routing logic in email-receiver
- [ ] On-chain path: fetch wrap-keys, encrypt, broadcast
- [ ] Domain path: unchanged

### Sending
- [ ] Delivery toggle in compose UI
- [ ] On-chain send via Wrap protocol
- [ ] Multi-recipient for chainhost-to-chainhost

### Inbox
- [ ] Fetch from both sources
- [ ] Merge and sort
- [ ] Source indicators (⛓️/📧)
- [ ] "Save to Chain" button

### Preferences UI
- [ ] Default delivery setting
- [ ] Per-sender rules
- [ ] Keyword triggers
- [ ] Auto-archive settings

### Mirror Setup
- [ ] Document MX configuration
- [ ] Document bridge wallet setup
- [ ] Test cross-mirror inbox sync

---

## Success Criteria

- [ ] User can receive email via domain (instant, free)
- [ ] User can receive email via on-chain (~30s, ~$0.02)
- [ ] User can set preferences for routing
- [ ] User can upgrade domain emails to chain
- [ ] Chainhost-to-chainhost: both can decrypt on-chain
- [ ] On-chain inbox visible on all mirrors
- [ ] bob@chainhost.online and bob@chost.app work
- [ ] Clear UX with source indicators
- [ ] Preferences UI for rules and auto-archive

---

## Open Questions

1. **Preferences storage** - D1 (fast) or on-chain (portable)?
2. **Bridge funding model** - Subsidized, prepaid, or rate-limited?
3. **Attachment size limits** - Chunk large attachments or reject?
4. **Spam on-chain** - Filter at bridge or client-side hide?
5. **Key rotation** - How to handle wrap-key updates?
