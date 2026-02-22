import { GmailCRMView } from './extensions/GmailCRMView';
import { GmailBasicView } from './extensions/GmailBasicView';

export interface GmailCoreProps {
  /** Unique key identifying the user (e.g. 'evan', 'ilan') */
  userId: string;
  /** 'basic' = lightweight inbox; 'crm' = full CRM-enhanced Gmail */
  variant?: 'basic' | 'crm';
  /** OAuth callback prefix routing */
  callbackPrefix?: 'admin' | 'superadmin';
  /** Path to return to after Gmail OAuth */
  returnPath?: string;
}

/**
 * Unified Gmail entry point.
 *
 * Usage:
 *   <GmailCore userId="evan" variant="crm" />
 *   <GmailCore userId="ilan" variant="basic" />
 *   <GmailCore userId="newAdmin" variant="crm" />
 */
export function GmailCore({
  userId,
  variant = 'basic',
  callbackPrefix = 'admin',
  returnPath,
}: GmailCoreProps) {
  if (variant === 'crm') {
    return (
      <GmailCRMView
        userKey={userId}
        callbackPrefix={callbackPrefix}
        returnPath={returnPath}
      />
    );
  }

  return (
    <GmailBasicView
      userKey={userId}
      callbackPrefix={callbackPrefix}
    />
  );
}
