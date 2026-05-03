import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  title: string;
  description?: string;
  /** Right-aligned action slot in the header (e.g. "+ New template"). */
  actions?: React.ReactNode;
  /** When true, the sticky save bar at the bottom is shown. */
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onReset?: () => void;
  saveLabel?: string;
  resetLabel?: string;
  children: React.ReactNode;
  /** Set to false to opt out of the default header divider. */
  divider?: boolean;
  className?: string;
}

const SettingsSection = ({
  title,
  description,
  actions,
  isDirty = false,
  isSaving = false,
  onSave,
  onReset,
  saveLabel = 'Save changes',
  resetLabel = 'Discard',
  children,
  divider = true,
  className,
}: SettingsSectionProps) => {
  return (
    <section className={cn('relative', className)}>
      <header
        className={cn(
          'flex items-start justify-between gap-4 pb-4',
          divider && 'border-b border-border mb-6'
        )}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </header>

      <div className={cn(isDirty && 'pb-20')}>{children}</div>

      {isDirty && onSave && (
        <div
          className="sticky bottom-0 left-0 right-0 -mx-6 mt-6 px-6 py-3 bg-card/95 backdrop-blur border-t border-border flex items-center justify-end gap-2 z-10"
          role="region"
          aria-label="Unsaved changes"
        >
          <p className="text-xs text-muted-foreground mr-auto">
            You have unsaved changes.
          </p>
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} disabled={isSaving}>
              {resetLabel}
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="bg-[#3b2778] hover:bg-[#2e1d5e] text-white"
          >
            {isSaving ? 'Saving…' : saveLabel}
          </Button>
        </div>
      )}
    </section>
  );
};

export default SettingsSection;
