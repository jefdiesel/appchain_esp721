// Credits system for sponsored inscriptions
// Free: 5 lifetime inscriptions
// Paid ($5 one-time): unlimited

import { supabaseAdmin } from './supabase';

export const PLANS = {
  free: {
    name: 'Free',
    credits: 5,
    price: 0,
    canUploadTemplates: false,
  },
  paid: {
    name: 'Paid',
    credits: -1, // unlimited
    price: 500, // $5 in cents
    canUploadTemplates: true,
  },
} as const;

export type PlanType = keyof typeof PLANS;

export interface UserCredits {
  userId: string;
  plan: PlanType;
  creditsUsed: number;
  creditsRemaining: number; // -1 for unlimited
  canUploadTemplates: boolean;
  stripeCustomerId?: string;
  paidAt?: string;
}

// Get user's credit status
export async function getUserCredits(userId: string): Promise<UserCredits> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, plan, credits_used, stripe_customer_id, paid_at')
    .eq('clerk_id', userId)
    .single();

  if (!user) {
    // New user - free plan
    return {
      userId,
      plan: 'free',
      creditsUsed: 0,
      creditsRemaining: PLANS.free.credits,
      canUploadTemplates: false,
    };
  }

  const plan = (user.plan as PlanType) || 'free';
  const creditsUsed = user.credits_used || 0;
  const planConfig = PLANS[plan];

  return {
    userId,
    plan,
    creditsUsed,
    creditsRemaining: plan === 'paid' ? -1 : Math.max(0, planConfig.credits - creditsUsed),
    canUploadTemplates: planConfig.canUploadTemplates,
    stripeCustomerId: user.stripe_customer_id,
    paidAt: user.paid_at,
  };
}

// Check if user can inscribe
export async function canInscribe(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  credits: UserCredits;
}> {
  const credits = await getUserCredits(userId);

  if (credits.plan === 'paid') {
    return { allowed: true, credits };
  }

  if (credits.creditsRemaining > 0) {
    return { allowed: true, credits };
  }

  return {
    allowed: false,
    reason: 'No credits remaining. Upgrade to paid plan for unlimited inscriptions.',
    credits,
  };
}

// Use a credit (call after successful inscription)
export async function useCredit(userId: string): Promise<boolean> {
  const credits = await getUserCredits(userId);

  // Paid users don't consume credits
  if (credits.plan === 'paid') {
    return true;
  }

  // Free users - increment credits_used
  const { error } = await supabaseAdmin
    .from('users')
    .update({ credits_used: (credits.creditsUsed || 0) + 1 })
    .eq('clerk_id', userId);

  return !error;
}

// Upgrade user to paid plan
export async function upgradeToPaid(
  userId: string,
  stripeCustomerId: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      plan: 'paid',
      stripe_customer_id: stripeCustomerId,
      paid_at: new Date().toISOString(),
    })
    .eq('clerk_id', userId);

  return !error;
}

// Check if user can upload custom templates
export async function canUploadTemplate(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const credits = await getUserCredits(userId);

  if (credits.canUploadTemplates) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Custom templates are only available for paid users.',
  };
}
