import { sanitizeHtml } from '@/lib/sanitize';

// ── Shared Email type ──────────────────────────────────────────────
export interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to?: string;
  cc?: string;
  bcc?: string;
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  isStarred?: boolean;
  labels?: string[];
  senderPhoto?: string | null;
  attachments?: { name: string; type: string }[];
}

export interface ThreadMessage {
  id: string;
  from: string;
  to: string;
  date: string;
  body: string;
  senderPhoto?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────
export const extractSenderName = (from: string) => {
  const match = from.match(/^([^<]+)/);
  if (match) return match[1].trim().replace(/"/g, '');
  return from.split('@')[0];
};

export const extractEmailAddress = (from: string): string => {
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  if (from.includes('@')) return from.toLowerCase().trim();
  return '';
};

export const formatEmailDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const looksLikeHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const toRenderableHtml = (value: string) => {
  const v = value ?? '';
  if (!v.trim()) return '';
  if (looksLikeHtml(v)) return sanitizeHtml(v);
  return escapeHtml(v).replace(/\r\n/g, '\n').replace(/\n/g, '<br />');
};

// Dynamic callback URL helper
export const getGmailCallbackUrl = (pathPrefix: 'admin' | 'superadmin' = 'admin') => {
  return `${window.location.origin}/${pathPrefix}/inbox/callback`;
};
