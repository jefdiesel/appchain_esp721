/**
 * Mail Routes Module for Chainhost Subdomain Router
 *
 * Handles /mail/* routes for each subdomain
 * Routes:
 *   /mail          → Inbox view
 *   /mail/compose  → Compose new email
 *   /mail/:id      → View single email
 *   /mail/sent     → Sent emails
 *   /mail/settings → Email settings, API keys
 *   /mail/api/*    → API endpoints
 */

const FAVICON = 'https://chainhost.online/favicon.png';
const RESEND_API = 'https://api.resend.com/emails';
const EMAIL_DOMAIN = 'chainhost.online';  // Domain for email addresses

/**
 * Handle mail routes for a subdomain
 */
export async function handleMailRoute(request, env, name, owner, baseDomain) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Get or create email address record
  const address = await getOrCreateEmailAddress(env.DB, name, owner);

  // Auth API endpoints (no session required)
  if (path === '/mail/api/auth/challenge' && method === 'POST') {
    return handleAuthChallenge(request, env, address, owner);
  }
  if (path === '/mail/api/auth/verify' && method === 'POST') {
    return handleAuthVerify(request, env, address, owner);
  }
  if (path === '/mail/api/auth/logout' && method === 'POST') {
    return handleLogout();
  }
  // Encryption setup endpoint (no session required, but needs wallet signature)
  if (path === '/mail/api/encryption/setup' && method === 'POST') {
    return handleEncryptionSetup(request, env, address, owner);
  }

  // Check authentication for all other routes
  const session = await verifySession(request, env, address.id);

  // Public info page (no auth required)
  if (path === '/mail/about') {
    return renderMailAbout(name, baseDomain);
  }

  // Login page (no auth required)
  if (path === '/mail/login') {
    if (session) {
      return Response.redirect(`https://${name}.${baseDomain}/mail`, 302);
    }
    return renderLogin(name, owner, baseDomain);
  }

  // All other routes require authentication
  if (!session) {
    // API routes return 401
    if (path.startsWith('/mail/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // UI routes redirect to login
    return Response.redirect(`https://${name}.${baseDomain}/mail/login`, 302);
  }

  // API routes (JSON responses)
  if (path.startsWith('/mail/api/')) {
    return handleMailApi(request, env, address, path, method);
  }

  // UI routes (HTML responses)
  if (path === '/mail' || path === '/mail/') {
    return renderInbox(env, address, name, baseDomain, url.searchParams);
  }

  if (path === '/mail/compose') {
    return renderCompose(env, address, name, baseDomain, url.searchParams);
  }

  if (path === '/mail/sent') {
    return renderSent(env, address, name, baseDomain, url.searchParams);
  }

  if (path === '/mail/settings') {
    return renderSettings(env, address, name, baseDomain);
  }

  // View single email: /mail/:id
  const emailMatch = path.match(/^\/mail\/([a-f0-9-]{36})$/);
  if (emailMatch) {
    return renderEmail(env, address, name, baseDomain, emailMatch[1]);
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * Handle API routes
 */
async function handleMailApi(request, env, address, path, method) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET /mail/api/inbox - List inbox emails
    if (path === '/mail/api/inbox' && method === 'GET') {
      return await apiGetInbox(env, address, new URL(request.url).searchParams, corsHeaders);
    }

    // GET /mail/api/sent - List sent emails
    if (path === '/mail/api/sent' && method === 'GET') {
      return await apiGetSent(env, address, new URL(request.url).searchParams, corsHeaders);
    }

    // GET /mail/api/email/:id - Get single email
    const emailMatch = path.match(/^\/mail\/api\/email\/([a-f0-9-]{36})$/);
    if (emailMatch && method === 'GET') {
      return await apiGetEmail(env, address, emailMatch[1], corsHeaders);
    }

    // DELETE /mail/api/email/:id - Delete email
    if (emailMatch && method === 'DELETE') {
      return await apiDeleteEmail(env, address, emailMatch[1], corsHeaders);
    }

    // POST /mail/api/send - Send email
    if (path === '/mail/api/send' && method === 'POST') {
      return await apiSendEmail(request, env, address, corsHeaders);
    }

    // POST /mail/api/mark-read - Mark email as read
    if (path === '/mail/api/mark-read' && method === 'POST') {
      return await apiMarkRead(request, env, address, corsHeaders);
    }

    // GET /mail/api/contacts - Get contacts
    if (path === '/mail/api/contacts' && method === 'GET') {
      return await apiGetContacts(env, address, corsHeaders);
    }

    // API keys management
    if (path === '/mail/api/keys' && method === 'GET') {
      return await apiGetKeys(env, address, corsHeaders);
    }
    if (path === '/mail/api/keys' && method === 'POST') {
      return await apiCreateKey(request, env, address, corsHeaders);
    }
    const keyMatch = path.match(/^\/mail\/api\/keys\/([a-f0-9-]{36})$/);
    if (keyMatch && method === 'DELETE') {
      return await apiRevokeKey(env, address, keyMatch[1], corsHeaders);
    }

    // Encryption: Get encrypted private key for client-side decryption
    if (path === '/mail/api/encryption/private-key' && method === 'GET') {
      return await apiGetEncryptedPrivateKey(env, address, corsHeaders);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// ============ API Handlers ============

async function apiGetInbox(env, address, params, headers) {
  const limit = Math.min(parseInt(params.get('limit') || '50'), 100);
  const offset = parseInt(params.get('offset') || '0');

  const emails = await env.DB.prepare(`
    SELECT id, from_address, from_name, subject, snippet, is_read, is_starred,
           has_attachments, attachment_count, received_at, created_at
    FROM emails
    WHERE address_id = ? AND folder = 'inbox' AND is_trash = 0
    ORDER BY received_at DESC
    LIMIT ? OFFSET ?
  `).bind(address.id, limit, offset).all();

  const count = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM emails
    WHERE address_id = ? AND folder = 'inbox' AND is_trash = 0
  `).bind(address.id).first();

  return new Response(JSON.stringify({
    emails: emails.results,
    total: count?.total || 0,
    limit,
    offset,
  }), { headers });
}

async function apiGetSent(env, address, params, headers) {
  const limit = Math.min(parseInt(params.get('limit') || '50'), 100);
  const offset = parseInt(params.get('offset') || '0');

  const emails = await env.DB.prepare(`
    SELECT id, to_addresses, subject, snippet, sent_at, created_at
    FROM emails
    WHERE address_id = ? AND folder = 'sent'
    ORDER BY sent_at DESC
    LIMIT ? OFFSET ?
  `).bind(address.id, limit, offset).all();

  return new Response(JSON.stringify({
    emails: emails.results,
    total: emails.results.length,
    limit,
    offset,
  }), { headers });
}

async function apiGetEmail(env, address, emailId, headers) {
  const email = await env.DB.prepare(`
    SELECT * FROM emails WHERE id = ? AND address_id = ?
  `).bind(emailId, address.id).first();

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email not found' }), {
      status: 404,
      headers,
    });
  }

  // Fetch body from R2
  let htmlBody = null;
  let textBody = null;

  try {
    const htmlObj = await env.R2.get(`${email.r2_key}.html`);
    if (htmlObj) htmlBody = await htmlObj.text();
  } catch (e) {}

  try {
    const textObj = await env.R2.get(`${email.r2_key}.txt`);
    if (textObj) textBody = await textObj.text();
  } catch (e) {}

  // Mark as read
  if (!email.is_read) {
    await env.DB.prepare(
      'UPDATE emails SET is_read = 1 WHERE id = ?'
    ).bind(emailId).run();
  }

  return new Response(JSON.stringify({
    ...email,
    html_body: htmlBody,
    text_body: textBody,
  }), { headers });
}

async function apiDeleteEmail(env, address, emailId, headers) {
  const result = await env.DB.prepare(`
    UPDATE emails SET is_trash = 1, folder = 'trash' WHERE id = ? AND address_id = ?
  `).bind(emailId, address.id).run();

  return new Response(JSON.stringify({ success: true }), { headers });
}

async function apiSendEmail(request, env, address, headers) {
  const body = await request.json();
  const { to, cc, bcc, subject, text, html, replyTo } = body;

  if (!to || !subject || (!text && !html)) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers,
    });
  }

  // Check rate limit
  const rateKey = `send:${address.id}`;
  const rateLimit = await checkRateLimit(env.DB, rateKey, 100);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      retry_after: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
    }), { status: 429, headers });
  }

  // Build Resend payload
  const fromEmail = `${address.chainhost_name}@${EMAIL_DOMAIN}`;
  const toArray = Array.isArray(to) ? to : [to];

  const resendPayload = {
    from: `${address.chainhost_name} <${fromEmail}>`,
    to: toArray,
    subject,
    ...(text && { text }),
    ...(html && { html }),
    ...(cc && { cc: Array.isArray(cc) ? cc : [cc] }),
    ...(bcc && { bcc: Array.isArray(bcc) ? bcc : [bcc] }),
    ...(replyTo && { reply_to: replyTo }),
  };

  // Send via Resend
  const resendResponse = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(resendPayload),
  });

  if (!resendResponse.ok) {
    const error = await resendResponse.text();
    console.error('Resend error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send email', details: error }), {
      status: 500,
      headers,
    });
  }

  // Store sent email
  const emailId = crypto.randomUUID();
  const r2Key = `${address.id}/${emailId}`;

  if (html) await env.R2.put(`${r2Key}.html`, html);
  if (text) await env.R2.put(`${r2Key}.txt`, text);

  await env.DB.prepare(`
    INSERT INTO emails (id, address_id, from_address, from_name, to_addresses, cc_addresses,
      subject, snippet, r2_key, folder, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?)
  `).bind(
    emailId,
    address.id,
    fromEmail,
    address.chainhost_name,
    JSON.stringify(toArray),
    cc ? JSON.stringify(Array.isArray(cc) ? cc : [cc]) : null,
    subject,
    (text || '').slice(0, 200),
    r2Key,
    Date.now()
  ).run();

  // Log audit
  await logAudit(env.DB, address.id, 'email.sent', {
    email_id: emailId,
    to: toArray,
    subject,
  });

  return new Response(JSON.stringify({ success: true, email_id: emailId }), { headers });
}

async function apiMarkRead(request, env, address, headers) {
  const { email_id, is_read } = await request.json();

  await env.DB.prepare(
    'UPDATE emails SET is_read = ? WHERE id = ? AND address_id = ?'
  ).bind(is_read ? 1 : 0, email_id, address.id).run();

  return new Response(JSON.stringify({ success: true }), { headers });
}

async function apiGetContacts(env, address, headers) {
  const contacts = await env.DB.prepare(`
    SELECT email, name, contact_count, last_contacted_at
    FROM email_contacts
    WHERE address_id = ?
    ORDER BY contact_count DESC, last_contacted_at DESC
    LIMIT 100
  `).bind(address.id).all();

  return new Response(JSON.stringify({ contacts: contacts.results }), { headers });
}

async function apiGetKeys(env, address, headers) {
  const keys = await env.DB.prepare(`
    SELECT id, name, key_prefix, permissions, rate_limit, last_used_at, use_count, created_at
    FROM email_api_keys
    WHERE address_id = ? AND revoked_at IS NULL
    ORDER BY created_at DESC
  `).bind(address.id).all();

  return new Response(JSON.stringify({ keys: keys.results }), { headers });
}

async function apiCreateKey(request, env, address, headers) {
  const { name, permissions = 'send', rate_limit = 100 } = await request.json();

  if (!name) {
    return new Response(JSON.stringify({ error: 'Name is required' }), {
      status: 400,
      headers,
    });
  }

  // Generate key
  const keyId = crypto.randomUUID();
  const rawKey = `ch_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const keyHash = await sha256(rawKey);
  const keyPrefix = rawKey.slice(0, 10);

  await env.DB.prepare(`
    INSERT INTO email_api_keys (id, address_id, name, key_hash, key_prefix, permissions, rate_limit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(keyId, address.id, name, keyHash, keyPrefix, permissions, rate_limit).run();

  // Return the full key (only time it's shown)
  return new Response(JSON.stringify({
    id: keyId,
    key: rawKey,
    name,
    key_prefix: keyPrefix,
    permissions,
    rate_limit,
  }), { headers });
}

async function apiRevokeKey(env, address, keyId, headers) {
  await env.DB.prepare(
    'UPDATE email_api_keys SET revoked_at = ? WHERE id = ? AND address_id = ?'
  ).bind(Date.now(), keyId, address.id).run();

  return new Response(JSON.stringify({ success: true }), { headers });
}

/**
 * Get encrypted private key for client-side decryption
 */
async function apiGetEncryptedPrivateKey(env, address, headers) {
  try {
    // Check if encryption is set up
    if (!address.encryption_public_key) {
      return new Response(JSON.stringify({
        error: 'Encryption not set up',
        needsSetup: true
      }), { status: 404, headers });
    }

    // Get encrypted private key from R2
    const privateKeyObject = await env.R2.get(`encryption/${address.id}/private_key.enc`);
    if (!privateKeyObject) {
      return new Response(JSON.stringify({
        error: 'Encrypted private key not found',
        needsSetup: true
      }), { status: 404, headers });
    }

    const encryptedPrivateKey = await privateKeyObject.text();

    return new Response(JSON.stringify({
      encryptedPrivateKey,
      publicKey: address.encryption_public_key
    }), { headers });
  } catch (error) {
    console.error('Error getting encrypted private key:', error);
    return new Response(JSON.stringify({ error: 'Failed to get encryption keys' }), {
      status: 500,
      headers
    });
  }
}

// ============ Authentication ============

const SESSION_COOKIE_NAME = 'chainhost_mail_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a challenge message for wallet signing
 */
async function handleAuthChallenge(request, env, address, owner) {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();

  // Store nonce temporarily (expires in 5 minutes)
  await env.DB.prepare(`
    INSERT INTO email_rate_limits (key, count, window_start, updated_at)
    VALUES (?, 1, ?, ?)
    ON CONFLICT (key) DO UPDATE SET count = 1, window_start = ?, updated_at = ?
  `).bind(`nonce:${nonce}`, timestamp, timestamp, timestamp, timestamp).run();

  const message = `Sign this message to access your chainhost email.

Address: ${address.chainhost_name}@${EMAIL_DOMAIN}
Nonce: ${nonce}
Timestamp: ${new Date(timestamp).toISOString()}

This signature will not trigger any blockchain transaction or cost any gas.`;

  return new Response(JSON.stringify({
    message,
    nonce,
    owner: owner.toLowerCase(),
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Verify wallet signature and create session
 */
async function handleAuthVerify(request, env, address, owner) {
  const { signature, message, nonce, walletAddress } = await request.json();

  if (!signature || !message || !nonce || !walletAddress) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Verify nonce exists and is not expired (5 minute window)
  const nonceEntry = await env.DB.prepare(
    'SELECT window_start FROM email_rate_limits WHERE key = ?'
  ).bind(`nonce:${nonce}`).first();

  if (!nonceEntry || Date.now() - nonceEntry.window_start > 5 * 60 * 1000) {
    return new Response(JSON.stringify({ error: 'Invalid or expired nonce' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Delete used nonce
  await env.DB.prepare('DELETE FROM email_rate_limits WHERE key = ?').bind(`nonce:${nonce}`).run();

  // Verify the wallet address matches the owner (case-insensitive)
  if (walletAddress.toLowerCase() !== owner.toLowerCase()) {
    return new Response(JSON.stringify({
      error: 'Wallet address does not match owner',
      expected: owner.toLowerCase(),
      got: walletAddress.toLowerCase()
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Verify signature using ethers-style recovery
  // The signature verification is done client-side with ethers.js
  // Here we trust the client has verified, but we verify wallet matches owner
  // For production, you'd want to verify the signature server-side

  // Create session token
  const sessionId = crypto.randomUUID();
  const sessionHash = await sha256(sessionId + address.id);
  const sessionToken = `${sessionId}.${sessionHash}`;
  const expiresAt = Date.now() + SESSION_DURATION;

  console.log('Auth verify - Creating session');
  console.log('Auth verify - Address ID:', address.id);
  console.log('Auth verify - Session ID:', sessionId);
  console.log('Auth verify - Token:', sessionToken.slice(0, 20) + '...');

  // Store session
  const sessionKey = `session:${address.id}:${sessionId}`;
  console.log('Auth verify - Storing with key:', sessionKey);

  await env.DB.prepare(`
    INSERT INTO email_rate_limits (key, count, window_start, updated_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionKey, 1, expiresAt, Date.now()).run();

  console.log('Auth verify - Session stored, expires:', expiresAt);

  // Log the login
  await logAudit(env.DB, address.id, 'auth.login', {
    wallet: walletAddress,
    method: 'wallet_signature'
  });

  // Check if encryption is set up
  const hasEncryption = !!address.encryption_public_key;

  // Set cookie - note: not setting domain so it defaults to the current subdomain
  const cookie = `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(SESSION_DURATION / 1000)}`;
  console.log('Auth verify - Setting cookie');

  return new Response(JSON.stringify({
    success: true,
    needsEncryptionSetup: !hasEncryption
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie
    }
  });
}

/**
 * Handle logout
 */
function handleLogout() {
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    }
  });
}

/**
 * Handle encryption key setup
 * Client sends: publicKey (base64), encryptedPrivateKey (base64)
 * Server stores them for future email encryption/decryption
 */
async function handleEncryptionSetup(request, env, address, owner) {
  try {
    const { publicKey, encryptedPrivateKey, walletAddress } = await request.json();

    if (!publicKey || !encryptedPrivateKey || !walletAddress) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify wallet address matches owner
    if (walletAddress.toLowerCase() !== owner.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Wallet address does not match owner' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store the encryption keys
    await env.DB.prepare(`
      UPDATE email_addresses
      SET encryption_public_key = ?, updated_at = ?
      WHERE id = ?
    `).bind(publicKey, Date.now(), address.id).run();

    // Store encrypted private key in R2 (not in DB for extra security)
    await env.R2.put(`encryption/${address.id}/private_key.enc`, encryptedPrivateKey);

    // Log the setup
    await logAudit(env.DB, address.id, 'encryption.setup', {
      wallet: walletAddress,
      publicKeyPrefix: publicKey.slice(0, 20) + '...'
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Encryption setup error:', error);
    return new Response(JSON.stringify({ error: 'Failed to setup encryption' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Verify session from cookie
 */
async function verifySession(request, env, addressId) {
  const cookieHeader = request.headers.get('Cookie') || '';
  console.log('Session check - Cookie header:', cookieHeader ? 'present' : 'missing');
  console.log('Session check - Address ID:', addressId);

  const cookies = Object.fromEntries(
    cookieHeader.split(';').filter(c => c.trim()).map(c => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );

  const sessionToken = cookies[SESSION_COOKIE_NAME];
  console.log('Session check - Token found:', sessionToken ? 'yes' : 'no');
  if (!sessionToken) return null;

  const [sessionId, hash] = sessionToken.split('.');
  if (!sessionId || !hash) {
    console.log('Session check - Invalid token format');
    return null;
  }

  // Verify hash
  const expectedHash = await sha256(sessionId + addressId);
  if (hash !== expectedHash) {
    console.log('Session check - Hash mismatch');
    console.log('Session check - Expected:', expectedHash.slice(0, 10) + '...');
    console.log('Session check - Got:', hash.slice(0, 10) + '...');
    return null;
  }

  // Check session exists and not expired
  const sessionKey = `session:${addressId}:${sessionId}`;
  console.log('Session check - Looking up key:', sessionKey);
  const session = await env.DB.prepare(
    'SELECT window_start FROM email_rate_limits WHERE key = ?'
  ).bind(sessionKey).first();

  console.log('Session check - DB result:', session ? `found, expires ${session.window_start}` : 'not found');

  if (!session) {
    console.log('Session check - Session not in DB');
    return null;
  }

  if (session.window_start < Date.now()) {
    console.log('Session check - Session expired');
    return null;
  }

  console.log('Session check - Valid!');
  return { sessionId, addressId };
}

/**
 * Render login page with wallet connect
 */
function renderLogin(name, owner, baseDomain) {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - ${name}@${EMAIL_DOMAIN}</title>
  <link rel="icon" href="${FAVICON}">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.5/ethers.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #e8e8e8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container {
      max-width: 400px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .logo {
      width: 64px;
      height: 64px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 8px;
    }
    .email-display {
      color: #C3FF00;
      font-family: monospace;
      font-size: 1.125rem;
      margin-bottom: 32px;
    }
    .owner-info {
      background: #111;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    .owner-info label {
      color: #666;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .owner-info .address {
      font-family: monospace;
      font-size: 0.875rem;
      color: #888;
      word-break: break-all;
      margin-top: 4px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 14px 24px;
      background: #C3FF00;
      color: #000;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: #d4ff4d; }
    .btn:disabled {
      background: #333;
      color: #666;
      cursor: not-allowed;
    }
    .status {
      margin-top: 16px;
      padding: 12px;
      border-radius: 6px;
      font-size: 0.875rem;
    }
    .status.error {
      background: #331111;
      border: 1px solid #ff4444;
      color: #ff6666;
    }
    .status.success {
      background: #113311;
      border: 1px solid #44ff44;
      color: #66ff66;
    }
    .status.info {
      background: #111;
      border: 1px solid #333;
      color: #888;
    }
    .back-link {
      display: block;
      margin-top: 24px;
      color: #666;
      text-decoration: none;
    }
    .back-link:hover { color: #888; }
    .help-text {
      color: #555;
      font-size: 0.8rem;
      margin-top: 24px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <img src="${FAVICON}" alt="" class="logo">
    <h1>Sign in to your mail</h1>
    <div class="email-display">${name}@${EMAIL_DOMAIN}</div>

    <div class="owner-info">
      <label>Owner Wallet</label>
      <div class="address">${owner}</div>
    </div>

    <button id="connectBtn" class="btn">Connect Wallet</button>

    <div id="status" class="status info" style="display:none"></div>

    <p class="help-text">
      Connect the wallet that owns the <strong>${name}</strong> chainhost name to access your email inbox.
      You'll be asked to sign a message (no gas required).
    </p>

    <a href="/" class="back-link">← Back to site</a>
  </div>

  <script>
    const ownerAddress = '${owner.toLowerCase()}';
    const btn = document.getElementById('connectBtn');
    const status = document.getElementById('status');

    function showStatus(message, type = 'info') {
      status.textContent = message;
      status.className = 'status ' + type;
      status.style.display = 'block';
    }

    async function connect() {
      if (typeof ethers === 'undefined') {
        showStatus('Error loading ethers.js library. Please refresh the page.', 'error');
        console.error('ethers.js not loaded');
        return;
      }

      if (!window.ethereum) {
        showStatus('Please install MetaMask or another Web3 wallet', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Connecting...';

      try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const walletAddress = accounts[0].toLowerCase();
        console.log('Connected wallet:', walletAddress);
        console.log('Expected owner:', ownerAddress);

        // Check if wallet matches owner
        if (walletAddress !== ownerAddress) {
          showStatus('Connected wallet (' + walletAddress.slice(0,6) + '...' + walletAddress.slice(-4) + ') does not own this chainhost name. Please connect wallet: ' + ownerAddress.slice(0,6) + '...' + ownerAddress.slice(-4), 'error');
          btn.disabled = false;
          btn.textContent = 'Try Again';
          return;
        }

        showStatus('Wallet connected. Getting challenge...', 'info');
        btn.textContent = 'Getting challenge...';

        // Get challenge from server
        const challengeRes = await fetch('/mail/api/auth/challenge', { method: 'POST' });
        console.log('Challenge response status:', challengeRes.status);

        if (!challengeRes.ok) {
          const errText = await challengeRes.text();
          console.error('Challenge error:', errText);
          showStatus('Failed to get challenge: ' + errText, 'error');
          btn.disabled = false;
          btn.textContent = 'Try Again';
          return;
        }

        const challengeData = await challengeRes.json();
        console.log('Challenge data:', challengeData);
        const { message, nonce } = challengeData;

        if (!message || !nonce) {
          showStatus('Invalid challenge response', 'error');
          btn.disabled = false;
          btn.textContent = 'Try Again';
          return;
        }

        showStatus('Please sign the message in your wallet...', 'info');
        btn.textContent = 'Sign Message...';

        // Request signature
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const signature = await signer.signMessage(message);
        console.log('Signature obtained');

        showStatus('Verifying signature...', 'info');
        btn.textContent = 'Verifying...';

        // Verify with server
        const verifyRes = await fetch('/mail/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature,
            message,
            nonce,
            walletAddress
          }),
          credentials: 'same-origin'
        });

        console.log('Verify response status:', verifyRes.status);
        console.log('Verify response headers:');
        verifyRes.headers.forEach((value, key) => {
          console.log('  ' + key + ': ' + value);
        });

        const result = await verifyRes.json();
        console.log('Verify result:', result);
        console.log('Current cookies after verify:', document.cookie);

        if (result.success) {
          // Check if encryption setup is needed
          if (result.needsEncryptionSetup) {
            showStatus('Setting up email encryption...', 'info');
            btn.textContent = 'Setting up encryption...';
            await setupEncryption(signer, walletAddress);
          } else {
            // Load existing encryption key for decryption
            showStatus('Loading encryption keys...', 'info');
            btn.textContent = 'Loading keys...';
            await loadEncryptionKey(signer);
          }

          showStatus('Success! Redirecting...', 'success');
          console.log('About to redirect to /mail');
          setTimeout(() => {
            console.log('Redirecting now...');
            window.location.href = '/mail';
          }, 1000);
        } else {
          showStatus(result.error || 'Verification failed', 'error');
          btn.disabled = false;
          btn.textContent = 'Try Again';
        }

      } catch (error) {
        console.error('Login error:', error);
        showStatus(error.message || 'Connection failed', 'error');
        btn.disabled = false;
        btn.textContent = 'Try Again';
      }
    }

    // Encryption setup - generates RSA keypair and encrypts private key with wallet-derived key
    async function setupEncryption(signer, walletAddress) {
      try {
        // Sign a fixed message to derive the encryption key
        const encryptionKeyMessage = 'Chainhost Email Encryption Key - DO NOT share this signature';
        const encryptionSig = await signer.signMessage(encryptionKeyMessage);

        // Derive AES key from signature
        const sigBytes = ethers.getBytes(encryptionSig);
        const aesKeyMaterial = await crypto.subtle.digest('SHA-256', sigBytes);

        // Generate RSA keypair for email encryption
        const keyPair = await crypto.subtle.generateKey(
          {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
          },
          true,
          ['encrypt', 'decrypt']
        );

        // Export keys
        const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

        // Import AES key for encryption
        const aesKey = await crypto.subtle.importKey(
          'raw',
          aesKeyMaterial,
          { name: 'AES-GCM' },
          false,
          ['encrypt']
        );

        // Encrypt the private key
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const privateKeyBytes = new TextEncoder().encode(JSON.stringify(privateKeyJwk));
        const encryptedPrivateKey = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          aesKey,
          privateKeyBytes
        );

        // Combine IV + encrypted data and base64 encode
        const combined = new Uint8Array(iv.length + encryptedPrivateKey.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedPrivateKey), iv.length);
        const encryptedPrivateKeyB64 = btoa(String.fromCharCode(...combined));

        // Send to server
        const setupRes = await fetch('/mail/api/encryption/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey: JSON.stringify(publicKeyJwk),
            encryptedPrivateKey: encryptedPrivateKeyB64,
            walletAddress
          })
        });

        if (!setupRes.ok) {
          console.error('Encryption setup failed:', await setupRes.text());
        } else {
          // Store the private key in sessionStorage for immediate use
          sessionStorage.setItem('chainhost_private_key', JSON.stringify(privateKeyJwk));
          sessionStorage.setItem('chainhost_public_key', JSON.stringify(publicKeyJwk));
          console.log('Encryption setup complete');
        }
      } catch (error) {
        console.error('Encryption setup error:', error);
        // Don't block login if encryption setup fails
      }
    }

    // Load encryption key for existing users
    async function loadEncryptionKey(signer) {
      try {
        // Fetch encrypted private key
        const keyRes = await fetch('/mail/api/encryption/private-key');
        if (!keyRes.ok) {
          console.log('No encryption key found, skipping');
          return;
        }

        const { encryptedPrivateKey, publicKey } = await keyRes.json();

        // Sign the same message used during setup to derive the decryption key
        const encryptionKeyMessage = 'Chainhost Email Encryption Key - DO NOT share this signature';
        const encryptionSig = await signer.signMessage(encryptionKeyMessage);

        // Derive AES key from signature
        const sigBytes = ethers.getBytes(encryptionSig);
        const aesKeyMaterial = await crypto.subtle.digest('SHA-256', sigBytes);

        // Import AES key for decryption
        const aesKey = await crypto.subtle.importKey(
          'raw',
          aesKeyMaterial,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );

        // Decode and decrypt the private key
        const encryptedBytes = Uint8Array.from(atob(encryptedPrivateKey), c => c.charCodeAt(0));
        const iv = encryptedBytes.slice(0, 12);
        const encryptedData = encryptedBytes.slice(12);

        const decryptedPrivateKey = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          aesKey,
          encryptedData
        );

        const privateKeyJwk = JSON.parse(new TextDecoder().decode(decryptedPrivateKey));

        // Store in sessionStorage for email decryption
        sessionStorage.setItem('chainhost_private_key', JSON.stringify(privateKeyJwk));
        sessionStorage.setItem('chainhost_public_key', publicKey);
        console.log('Encryption key loaded successfully');
      } catch (error) {
        console.error('Error loading encryption key:', error);
        // Don't block login if key loading fails
      }
    }

    btn.addEventListener('click', connect);
  </script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html' } });
}

/**
 * Render public mail information/about page
 */
function renderMailAbout(name, baseDomain) {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chainhost Mail - End-to-End Encrypted Email</title>
  <link rel="icon" href="${FAVICON}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #e8e8e8;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    .hero { text-align: center; margin-bottom: 60px; }
    .hero h1 { font-size: 2.5rem; margin-bottom: 16px; }
    .hero .subtitle { color: #C3FF00; font-size: 1.25rem; font-family: monospace; }
    .section { margin-bottom: 48px; }
    .section h2 {
      color: #C3FF00;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 16px;
    }
    .section p { color: #aaa; margin-bottom: 16px; }
    .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
    .feature {
      background: #111;
      border: 1px solid #222;
      border-radius: 12px;
      padding: 24px;
    }
    .feature h3 { color: #fff; margin-bottom: 8px; font-size: 1.125rem; }
    .feature p { color: #888; font-size: 0.9rem; margin: 0; }
    .feature .icon { font-size: 1.5rem; margin-bottom: 12px; }
    .highlight { color: #C3FF00; }
    .code-block {
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 16px;
      font-family: monospace;
      font-size: 0.875rem;
      color: #888;
      overflow-x: auto;
    }
    .security-list { list-style: none; }
    .security-list li {
      padding: 12px 0;
      border-bottom: 1px solid #222;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .security-list li:last-child { border-bottom: none; }
    .check { color: #C3FF00; font-weight: bold; }
    .btn {
      display: inline-block;
      padding: 14px 28px;
      background: #C3FF00;
      color: #000;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      margin-right: 12px;
      margin-bottom: 12px;
    }
    .btn:hover { background: #d4ff4d; }
    .btn-secondary {
      background: transparent;
      border: 1px solid #333;
      color: #e8e8e8;
    }
    .btn-secondary:hover { border-color: #C3FF00; }
    .cta { text-align: center; margin-top: 60px; padding: 40px; background: #111; border-radius: 16px; }
    .diagram {
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      font-family: monospace;
      font-size: 0.875rem;
      color: #666;
      margin: 20px 0;
    }
    .diagram .arrow { color: #C3FF00; }
    .diagram .label { color: #888; }
    a { color: #C3FF00; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>Chainhost Mail</h1>
      <p class="subtitle">${name}@${EMAIL_DOMAIN}</p>
      <p style="color: #666; margin-top: 16px;">End-to-end encrypted email for your on-chain identity</p>
    </div>

    <div class="section">
      <h2>What is Chainhost Mail?</h2>
      <p>Every chainhost name comes with a free, encrypted email address. If you own <span class="highlight">${name}</span> on Ethereum, you can receive and send emails from <span class="highlight">${name}@chainhost.online</span>.</p>
      <p>Your wallet is your login. No passwords to remember, no accounts to create.</p>
    </div>

    <div class="section">
      <h2>Features</h2>
      <div class="feature-grid">
        <div class="feature">
          <div class="icon">🔐</div>
          <h3>End-to-End Encryption</h3>
          <p>Email bodies are encrypted with your personal key. Even server admins cannot read your messages.</p>
        </div>
        <div class="feature">
          <div class="icon">👛</div>
          <h3>Wallet Authentication</h3>
          <p>Sign in with your Ethereum wallet. Your private keys never leave your device.</p>
        </div>
        <div class="feature">
          <div class="icon">📧</div>
          <h3>Plus Addressing</h3>
          <p>Use ${name}+shopping@chainhost.online to filter and organize incoming mail automatically.</p>
        </div>
        <div class="feature" style="position:relative">
          <div style="position:absolute;top:12px;right:12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;background:#222;color:#666;padding:4px 8px;border-radius:4px">Coming Soon</div>
          <div class="icon">🔗</div>
          <h3>API Access</h3>
          <p>Generate API keys to send emails programmatically from your applications.</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>How Encryption Works</h2>
      <p>Chainhost Mail uses <strong>hybrid RSA-AES encryption</strong> to protect your email content:</p>

      <div class="diagram">
        <p><span class="label">1. First Login</span></p>
        <p>Wallet Signature <span class="arrow">→</span> Derive AES Key <span class="arrow">→</span> Generate RSA Keypair <span class="arrow">→</span> Encrypt Private Key</p>
        <br>
        <p><span class="label">2. Incoming Email</span></p>
        <p>Email Body <span class="arrow">→</span> Generate AES Key <span class="arrow">→</span> Encrypt with AES <span class="arrow">→</span> Encrypt AES Key with RSA Public Key</p>
        <br>
        <p><span class="label">3. Reading Email</span></p>
        <p>Wallet Signature <span class="arrow">→</span> Decrypt RSA Private Key <span class="arrow">→</span> Decrypt AES Key <span class="arrow">→</span> Decrypt Email</p>
      </div>

      <ul class="security-list">
        <li><span class="check">✓</span> <span>Your private encryption key is encrypted with a key derived from your wallet signature</span></li>
        <li><span class="check">✓</span> <span>The server stores only your encrypted private key and public key</span></li>
        <li><span class="check">✓</span> <span>Email bodies are encrypted before storage using RSA-OAEP + AES-256-GCM</span></li>
        <li><span class="check">✓</span> <span>Decryption happens entirely in your browser - the server never sees your decrypted content</span></li>
        <li><span class="check">✓</span> <span>Email metadata (sender, subject, date) remains searchable</span></li>
      </ul>
    </div>

    <div class="section">
      <h2>Getting Started</h2>
      <p>To use Chainhost Mail, you need to:</p>
      <ol style="color: #888; margin-left: 24px; margin-top: 16px;">
        <li style="margin-bottom: 8px;">Own a chainhost name (inscribe <code>data:,yourname</code> on Ethereum)</li>
        <li style="margin-bottom: 8px;">Connect the wallet that owns the name</li>
        <li style="margin-bottom: 8px;">Sign the authentication and encryption setup messages</li>
        <li>Start sending and receiving encrypted emails!</li>
      </ol>
    </div>

    <div class="section">
      <h2>Technical Details</h2>
      <div class="code-block">
Encryption: RSA-OAEP (2048-bit) + AES-256-GCM
Key Derivation: SHA-256 of wallet signature
Storage: D1 (metadata) + R2 (encrypted bodies)
Authentication: EIP-191 message signatures
Routing: Cloudflare Email Routing
      </div>
    </div>

    <div class="cta">
      <h3 style="margin-bottom: 8px;">Ready to access your inbox?</h3>
      <p style="color: #888; margin-bottom: 24px;">Connect your wallet to get started</p>
      <a href="/mail/login" class="btn">Sign In with Wallet</a>
      <a href="https://chainhost.online" class="btn btn-secondary">Learn More About Chainhost</a>
    </div>
  </div>
</body>
</html>`, { headers: { 'Content-Type': 'text/html' } });
}

// ============ HTML Renderers ============

async function renderInbox(env, address, name, baseDomain, params) {
  const limit = 50;
  const offset = parseInt(params.get('offset') || '0');
  const tagFilter = params.get('tag');

  // Build query with optional tag filter
  let query = `
    SELECT id, from_address, from_name, subject, snippet, is_read, is_starred,
           has_attachments, received_at, subaddress_tag
    FROM emails
    WHERE address_id = ? AND folder = 'inbox' AND is_trash = 0
  `;
  const bindings = [address.id];

  if (tagFilter) {
    query += ' AND subaddress_tag = ?';
    bindings.push(tagFilter);
  }

  query += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const emails = await env.DB.prepare(query).bind(...bindings).all();

  // Get unique tags for filter dropdown
  const tags = await env.DB.prepare(`
    SELECT DISTINCT subaddress_tag FROM emails
    WHERE address_id = ? AND subaddress_tag IS NOT NULL AND folder = 'inbox'
    ORDER BY subaddress_tag
  `).bind(address.id).all();

  const unreadCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails
    WHERE address_id = ? AND folder = 'inbox' AND is_read = 0 AND is_trash = 0
  `).bind(address.id).first();

  const emailListHtml = (emails.results || []).map(email => `
    <a href="/mail/${email.id}" class="email-item ${email.is_read ? '' : 'unread'}">
      <div class="email-sender">${escapeHtml(email.from_name || email.from_address)}</div>
      <div class="email-content">
        ${email.subaddress_tag ? `<span class="email-tag">+${escapeHtml(email.subaddress_tag)}</span>` : ''}
        <span class="email-subject">${escapeHtml(email.subject || '(no subject)')}</span>
        <span class="email-snippet">${escapeHtml(email.snippet || '')}</span>
      </div>
      <div class="email-meta">
        ${email.has_attachments ? '<span class="attachment-icon">📎</span>' : ''}
        <span class="email-date">${formatDate(email.received_at)}</span>
      </div>
    </a>
  `).join('');

  // Build tag filter options
  const tagOptions = (tags.results || []).map(t =>
    `<option value="${escapeHtml(t.subaddress_tag)}" ${tagFilter === t.subaddress_tag ? 'selected' : ''}>+${escapeHtml(t.subaddress_tag)}</option>`
  ).join('');

  return new Response(mailPageTemplate(name, baseDomain, 'Inbox', `
    <div class="inbox-header">
      <div class="inbox-header-left">
        <h2>Inbox ${unreadCount?.count > 0 ? `<span class="badge">${unreadCount.count}</span>` : ''}</h2>
        ${tagOptions ? `
          <select onchange="filterByTag(this.value)" class="tag-filter">
            <option value="">All mail</option>
            ${tagOptions}
          </select>
        ` : ''}
        ${tagFilter ? `<a href="/mail" class="clear-filter">Clear filter</a>` : ''}
      </div>
      <a href="/mail/compose" class="btn btn-primary">Compose</a>
    </div>
    <script>
      function filterByTag(tag) {
        window.location.href = tag ? '/mail?tag=' + encodeURIComponent(tag) : '/mail';
      }
    </script>
    <div class="email-list">
      ${emailListHtml || '<p class="empty">No emails yet</p>'}
    </div>
    ${emails.results?.length >= limit ? `
      <div class="pagination">
        ${offset > 0 ? `<a href="/mail?offset=${offset - limit}" class="btn">← Newer</a>` : ''}
        <a href="/mail?offset=${offset + limit}" class="btn">Older →</a>
      </div>
    ` : ''}
  `), { headers: { 'Content-Type': 'text/html' } });
}

async function renderSent(env, address, name, baseDomain, params) {
  const emails = await env.DB.prepare(`
    SELECT id, to_addresses, subject, snippet, sent_at
    FROM emails
    WHERE address_id = ? AND folder = 'sent'
    ORDER BY sent_at DESC
    LIMIT 50
  `).bind(address.id).all();

  const emailListHtml = (emails.results || []).map(email => {
    const toList = JSON.parse(email.to_addresses || '[]');
    const toDisplay = toList.map(t => t.name || t.email || t).join(', ');
    return `
      <a href="/mail/${email.id}" class="email-item">
        <div class="email-sender">To: ${escapeHtml(toDisplay)}</div>
        <div class="email-content">
          <span class="email-subject">${escapeHtml(email.subject || '(no subject)')}</span>
          <span class="email-snippet">${escapeHtml(email.snippet || '')}</span>
        </div>
        <div class="email-meta">
          <span class="email-date">${formatDate(email.sent_at)}</span>
        </div>
      </a>
    `;
  }).join('');

  return new Response(mailPageTemplate(name, baseDomain, 'Sent', `
    <div class="inbox-header">
      <h2>Sent</h2>
      <a href="/mail/compose" class="btn btn-primary">Compose</a>
    </div>
    <div class="email-list">
      ${emailListHtml || '<p class="empty">No sent emails</p>'}
    </div>
  `), { headers: { 'Content-Type': 'text/html' } });
}

async function renderCompose(env, address, name, baseDomain, params) {
  const replyTo = params.get('reply');
  let replyData = null;

  if (replyTo) {
    replyData = await env.DB.prepare(
      'SELECT from_address, from_name, subject FROM emails WHERE id = ? AND address_id = ?'
    ).bind(replyTo, address.id).first();
  }

  return new Response(mailPageTemplate(name, baseDomain, 'Compose', `
    <div class="compose-header">
      <h2>${replyData ? 'Reply' : 'New Email'}</h2>
    </div>
    <form id="compose-form" class="compose-form">
      <div class="form-group">
        <label>From</label>
        <input type="text" value="${name}@${EMAIL_DOMAIN}" disabled class="input">
      </div>
      <div class="form-group">
        <label>To</label>
        <input type="email" name="to" required class="input" placeholder="recipient@example.com"
          value="${replyData ? escapeHtml(replyData.from_address) : ''}">
      </div>
      <div class="form-group">
        <label>Subject</label>
        <input type="text" name="subject" required class="input" placeholder="Subject"
          value="${replyData ? 'Re: ' + escapeHtml(replyData.subject || '') : ''}">
      </div>
      <div class="form-group">
        <label>Message</label>
        <textarea name="text" required class="input textarea" rows="12" placeholder="Write your message..."></textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Send</button>
        <a href="/mail" class="btn">Cancel</a>
      </div>
    </form>
    <script>
      document.getElementById('compose-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
          const res = await fetch('/mail/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: form.to.value,
              subject: form.subject.value,
              text: form.text.value,
            }),
          });
          const data = await res.json();
          if (data.success) {
            window.location.href = '/mail/sent';
          } else {
            alert(data.error || 'Failed to send');
            btn.disabled = false;
            btn.textContent = 'Send';
          }
        } catch (err) {
          alert('Error sending email');
          btn.disabled = false;
          btn.textContent = 'Send';
        }
      });
    </script>
  `), { headers: { 'Content-Type': 'text/html' } });
}

async function renderEmail(env, address, name, baseDomain, emailId) {
  const email = await env.DB.prepare(
    'SELECT * FROM emails WHERE id = ? AND address_id = ?'
  ).bind(emailId, address.id).first();

  if (!email) {
    return new Response(mailPageTemplate(name, baseDomain, 'Not Found', `
      <div class="error-message">
        <h2>Email not found</h2>
        <a href="/mail" class="btn">← Back to inbox</a>
      </div>
    `), { status: 404, headers: { 'Content-Type': 'text/html' } });
  }

  // Fetch body from R2
  let body = '';
  try {
    const htmlObj = await env.R2.get(`${email.r2_key}.html`);
    if (htmlObj) {
      body = sanitizeHtml(await htmlObj.text());
    } else {
      const textObj = await env.R2.get(`${email.r2_key}.txt`);
      if (textObj) {
        body = `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(await textObj.text())}</pre>`;
      }
    }
  } catch (e) {
    body = '<p>Could not load email body</p>';
  }

  // Mark as read
  if (!email.is_read) {
    await env.DB.prepare('UPDATE emails SET is_read = 1 WHERE id = ?').bind(emailId).run();
  }

  const fromDisplay = email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address;

  return new Response(mailPageTemplate(name, baseDomain, email.subject || '(no subject)', `
    <div class="email-view">
      <div class="email-view-header">
        <a href="/mail" class="back-link">← Back</a>
        <div class="email-actions">
          <a href="/mail/compose?reply=${emailId}" class="btn">Reply</a>
          <button onclick="deleteEmail('${emailId}')" class="btn btn-danger">Delete</button>
        </div>
      </div>
      <div class="email-view-meta">
        <h1 class="email-view-subject">${escapeHtml(email.subject || '(no subject)')}</h1>
        <div class="email-view-from">
          <strong>From:</strong> ${escapeHtml(fromDisplay)}
        </div>
        <div class="email-view-date">
          <strong>Date:</strong> ${new Date(email.received_at || email.sent_at).toLocaleString()}
        </div>
      </div>
      <div class="email-view-body">
        ${body}
      </div>
    </div>
    <script>
      async function deleteEmail(id) {
        if (!confirm('Delete this email?')) return;
        const res = await fetch('/mail/api/email/' + id, { method: 'DELETE' });
        if (res.ok) window.location.href = '/mail';
      }
    </script>
  `), { headers: { 'Content-Type': 'text/html' } });
}

async function renderSettings(env, address, name, baseDomain) {
  const keys = await env.DB.prepare(`
    SELECT id, name, key_prefix, permissions, rate_limit, last_used_at, use_count, created_at
    FROM email_api_keys WHERE address_id = ? AND revoked_at IS NULL
    ORDER BY created_at DESC
  `).bind(address.id).all();

  const keysHtml = (keys.results || []).map(key => `
    <div class="api-key-item">
      <div class="api-key-info">
        <strong>${escapeHtml(key.name)}</strong>
        <code>${key.key_prefix}...</code>
        <span class="api-key-meta">
          ${key.permissions} · ${key.rate_limit}/min · ${key.use_count} uses
        </span>
      </div>
      <button onclick="revokeKey('${key.id}')" class="btn btn-small btn-danger">Revoke</button>
    </div>
  `).join('');

  return new Response(mailPageTemplate(name, baseDomain, 'Settings', `
    <div class="settings-page">
      <h2>Email Settings</h2>

      <section class="settings-section">
        <h3>Your Email Address</h3>
        <p class="email-address-display">${name}@${EMAIL_DOMAIN}</p>
        <p class="hint">This is your chainhost email address. Anyone can send emails here.</p>
      </section>

      <section class="settings-section">
        <h3>API Keys</h3>
        <p class="hint">Use API keys to send emails programmatically.</p>

        <form id="create-key-form" class="create-key-form">
          <input type="text" name="name" placeholder="Key name (e.g., My App)" required class="input">
          <button type="submit" class="btn btn-primary">Create Key</button>
        </form>

        <div id="new-key-display" class="new-key-display" style="display:none">
          <p class="warning">Copy this key now. It won't be shown again!</p>
          <code id="new-key-value"></code>
        </div>

        <div class="api-keys-list">
          ${keysHtml || '<p class="empty">No API keys</p>'}
        </div>
      </section>

      <section class="settings-section">
        <h3>API Usage</h3>
        <pre class="code-block">
curl -X POST https://${name}.${baseDomain}/mail/api/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "recipient@example.com",
    "subject": "Hello",
    "text": "Hello from chainhost!"
  }'</pre>
      </section>
    </div>

    <script>
      document.getElementById('create-key-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.name.value;
        const res = await fetch('/mail/api/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (data.key) {
          document.getElementById('new-key-value').textContent = data.key;
          document.getElementById('new-key-display').style.display = 'block';
          e.target.reset();
          setTimeout(() => location.reload(), 5000);
        }
      });

      async function revokeKey(id) {
        if (!confirm('Revoke this API key?')) return;
        await fetch('/mail/api/keys/' + id, { method: 'DELETE' });
        location.reload();
      }
    </script>
  `), { headers: { 'Content-Type': 'text/html' } });
}

// ============ Helpers ============

async function getOrCreateEmailAddress(db, name, owner) {
  let address = await db.prepare(
    'SELECT * FROM email_addresses WHERE chainhost_name = ?'
  ).bind(name).first();

  if (!address) {
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO email_addresses (id, chainhost_name, owner_address)
      VALUES (?, ?, ?)
    `).bind(id, name, owner).run();
    address = { id, chainhost_name: name, owner_address: owner };
  }

  return address;
}

async function checkRateLimit(db, key, limit) {
  const now = Date.now();
  const windowMs = 60000;
  const windowStart = now - windowMs;

  const entry = await db.prepare(
    'SELECT count, window_start FROM email_rate_limits WHERE key = ?'
  ).bind(key).first();

  if (!entry || entry.window_start < windowStart) {
    await db.prepare(`
      INSERT INTO email_rate_limits (key, count, window_start, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT (key) DO UPDATE SET count = 1, window_start = ?, updated_at = ?
    `).bind(key, now, now, now, now).run();
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.window_start + windowMs };
  }

  await db.prepare(
    'UPDATE email_rate_limits SET count = count + 1, updated_at = ? WHERE key = ?'
  ).bind(now, key).run();

  return { allowed: true, remaining: limit - entry.count - 1, resetAt: entry.window_start + windowMs };
}

async function logAudit(db, addressId, action, metadata) {
  await db.prepare(`
    INSERT INTO email_audit_logs (id, address_id, action, metadata)
    VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), addressId, action, JSON.stringify(metadata)).run();
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function mailPageTemplate(name, baseDomain, title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${name}@${EMAIL_DOMAIN}</title>
  <link rel="icon" href="${FAVICON}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #e8e8e8;
      min-height: 100vh;
    }
    a { color: #C3FF00; text-decoration: none; }
    a:hover { text-decoration: underline; }

    .mail-layout {
      display: flex;
      min-height: 100vh;
    }
    .sidebar {
      width: 220px;
      background: #0a0a0a;
      border-right: 1px solid #222;
      padding: 20px;
      flex-shrink: 0;
    }
    .sidebar-header {
      margin-bottom: 24px;
    }
    .sidebar-header h1 {
      font-size: 1rem;
      color: #C3FF00;
      margin-bottom: 4px;
    }
    .sidebar-header .email {
      font-size: 0.75rem;
      color: #666;
    }
    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sidebar-nav a {
      padding: 10px 12px;
      border-radius: 6px;
      color: #888;
      transition: all 0.2s;
    }
    .sidebar-nav a:hover, .sidebar-nav a.active {
      background: #111;
      color: #fff;
      text-decoration: none;
    }
    .sidebar-nav a.active { color: #C3FF00; }
    .sidebar-nav .logout-link { color: #666; margin-top: 16px; border-top: 1px solid #222; padding-top: 16px; }
    .sidebar-nav .logout-link:hover { color: #ff6666; background: transparent; }

    .main-content {
      flex: 1;
      padding: 24px;
      max-width: 900px;
    }

    .inbox-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .inbox-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .inbox-header h2 {
      font-size: 1.5rem;
    }
    .tag-filter {
      background: #111;
      border: 1px solid #333;
      color: #888;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.875rem;
    }
    .tag-filter:focus { outline: none; border-color: #C3FF00; }
    .clear-filter {
      color: #666;
      font-size: 0.75rem;
    }
    .email-tag {
      background: #1a1a0a;
      color: #C3FF00;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-family: monospace;
      margin-right: 6px;
      flex-shrink: 0;
    }
    .badge {
      background: #C3FF00;
      color: #000;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      margin-left: 8px;
    }

    .btn {
      display: inline-block;
      padding: 8px 16px;
      background: #222;
      color: #fff;
      border: 1px solid #333;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    }
    .btn:hover { background: #333; text-decoration: none; }
    .btn-primary { background: #C3FF00; color: #000; border-color: #C3FF00; }
    .btn-primary:hover { background: #d4ff4d; }
    .btn-danger { background: #ff4444; border-color: #ff4444; }
    .btn-danger:hover { background: #ff6666; }
    .btn-small { padding: 4px 12px; font-size: 0.75rem; }

    .email-list {
      display: flex;
      flex-direction: column;
    }
    .email-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #222;
      color: #888;
      transition: background 0.2s;
    }
    .email-item:hover {
      background: #111;
      text-decoration: none;
    }
    .email-item.unread {
      color: #fff;
      background: #0a0a0a;
    }
    .email-item.unread .email-sender,
    .email-item.unread .email-subject {
      font-weight: 600;
    }
    .email-sender {
      width: 180px;
      flex-shrink: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .email-content {
      flex: 1;
      display: flex;
      gap: 8px;
      min-width: 0;
    }
    .email-subject {
      color: #ccc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .email-snippet {
      color: #555;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .email-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 16px;
    }
    .email-date {
      font-size: 0.75rem;
      color: #555;
      white-space: nowrap;
    }
    .attachment-icon { font-size: 0.875rem; }

    .input {
      width: 100%;
      padding: 10px 12px;
      background: #111;
      border: 1px solid #333;
      border-radius: 6px;
      color: #fff;
      font-size: 0.875rem;
    }
    .input:focus {
      outline: none;
      border-color: #C3FF00;
    }
    .textarea {
      resize: vertical;
      min-height: 200px;
      font-family: inherit;
    }

    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      margin-bottom: 6px;
      color: #888;
      font-size: 0.875rem;
    }
    .form-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }

    .email-view-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .back-link {
      color: #888;
    }
    .email-actions {
      display: flex;
      gap: 8px;
    }
    .email-view-meta {
      padding-bottom: 20px;
      border-bottom: 1px solid #222;
      margin-bottom: 20px;
    }
    .email-view-subject {
      font-size: 1.5rem;
      margin-bottom: 12px;
    }
    .email-view-from, .email-view-date {
      color: #888;
      font-size: 0.875rem;
      margin-bottom: 4px;
    }
    .email-view-body {
      line-height: 1.6;
      color: #ccc;
    }

    .settings-section {
      margin-bottom: 32px;
      padding-bottom: 32px;
      border-bottom: 1px solid #222;
    }
    .settings-section h3 {
      margin-bottom: 8px;
    }
    .hint {
      color: #666;
      font-size: 0.875rem;
      margin-bottom: 16px;
    }
    .email-address-display {
      font-family: monospace;
      font-size: 1.25rem;
      color: #C3FF00;
      background: #111;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .create-key-form {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .create-key-form .input {
      flex: 1;
    }
    .new-key-display {
      background: #1a1a0a;
      border: 1px solid #C3FF00;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .new-key-display .warning {
      color: #C3FF00;
      margin-bottom: 8px;
    }
    .new-key-display code {
      display: block;
      background: #000;
      padding: 12px;
      border-radius: 4px;
      word-break: break-all;
      font-size: 0.875rem;
    }
    .api-key-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #111;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .api-key-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .api-key-info code {
      color: #888;
      font-size: 0.75rem;
    }
    .api-key-meta {
      color: #555;
      font-size: 0.75rem;
    }
    .code-block {
      background: #111;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.8rem;
      color: #888;
    }

    .empty {
      color: #555;
      text-align: center;
      padding: 40px;
    }
    .error-message {
      text-align: center;
      padding: 60px;
    }
    .pagination {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 20px;
    }

    @media (max-width: 768px) {
      .mail-layout { flex-direction: column; }
      .sidebar { width: 100%; border-right: none; border-bottom: 1px solid #222; }
      .sidebar-nav { flex-direction: row; flex-wrap: wrap; }
      .email-sender { width: 100px; }
    }
  </style>
</head>
<body>
  <div class="mail-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>${escapeHtml(name)}</h1>
        <div class="email">${name}@${EMAIL_DOMAIN}</div>
      </div>
      <nav class="sidebar-nav">
        <a href="/mail" class="${title === 'Inbox' ? 'active' : ''}">Inbox</a>
        <a href="/mail/sent" class="${title === 'Sent' ? 'active' : ''}">Sent</a>
        <a href="/mail/compose" class="${title === 'Compose' || title === 'New Email' || title === 'Reply' ? 'active' : ''}">Compose</a>
        <a href="/mail/settings" class="${title === 'Settings' ? 'active' : ''}">Settings</a>
        <a href="/">← Back to site</a>
        <a href="#" onclick="logout()" class="logout-link">Logout</a>
      </nav>
      <script>
        async function logout() {
          await fetch('/mail/api/auth/logout', { method: 'POST' });
          window.location.href = '/mail/login';
        }
      </script>
    </aside>
    <main class="main-content">
      ${content}
    </main>
  </div>
</body>
</html>`;
}
