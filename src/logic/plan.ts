import type { Account, Usage } from '../data/types';
import { isoDate } from './dates';

/** What a free account may make, until the account server says otherwise. */
export const DEFAULT_LIMITS: Usage = { docs: 10, cash: 10 };

export interface Quota {
  limit: number;
  used: number;
  left: number;
  /** True when a free account cannot make another one. */
  full: boolean;
}

export interface Allowance {
  pro: boolean;
  docs: Quota;
  cash: Quota;
}

/** Pro runs to the end of its last day; with no end date it does not run out. */
export function isPro(account: Account | null, today: string = isoDate()): boolean {
  return !!account && account.plan === 'pro' && (!account.proUntil || account.proUntil >= today);
}

function quota(limit: number, used: number, pro: boolean): Quota {
  const left = Math.max(0, limit - used);
  return { limit, used, left, full: !pro && left === 0 };
}

/**
 * What the account may still make. Quotations and invoices share one allowance; cash book entries have their own.
 * What was ever made counts, so deleting does not give anything back. Opening, editing, printing and sending
 * what already exists is never limited.
 */
export function allowance(account: Account | null, usage: Usage, today: string = isoDate()): Allowance {
  const pro = isPro(account, today);
  const limits = account?.limits ?? DEFAULT_LIMITS;
  return { pro, docs: quota(limits.docs, usage.docs, pro), cash: quota(limits.cash, usage.cash, pro) };
}
