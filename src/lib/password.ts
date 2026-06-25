import { z } from 'zod';

// --- Password Strength Rules ---

export interface StrengthRule {
  label: string;
  test: (pw: string) => boolean;
}

export const strengthRules: StrengthRule[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'Uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Number', test: (pw) => /\d/.test(pw) },
  { label: 'Special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const getStrength = (pw: string) => {
  const passed = strengthRules.filter((r) => r.test(pw)).length;
  return Math.round((passed / strengthRules.length) * 100);
};

export const getStrengthLabel = (strength: number) => {
  if (strength <= 20) return 'Very weak';
  if (strength <= 40) return 'Weak';
  if (strength <= 60) return 'Fair';
  if (strength <= 80) return 'Good';
  return 'Strong';
};

export const getStrengthColor = (strength: number) => {
  if (strength <= 20) return '#ef4444';
  if (strength <= 40) return '#f97316';
  if (strength <= 60) return '#eab308';
  if (strength <= 80) return '#3b82f6';
  return '#22c55e';
};

// --- Password Validation Schema ---
//
// Used when CREATING a password (signup, change-password). Enforces 8+ chars
// with uppercase, lowercase, number, and special character. The messages mirror
// `strengthRules` so the inline error and the strength checklist stay in sync.
//
// NOTE: do NOT use this for login / re-authentication — those authenticate an
// EXISTING password and must not reject users whose password predates the policy.
export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/\d/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');
