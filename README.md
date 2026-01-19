# Chainhost

Permanent websites on Ethereum. No servers, no subscriptions, forever yours.

## How It Works

```
1. Claim a name     →  Inscribe "data:,yourname" on Ethereum
2. Upload HTML      →  Inscribe your HTML as calldata
3. Create manifest  →  Link routes to content with JSON
4. Go live          →  yourname.chainhost.online
```

## The Stack

| Layer | What | Where |
|-------|------|-------|
| **Name** | `data:,yourname` | Ethscription |
| **Content** | `data:text/html;base64,...` | Ethereum or Base calldata |
| **Manifest** | `{"chainhost":{"name":{"home":"0x..."}}}` | JSON ethscription |
| **Gateway** | Cloudflare Worker | Reads chain, serves HTML |

## Manifest Format

```json
{
  "chainhost": {
    "yourname": {
      "home": "0x1234...abc",
      "about": "0x5678...def"
    }
  }
}
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Home page |
| `/about` | About page |
| `/previous` | Content history |
| `/recovery` | Self-hosting guide |

## Costs

| Action | Chain | Cost |
|--------|-------|------|
| Claim name | Ethereum | ~$0.01 |
| Upload HTML | Ethereum | ~$0.50-2 |
| Upload HTML | Base | ~$0.01-0.05 |
| Create manifest | Ethereum | ~$0.10 |

Gas fees only. No platform fees.

## Self-Hosting

Your name works on ANY gateway running this worker.

```bash
git clone https://github.com/jefdiesel/chainhost
cd cloudflare-worker
npx wrangler login
npx wrangler deploy
```

Then add your domain in Cloudflare with route `*.yourdomain.com/*`.

See [skill.md](skill.md) for detailed setup instructions (AI-friendly).

## Mirrors

- [chainhost.online](https://chainhost.online) - main
- [chost.app](https://chost.app) - mirror
- [immutable.church](https://immutable.church) - mirror

## Links

- [Ethscriptions](https://ethscriptions.com)
- [Example: degenjef.chainhost.online](https://degenjef.chainhost.online)

## License

MIT
