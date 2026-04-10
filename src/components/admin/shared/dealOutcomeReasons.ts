/**
 * Canonical lists of won/lost reasons used by the WonLostModal and any
 * reporting or filtering UI that groups deals by outcome reason.
 *
 * Matches Copper's default reason sets so a platform migration lands cleanly
 * without remapping historical data.
 */

export const LOSS_REASONS = [
  'Price too high',
  'Chose competitor',
  'No budget',
  'Bad timing',
  'No response',
  'Not a fit',
  'Project cancelled',
  'Other',
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export const WON_REASONS = [
  'Best price',
  'Relationship',
  'Fastest close',
  'Product features',
  'Bundled deal',
  'Referral',
  'Other',
] as const;

export type WonReason = (typeof WON_REASONS)[number];
