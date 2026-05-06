// Maps a Dropbox action to the edge function that handles it.
// dropbox-api was split into dropbox-files / dropbox-mutations / dropbox-search per issue #84.

const DROPBOX_ACTION_TO_FUNCTION: Record<string, 'dropbox-files' | 'dropbox-mutations' | 'dropbox-search'> = {
  // dropbox-files (read)
  'list': 'dropbox-files',
  'list-recursive': 'dropbox-files',
  'list-shared': 'dropbox-files',
  'download': 'dropbox-files',
  'get-temporary-link': 'dropbox-files',

  // dropbox-mutations (write)
  'upload': 'dropbox-mutations',
  'upload-to-lead-folder': 'dropbox-mutations',
  'move': 'dropbox-mutations',
  'rename': 'dropbox-mutations',
  'delete': 'dropbox-mutations',
  'create-folder': 'dropbox-mutations',

  // dropbox-search (DB-only)
  'link-to-lead': 'dropbox-search',
  'search-content': 'dropbox-search',
};

export function dropboxActionToFunction(action: string): string {
  const fn = DROPBOX_ACTION_TO_FUNCTION[action];
  if (!fn) {
    throw new Error(`Unknown Dropbox action: ${action}`);
  }
  return fn;
}
