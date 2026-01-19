/**
 * MailChannels Integration for Chainhost Email
 *
 * Sends transactional emails via MailChannels API (free for Cloudflare Workers)
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  from: EmailAddress;
  to: EmailAddress | EmailAddress[];
  cc?: EmailAddress | EmailAddress[];
  bcc?: EmailAddress | EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * MailChannels email format
 */
interface MCEmail {
  personalizations: Array<{
    to: Array<{ email: string; name?: string }>;
    cc?: Array<{ email: string; name?: string }>;
    bcc?: Array<{ email: string; name?: string }>;
    dkim_domain?: string;
    dkim_selector?: string;
    dkim_private_key?: string;
  }>;
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  subject: string;
  content: Array<{ type: string; value: string }>;
  headers?: Record<string, string>;
}

/**
 * Convert our EmailAddress to MailChannels format
 */
function toMCAddress(addr: EmailAddress | string): { email: string; name?: string } {
  if (typeof addr === 'string') {
    return { email: addr };
  }
  return { email: addr.email, name: addr.name };
}

/**
 * Convert array of EmailAddress to MailChannels format
 */
function toMCAddresses(
  addrs: EmailAddress | EmailAddress[] | undefined
): Array<{ email: string; name?: string }> | undefined {
  if (!addrs) return undefined;
  const arr = Array.isArray(addrs) ? addrs : [addrs];
  return arr.map(toMCAddress);
}

/**
 * Send an email via MailChannels
 */
export async function sendEmail(
  options: SendEmailOptions,
  dkimConfig?: { domain: string; selector: string; privateKey: string }
): Promise<SendEmailResult> {
  const toAddresses = toMCAddresses(options.to);
  if (!toAddresses || toAddresses.length === 0) {
    return { success: false, error: 'No recipients specified' };
  }

  // Build content array
  const content: Array<{ type: string; value: string }> = [];
  if (options.text) {
    content.push({ type: 'text/plain', value: options.text });
  }
  if (options.html) {
    content.push({ type: 'text/html', value: options.html });
  }
  if (content.length === 0) {
    return { success: false, error: 'No email content (text or html) provided' };
  }

  // Build MailChannels email
  const mcEmail: MCEmail = {
    personalizations: [
      {
        to: toAddresses,
        cc: toMCAddresses(options.cc),
        bcc: toMCAddresses(options.bcc),
        ...(dkimConfig && {
          dkim_domain: dkimConfig.domain,
          dkim_selector: dkimConfig.selector,
          dkim_private_key: dkimConfig.privateKey,
        }),
      },
    ],
    from: toMCAddress(options.from),
    subject: options.subject,
    content,
  };

  if (options.replyTo) {
    mcEmail.reply_to = toMCAddress(options.replyTo);
  }

  if (options.headers) {
    mcEmail.headers = options.headers;
  }

  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mcEmail),
    });

    if (response.status >= 200 && response.status < 300) {
      // Extract Message-ID from response if available
      const messageId = response.headers.get('X-Message-Id') || crypto.randomUUID();
      return { success: true, messageId };
    }

    const errorText = await response.text();
    console.error('MailChannels error:', response.status, errorText);
    return {
      success: false,
      error: `MailChannels returned ${response.status}: ${errorText}`,
    };
  } catch (error) {
    console.error('MailChannels request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate an email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Extract domain from email address
 */
export function getEmailDomain(email: string): string {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
}

/**
 * Format email address for display
 */
export function formatEmailAddress(addr: EmailAddress): string {
  if (addr.name) {
    return `${addr.name} <${addr.email}>`;
  }
  return addr.email;
}

/**
 * Parse email address string into EmailAddress object
 * Handles formats like: "John Doe <john@example.com>" or "john@example.com"
 */
export function parseEmailAddress(str: string): EmailAddress {
  const match = str.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: str.trim() };
}
