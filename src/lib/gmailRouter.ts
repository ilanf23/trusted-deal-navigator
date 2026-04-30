// Maps a Gmail API action name to the edge function that handles it.
// gmail-api was split into gmail-auth / gmail-mailbox / gmail-write per issue #84.

const GMAIL_ACTION_TO_FUNCTION: Record<string, 'gmail-auth' | 'gmail-mailbox' | 'gmail-write'> = {
  // gmail-auth
  'oauth-callback': 'gmail-auth',
  'get-oauth-url': 'gmail-auth',
  'status': 'gmail-auth',
  'disconnect': 'gmail-auth',

  // gmail-mailbox (read)
  'list': 'gmail-mailbox',
  'get': 'gmail-mailbox',
  'get-attachment': 'gmail-mailbox',
  'list-drafts-count': 'gmail-mailbox',
  'labels': 'gmail-mailbox',

  // gmail-write (mutate)
  'send': 'gmail-write',
  'archive': 'gmail-write',
  'trash': 'gmail-write',
  'mark-read': 'gmail-write',
  'create-draft': 'gmail-write',
};

export function gmailActionToFunction(action: string): string {
  const fn = GMAIL_ACTION_TO_FUNCTION[action];
  if (!fn) {
    throw new Error(`Unknown Gmail action: ${action}`);
  }
  return fn;
}
