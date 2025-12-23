// Username validation and suggestion utilities

// Minimum 4 characters (but allow specific exceptions)
export const MIN_USERNAME_LENGTH = 4;
export const MAX_USERNAME_LENGTH = 20;

// Special short usernames that are allowed (owner exceptions)
const ALLOWED_SHORT_USERNAMES = ['jef'];

// Standard blocklist - common profanity and reserved words
const BLOCKED_WORDS = [
  // Profanity
  'fuck', 'shit', 'ass', 'damn', 'bitch', 'cunt', 'dick', 'cock', 'pussy',
  'fag', 'faggot', 'nigger', 'nigga', 'retard', 'whore', 'slut', 'bastard',
  'piss', 'crap', 'penis', 'vagina', 'anus', 'porn', 'xxx', 'sex', 'nude',
  'naked', 'tits', 'boob', 'dildo', 'anal', 'rape', 'molest', 'pedo',
  // Reserved/system
  'admin', 'administrator', 'root', 'system', 'chainhost', 'support',
  'help', 'info', 'contact', 'about', 'api', 'www', 'mail', 'email',
  'ftp', 'cdn', 'static', 'assets', 'app', 'dashboard', 'login', 'signup',
  'auth', 'oauth', 'webhook', 'webhooks', 'null', 'undefined', 'test',
  // Brand protection
  'ethereum', 'bitcoin', 'crypto', 'blockchain', 'coinbase', 'binance',
  'metamask', 'opensea', 'stripe', 'clerk', 'supabase', 'vercel', 'aws',
];

// Check if username contains any blocked words
function containsBlockedWord(username: string): boolean {
  const lower = username.toLowerCase();
  return BLOCKED_WORDS.some(word => lower.includes(word));
}

// Validate username format
export function validateUsername(username: string): {
  valid: boolean;
  error?: string;
} {
  if (!username) {
    return { valid: false, error: 'Username is required' };
  }

  if (username.length < MIN_USERNAME_LENGTH && !ALLOWED_SHORT_USERNAMES.includes(username.toLowerCase())) {
    return { valid: false, error: `Username must be at least ${MIN_USERNAME_LENGTH} characters` };
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    return { valid: false, error: `Username must be at most ${MAX_USERNAME_LENGTH} characters` };
  }

  // Only alphanumeric and hyphens, must start/end with alphanumeric
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and hyphens' };
  }

  // No consecutive hyphens
  if (username.includes('--')) {
    return { valid: false, error: 'Username cannot contain consecutive hyphens' };
  }

  if (containsBlockedWord(username)) {
    return { valid: false, error: 'Username contains inappropriate content' };
  }

  return { valid: true };
}

// Generate alternative username suggestions
export function generateSuggestions(baseUsername: string, count: number = 5): string[] {
  const suggestions: string[] = [];
  const base = baseUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (base.length < MIN_USERNAME_LENGTH) {
    return suggestions;
  }

  // Add numbers
  for (let i = 1; i <= 99 && suggestions.length < count; i++) {
    const suggestion = `${base}${i}`;
    if (validateUsername(suggestion).valid) {
      suggestions.push(suggestion);
    }
  }

  // Add year suffixes
  const years = ['24', '25', '2024', '2025'];
  for (const year of years) {
    if (suggestions.length >= count) break;
    const suggestion = `${base}${year}`;
    if (validateUsername(suggestion).valid && !suggestions.includes(suggestion)) {
      suggestions.push(suggestion);
    }
  }

  // Add prefixes
  const prefixes = ['the', 'its', 'im', 'hey'];
  for (const prefix of prefixes) {
    if (suggestions.length >= count) break;
    const suggestion = `${prefix}${base}`;
    if (validateUsername(suggestion).valid && !suggestions.includes(suggestion)) {
      suggestions.push(suggestion);
    }
  }

  return suggestions.slice(0, count);
}
