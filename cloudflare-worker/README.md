# Cloudflare Worker: Subdomain Router

This worker routes `*.chainhost.online` requests to user sites.

## Setup

1. **Create the Worker**
   - Go to Cloudflare Dashboard → Workers & Pages → Create Worker
   - Paste the contents of `subdomain-router.js`
   - Save and deploy

2. **Add Environment Variables**
   - In Worker Settings → Variables:
   - `SUPABASE_URL`: `https://rvmuhstovplabuvnkrpj.supabase.co`
   - `SUPABASE_SERVICE_KEY`: Your service role key (encrypted)
   - `ETHERSCAN_API_KEY`: (optional) Your Etherscan API key

3. **Configure Route**
   - Go to your chainhost.online domain in Cloudflare
   - Workers Routes → Add Route
   - Route: `*.chainhost.online/*`
   - Worker: Select your subdomain-router worker

4. **DNS Setup**
   - Add a wildcard A record:
   - Type: `A`
   - Name: `*`
   - Content: `192.0.2.1` (dummy IP, worker intercepts)
   - Proxy: ON (orange cloud)

## How it works

1. User visits `username.chainhost.online`
2. Worker extracts `username` from hostname
3. Queries Supabase for user with that username
4. Finds their most recent site
5. If site has `inscription_tx`, fetches content from Ethereum
6. Otherwise serves stored `html_content`
7. Returns 404 page for unclaimed usernames
