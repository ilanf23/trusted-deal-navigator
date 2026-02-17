import DOMPurify from 'dompurify';

/**
 * Sanitize untrusted HTML (e.g. email bodies) using DOMPurify.
 * Strips scripts, iframes, forms, event handlers, javascript: URIs,
 * and inline color styles so dark-mode prose-invert can apply proper contrast.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  const clean = DOMPurify.sanitize(dirty, {
    // Block dangerous tags
    FORBID_TAGS: ['script', 'iframe', 'form', 'object', 'embed', 'style'],
    // Block all event-handler attributes
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    // Allow safe URI schemes only
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });

  // Strip inline color styles so dark mode text colors work
  return clean
    .replace(/\bcolor\s*:\s*[^;}"']+;?/gi, '')
    .replace(/\bbackground-color\s*:\s*[^;}"']+;?/gi, '')
    .replace(/\bbackground\s*:\s*[^;}"']+;?/gi, '');
}
