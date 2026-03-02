import { sanitizeHtml } from '@/lib/sanitize';
import { cn } from '@/lib/utils';

interface HtmlContentProps {
  value: string;
  className?: string;
}

/** Detect whether a string contains actual HTML tags */
function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*?>/i.test(str);
}

/**
 * Safely renders stored HTML content.
 * Falls back to whitespace-pre-wrap for plain-text (backward compat).
 */
export function HtmlContent({ value, className }: HtmlContentProps) {
  if (!value) return null;

  if (!isHtml(value)) {
    return (
      <div className={cn('text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap', className)}>
        {value}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'text-[13px] text-foreground/80 leading-relaxed',
        'prose prose-sm max-w-none',
        'prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-1',
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono',
        'prose-a:text-blue-600 prose-a:underline',
        'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:text-muted-foreground',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
    />
  );
}
