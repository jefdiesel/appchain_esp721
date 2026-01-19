/**
 * Cloudflare Email Receiver Worker
 *
 * Handles inbound emails to *@chainhost.email via Cloudflare Email Routing.
 * Parses emails, stores bodies in R2, and metadata in D1.
 */

import PostalMime from 'postal-mime';

// Ethscriptions API for verifying name ownership
const ETHSCRIPTIONS_API = 'https://api.ethscriptions.com/v2';
const EMAIL_DOMAIN = 'chainhost.online';  // Domain for email addresses

export default {
  /**
   * Handle incoming email via Cloudflare Email Routing
   */
  async email(message, env) {
    const startTime = Date.now();
    const emailId = crypto.randomUUID();

    try {
      // Extract recipient name from email address (supports subaddressing: name+tag@domain)
      const toAddress = message.to.toLowerCase();
      const [localPart, domain] = toAddress.split('@');

      // Handle subaddressing (plus addressing): name+tag@domain → name@domain
      let name = localPart;
      let subaddressTag = null;
      if (localPart.includes('+')) {
        const plusIndex = localPart.indexOf('+');
        name = localPart.slice(0, plusIndex);
        subaddressTag = localPart.slice(plusIndex + 1);
      }

      // Verify this is for our domain
      if (domain !== EMAIL_DOMAIN) {
        console.log(`Rejecting email for unknown domain: ${domain}`);
        message.setReject('Invalid domain');
        return;
      }

      // Look up email address in D1 (include encryption_public_key)
      let address = await env.DB.prepare(
        'SELECT id, chainhost_name, owner_address, encryption_public_key FROM email_addresses WHERE chainhost_name = ? AND is_active = 1'
      ).bind(name).first();

      // If not found, check if the name exists on-chain and auto-register
      if (!address) {
        const owner = await verifyNameOwnership(name);
        if (!owner) {
          console.log(`Rejecting email for unclaimed name: ${name}`);
          message.setReject('Address not found');
          return;
        }

        // Auto-register the email address for this chainhost name
        const addressId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO email_addresses (id, chainhost_name, owner_address)
          VALUES (?, ?, ?)
        `).bind(addressId, name, owner).run();

        // New addresses won't have encryption until user logs in
        address = { id: addressId, chainhost_name: name, owner_address: owner, encryption_public_key: null };
      }

      // Parse the email
      const rawEmail = await streamToArrayBuffer(message.raw);
      const parser = new PostalMime();
      const parsed = await parser.parse(rawEmail);

      // Basic spam check
      const spamScore = calculateSpamScore(parsed, message);
      const isSpam = spamScore > 5;

      // Check if encryption is enabled for this address
      const hasEncryption = !!address.encryption_public_key;
      let publicKey = null;
      if (hasEncryption) {
        try {
          const jwk = JSON.parse(address.encryption_public_key);
          publicKey = await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['encrypt']
          );
        } catch (e) {
          console.error('Failed to import encryption key:', e);
        }
      }

      // Store raw email in R2 (optionally encrypted)
      const r2Key = `${address.id}/${emailId}`;
      if (publicKey) {
        // Encrypt raw email
        const encryptedRaw = await encryptWithPublicKey(publicKey, rawEmail);
        await env.R2.put(`${r2Key}.eml.enc`, encryptedRaw);
      } else {
        await env.R2.put(`${r2Key}.eml`, rawEmail);
      }

      // Store HTML and text bodies separately for quick access (encrypted if key available)
      if (parsed.html) {
        if (publicKey) {
          const encryptedHtml = await encryptWithPublicKey(publicKey, new TextEncoder().encode(parsed.html));
          await env.R2.put(`${r2Key}.html.enc`, encryptedHtml);
        } else {
          await env.R2.put(`${r2Key}.html`, parsed.html);
        }
      }
      if (parsed.text) {
        if (publicKey) {
          const encryptedText = await encryptWithPublicKey(publicKey, new TextEncoder().encode(parsed.text));
          await env.R2.put(`${r2Key}.txt.enc`, encryptedText);
        } else {
          await env.R2.put(`${r2Key}.txt`, parsed.text);
        }
      }

      // Store attachments
      const attachments = parsed.attachments || [];
      for (const att of attachments) {
        const attId = crypto.randomUUID();
        const attKey = `${r2Key}/attachments/${attId}_${sanitizeFilename(att.filename || 'attachment')}`;
        await env.R2.put(attKey, att.content);

        // Store attachment metadata
        await env.DB.prepare(`
          INSERT INTO email_attachments (id, email_id, filename, content_type, size, r2_key)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(attId, emailId, att.filename, att.mimeType, att.content.byteLength, attKey).run();
      }

      // Extract and format addresses
      const fromAddress = parsed.from?.address || message.from;
      const fromName = parsed.from?.name || '';
      const toAddresses = formatAddresses(parsed.to || [{ address: toAddress }]);
      const ccAddresses = formatAddresses(parsed.cc || []);

      // Generate snippet from text body
      const snippet = (parsed.text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);

      // Find or create thread
      const threadId = await findOrCreateThread(env.DB, address.id, parsed, emailId);

      // Store email metadata in D1
      // Note: D1 doesn't accept undefined, must use null
      const isEncrypted = publicKey ? 1 : 0;
      await env.DB.prepare(`
        INSERT INTO emails (
          id, address_id, thread_id, message_id, in_reply_to,
          from_address, from_name, to_addresses, cc_addresses, subaddress_tag,
          subject, snippet, r2_key, has_attachments, attachment_count,
          is_spam, is_encrypted, folder, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        emailId,
        address.id,
        threadId,
        parsed.messageId || null,
        parsed.inReplyTo || null,
        fromAddress || null,
        fromName || null,
        toAddresses,
        ccAddresses,
        subaddressTag,
        parsed.subject || '(no subject)',
        snippet,
        r2Key,
        attachments.length > 0 ? 1 : 0,
        attachments.length,
        isSpam ? 1 : 0,
        isEncrypted,
        isSpam ? 'spam' : 'inbox',
        Date.now()
      ).run();

      // Update thread
      await env.DB.prepare(`
        UPDATE email_threads
        SET last_message_at = ?, message_count = message_count + 1, unread_count = unread_count + 1
        WHERE id = ?
      `).bind(Date.now(), threadId).run();

      // Auto-collect contact
      await upsertContact(env.DB, address.id, fromAddress, fromName);

      // Log the action
      await env.DB.prepare(`
        INSERT INTO email_audit_logs (id, address_id, action, status, metadata, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        address.id,
        'email.received',
        'success',
        JSON.stringify({
          email_id: emailId,
          from: fromAddress,
          subject: parsed.subject,
          spam_score: spamScore,
          processing_time_ms: Date.now() - startTime
        }),
        message.headers.get('X-Real-IP') || 'unknown'
      ).run();

      // Trigger webhooks if configured
      await triggerWebhooks(env, address.id, 'email.received', {
        email_id: emailId,
        from: fromAddress,
        to: toAddress,
        subject: parsed.subject,
        received_at: Date.now()
      });

      console.log(`Email received: ${emailId} for ${name}@chainhost.email from ${fromAddress}`);

    } catch (error) {
      console.error('Error processing email:', error);

      // Log the error
      try {
        await env.DB.prepare(`
          INSERT INTO email_audit_logs (id, action, status, metadata)
          VALUES (?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          'email.received',
          'error',
          JSON.stringify({ error: error.message, to: message.to })
        ).run();
      } catch (logError) {
        console.error('Error logging failure:', logError);
      }

      // Don't reject - just log the error
      // Rejecting would cause the sender to receive a bounce
    }
  },

  /**
   * Handle HTTP requests (for testing and health checks)
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'email-receiver' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Chainhost Email Receiver', { status: 200 });
  }
};

/**
 * Verify that a chainhost name exists and get the owner
 */
async function verifyNameOwnership(name) {
  try {
    const nameSha = await sha256(`data:,${name}`);
    const res = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/exists/0x${nameSha}`);
    const data = await res.json();

    if (data?.result?.exists) {
      return data.result.ethscription.current_owner;
    }
    return null;
  } catch (error) {
    console.error('Error verifying name ownership:', error);
    return null;
  }
}

/**
 * SHA-256 hash helper
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert ReadableStream to ArrayBuffer
 */
async function streamToArrayBuffer(stream) {
  const chunks = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Sanitize filename for storage
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
}

/**
 * Format addresses array to JSON string
 */
function formatAddresses(addresses) {
  if (!addresses || addresses.length === 0) return '[]';
  return JSON.stringify(addresses.map(a => ({
    address: a.address || a,
    name: a.name || ''
  })));
}

/**
 * Calculate basic spam score
 */
function calculateSpamScore(parsed, message) {
  let score = 0;

  const subject = (parsed.subject || '').toLowerCase();
  const text = (parsed.text || '').toLowerCase();

  // Check for common spam indicators
  const spamWords = ['viagra', 'casino', 'lottery', 'winner', 'free money', 'click here', 'unsubscribe'];
  for (const word of spamWords) {
    if (subject.includes(word) || text.includes(word)) {
      score += 2;
    }
  }

  // Check for excessive links
  const linkCount = (text.match(/https?:\/\//g) || []).length;
  if (linkCount > 10) score += 2;

  // Check for all caps subject
  if (parsed.subject && parsed.subject === parsed.subject.toUpperCase() && parsed.subject.length > 10) {
    score += 1;
  }

  // Check SPF/DKIM headers (if available)
  const authResults = message.headers.get('Authentication-Results') || '';
  if (authResults.includes('spf=fail')) score += 3;
  if (authResults.includes('dkim=fail')) score += 3;

  return score;
}

/**
 * Find existing thread or create a new one
 */
async function findOrCreateThread(db, addressId, parsed, emailId) {
  // Try to find existing thread by In-Reply-To header
  if (parsed.inReplyTo) {
    const existingEmail = await db.prepare(
      'SELECT thread_id FROM emails WHERE message_id = ? AND address_id = ?'
    ).bind(parsed.inReplyTo, addressId).first();

    if (existingEmail?.thread_id) {
      return existingEmail.thread_id;
    }
  }

  // Try to find by subject (removing Re:, Fwd:, etc.)
  const normalizedSubject = normalizeSubject(parsed.subject || '');
  if (normalizedSubject) {
    const existingThread = await db.prepare(
      'SELECT id FROM email_threads WHERE address_id = ? AND subject = ? ORDER BY last_message_at DESC LIMIT 1'
    ).bind(addressId, normalizedSubject).first();

    if (existingThread?.id) {
      return existingThread.id;
    }
  }

  // Create new thread
  const threadId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO email_threads (id, address_id, subject, last_message_at, message_count, unread_count)
    VALUES (?, ?, ?, ?, 0, 0)
  `).bind(threadId, addressId, normalizedSubject, Date.now()).run();

  return threadId;
}

/**
 * Normalize email subject (remove Re:, Fwd:, etc.)
 */
function normalizeSubject(subject) {
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .replace(/^\[.*?\]\s*/, '')
    .trim();
}

/**
 * Insert or update contact
 */
async function upsertContact(db, addressId, email, name) {
  try {
    await db.prepare(`
      INSERT INTO email_contacts (id, address_id, email, name, last_contacted_at, contact_count)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT (address_id, email) DO UPDATE SET
        name = COALESCE(NULLIF(excluded.name, ''), email_contacts.name),
        last_contacted_at = excluded.last_contacted_at,
        contact_count = email_contacts.contact_count + 1
    `).bind(crypto.randomUUID(), addressId, email.toLowerCase(), name, Date.now()).run();
  } catch (error) {
    console.error('Error upserting contact:', error);
  }
}

/**
 * Trigger webhooks for an event
 */
async function triggerWebhooks(env, addressId, event, payload) {
  try {
    const webhooks = await env.DB.prepare(
      'SELECT * FROM email_webhooks WHERE address_id = ? AND is_active = 1 AND events LIKE ?'
    ).bind(addressId, `%${event}%`).all();

    for (const webhook of webhooks.results || []) {
      try {
        const body = JSON.stringify({
          event,
          timestamp: Date.now(),
          data: payload
        });

        const headers = {
          'Content-Type': 'application/json',
          'X-Chainhost-Event': event,
          'X-Chainhost-Timestamp': Date.now().toString()
        };

        // Add signature if secret is configured
        if (webhook.secret) {
          const signature = await hmacSha256(body, webhook.secret);
          headers['X-Chainhost-Signature'] = signature;
        }

        // Fire and forget - don't wait for response
        fetch(webhook.url, {
          method: 'POST',
          headers,
          body
        }).catch(err => {
          console.error(`Webhook failed for ${webhook.url}:`, err);
        });

        // Update last triggered
        await env.DB.prepare(
          'UPDATE email_webhooks SET last_triggered_at = ? WHERE id = ?'
        ).bind(Date.now(), webhook.id).run();

      } catch (webhookError) {
        console.error('Error triggering webhook:', webhookError);
      }
    }
  } catch (error) {
    console.error('Error fetching webhooks:', error);
  }
}

/**
 * HMAC-SHA256 for webhook signatures
 */
async function hmacSha256(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encrypt data using hybrid encryption (RSA-OAEP + AES-GCM)
 * RSA encrypts an AES key, AES encrypts the actual data
 * Returns: encryptedAesKey (256 bytes) + iv (12 bytes) + encryptedData
 */
async function encryptWithPublicKey(publicKey, data) {
  // Generate random AES key
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );

  // Export AES key for RSA encryption
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

  // Encrypt AES key with RSA public key
  const encryptedAesKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey
  );

  // Generate IV for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Ensure data is ArrayBuffer
  const dataBuffer = data instanceof ArrayBuffer ? data : data.buffer || data;

  // Encrypt data with AES-GCM
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    dataBuffer
  );

  // Combine: encryptedAesKey (256 bytes for 2048-bit RSA) + iv (12 bytes) + encryptedData
  const result = new Uint8Array(
    encryptedAesKey.byteLength + iv.byteLength + encryptedData.byteLength
  );
  result.set(new Uint8Array(encryptedAesKey), 0);
  result.set(iv, encryptedAesKey.byteLength);
  result.set(new Uint8Array(encryptedData), encryptedAesKey.byteLength + iv.byteLength);

  return result.buffer;
}
