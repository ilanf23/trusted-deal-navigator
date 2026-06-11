import { cn } from '@/lib/utils';
import { GmailLabel } from './gmailHelpers';

// Gmail's default label color when the user hasn't picked one
const DEFAULT_LABEL_BG = '#e8eaed';
const DEFAULT_LABEL_TEXT = '#3c4043';

interface GmailLabelChipsProps {
  /** Label IDs present on the email (email.labels / labelIds) */
  labelIds?: string[];
  /** Map of user-created labels keyed by label id. System labels should not be in this map. */
  labelsById: Record<string, GmailLabel>;
  /** Max chips to render before collapsing into a "+N" pill */
  max?: number;
  className?: string;
}

/**
 * Renders the user's Gmail labels for an email as colored chips,
 * mirroring the colors configured in Gmail. System labels
 * (INBOX/UNREAD/CATEGORY_*) are skipped because `labelsById`
 * only contains user-created labels.
 */
export function GmailLabelChips({ labelIds, labelsById, max = 3, className }: GmailLabelChipsProps) {
  const labels = (labelIds || [])
    .map((id) => labelsById[id])
    .filter((l): l is GmailLabel => !!l);

  if (labels.length === 0) return null;

  const visible = labels.slice(0, max);
  const overflow = labels.length - visible.length;

  return (
    <span className={cn('inline-flex items-center gap-1 flex-shrink-0 min-w-0', className)}>
      {visible.map((label) => (
        <span
          key={label.id}
          title={label.name}
          className="text-[11px] leading-none px-1.5 py-[3px] rounded font-medium max-w-[120px] truncate"
          style={{
            backgroundColor: label.color?.backgroundColor || DEFAULT_LABEL_BG,
            color: label.color?.textColor || DEFAULT_LABEL_TEXT,
          }}
        >
          {label.name}
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={labels.slice(max).map((l) => l.name).join(', ')}
          className="text-[11px] leading-none px-1.5 py-[3px] rounded font-medium bg-muted text-muted-foreground flex-shrink-0"
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
