/**
 * Email Utilities for Chainhost Email
 *
 * Shared utilities for email handling, API key management, rate limiting, etc.
 */

/**
 * Hash an API key using SHA-256
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a new API key (shown to user only once)
 */
export function generateApiKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomUUID().replace(/-/g, '').slice(0, 8));
  }
  return `ch_${segments.join('')}`;
}

/**
 * Get the prefix of an API key (for identification)
 */
export function getApiKeyPrefix(key: string): string {
  return key.slice(0, 10);
}

/**
 * Timing-safe string comparison
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  // Use crypto.subtle for timing-safe comparison via HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(32),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigA = await crypto.subtle.sign('HMAC', key, aBytes);
  const sigB = await crypto.subtle.sign('HMAC', key, bBytes);

  const arrA = new Uint8Array(sigA);
  const arrB = new Uint8Array(sigB);

  let result = 0;
  for (let i = 0; i < arrA.length; i++) {
    result |= arrA[i] ^ arrB[i];
  }

  return result === 0;
}

/**
 * Check rate limit for a key (sliding window)
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get current rate limit entry
  const entry = await db.prepare(
    'SELECT count, window_start FROM email_rate_limits WHERE key = ?'
  ).bind(key).first<{ count: number; window_start: number }>();

  if (!entry || entry.window_start < windowStart) {
    // New window - reset count
    await db.prepare(`
      INSERT INTO email_rate_limits (key, count, window_start, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT (key) DO UPDATE SET count = 1, window_start = ?, updated_at = ?
    `).bind(key, now, now, now, now).run();

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.window_start + windowMs,
    };
  }

  // Increment count
  await db.prepare(
    'UPDATE email_rate_limits SET count = count + 1, updated_at = ? WHERE key = ?'
  ).bind(now, key).run();

  return {
    allowed: true,
    remaining: limit - entry.count - 1,
    resetAt: entry.window_start + windowMs,
  };
}

/**
 * Log an audit event
 */
export async function logAudit(
  db: D1Database,
  addressId: string | null,
  action: string,
  metadata: Record<string, unknown>,
  request?: Request
): Promise<void> {
  try {
    const ipAddress = request?.headers.get('CF-Connecting-IP') ||
                      request?.headers.get('X-Real-IP') ||
                      'unknown';
    const userAgent = request?.headers.get('User-Agent') || 'unknown';

    await db.prepare(`
      INSERT INTO email_audit_logs (id, address_id, action, status, metadata, ip_address, user_agent)
      VALUES (?, ?, ?, 'success', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      addressId,
      action,
      JSON.stringify(metadata),
      ipAddress,
      userAgent
    ).run();
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Generate a domain verification token
 */
export function generateVerificationToken(): string {
  return `chainhost-verify-${crypto.randomUUID()}`;
}

/**
 * Verify domain ownership via DNS TXT record
 */
export async function verifyDomainDns(domain: string, expectedToken: string): Promise<boolean> {
  try {
    // Query DNS TXT records for _chainhost-verify.domain
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=_chainhost-verify.${domain}&type=TXT`,
      {
        headers: {
          'Accept': 'application/dns-json',
        },
      }
    );

    const data = await response.json() as { Answer?: Array<{ data: string }> };

    if (data.Answer) {
      for (const record of data.Answer) {
        // TXT records come with quotes, remove them
        const value = record.data.replace(/^"|"$/g, '');
        if (value === expectedToken) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('DNS verification failed:', error);
    return false;
  }
}

/**
 * Sanitize HTML for display (basic XSS prevention)
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Format date for email display
 */
export function formatEmailDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Today - show time
  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // This week - show day name
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // This year - show month day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Older - show full date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Parse email addresses from a JSON string or return empty array
 */
export function parseEmailAddresses(json: string | null): Array<{ address: string; name: string }> {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

/**
 * Verify a wallet signature for authentication
 */
export async function verifyWalletSignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  // This would use ethers.js or viem to verify
  // For now, return a placeholder - actual implementation needs ethers
  console.log('Verify signature:', { message, signature, expectedAddress });
  return true; // Placeholder
}

/**
 * D1Database type for TypeScript
 */
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1AllResult<T>>;
}

interface D1Result {
  success: boolean;
  meta: unknown;
}

interface D1AllResult<T> {
  results: T[];
  success: boolean;
  meta: unknown;
}
