import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────
// Single source of truth for the CRM "text box" visual.
// Editing one of these constants updates every inline-editable text
// field across tables, expanded views, and detail panels.
// ─────────────────────────────────────────────────────────────────
export const EDITABLE_TEXTBOX_STYLES = {
  base: 'inline-flex items-center max-w-full transition-colors',
  /** Padding + min-height per size. Font-size is kept in `fontSize` so it can be
   *  applied to BOTH the outer span and the inner input (inputs do not reliably
   *  inherit font-size when global CSS or user-agent styles compete).
   *  Values are 70% of their original sizes (30% smaller per design update). */
  size: {
    sm: 'px-[8px] py-[3px] min-h-[18px]',
    md: 'px-[8px] py-[3px] min-h-[21px]',
    lg: 'px-[8px] py-[4px] min-h-[28px]',
  },
  fontSize: {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[15px]',
  },
  /** Idle: invisible 2px bottom border at rest; faint gray on hover.
   *  The border slot is reserved at all times so hovering and editing don't
   *  shift layout by a pixel. */
  idle: 'border-0 border-b-2 border-b-transparent hover:border-b-gray-300 dark:hover:border-b-gray-700 cursor-text',
  /** Editing: dark purple bottom border, same 2px slot as idle. */
  editing: 'border-0 border-b-2 border-b-[#3b2778] dark:border-b-[#a78bfa]',
  placeholder: 'text-muted-foreground/60',
} as const;

export type EditableTextBoxSize = keyof typeof EDITABLE_TEXTBOX_STYLES.size;

export interface EditableTextBoxProps {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  placeholder?: string;
  size?: EditableTextBoxSize;
  align?: 'left' | 'right';
  type?: 'text' | 'number' | 'email' | 'tel' | 'date';
  /** Format the value for display when not editing (e.g., currency, phone). */
  format?: (value: string) => string;
  /** Strip formatting when entering edit mode (e.g., remove "$" or ","). */
  parse?: (value: string) => string;
  disabled?: boolean;
  editOnDoubleClick?: boolean;
  /** Layout classes only — do NOT pass visual chrome (bg/border/rounded). */
  className?: string;
  /** Escape hatch for rare input-specific overrides. Prefer EDITABLE_TEXTBOX_STYLES. */
  inputClassName?: string;
  /** Optional prefix element rendered inside the pill (e.g., a DollarSign icon). */
  prefix?: React.ReactNode;
  'aria-label'?: string;
  autoFocus?: boolean;
  saving?: boolean;
}

/**
 * The canonical inline-editable text field for the CRM.
 *
 * States: idle → hover → editing → saving
 * Keyboard: Enter saves, Escape cancels, Blur saves.
 *
 * This component is a pure UI primitive. It does NOT persist to the database.
 * For DB persistence + undo, pair with `useInlineSave` from `./useInlineSave`
 * and wire its `draft`/`save`/`cancel` into this component's `onSave`.
 */
export function EditableTextBox({
  value,
  onSave,
  placeholder = '—',
  size = 'md',
  align = 'left',
  type = 'text',
  format,
  parse,
  disabled = false,
  editOnDoubleClick = false,
  className,
  inputClassName,
  prefix,
  autoFocus = true,
  saving: savingProp,
  'aria-label': ariaLabel,
}: EditableTextBoxProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [internalSaving, setInternalSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saving = savingProp ?? internalSaving;

  // Keep draft in sync when value changes externally
  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  // Focus when entering edit mode
  useEffect(() => {
    if (isEditing && autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, autoFocus]);

  const enterEdit = () => {
    if (disabled) return;
    setDraft(parse ? parse(value) : value);
    setIsEditing(true);
  };

  const commit = async () => {
    setIsEditing(false);
    if (draft === (parse ? parse(value) : value)) return;
    try {
      setInternalSaving(true);
      await onSave(draft);
    } finally {
      setInternalSaving(false);
    }
  };

  const cancel = () => {
    setDraft(parse ? parse(value) : value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editOnDoubleClick) enterEdit();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editOnDoubleClick) enterEdit();
  };

  const sizeClasses = EDITABLE_TEXTBOX_STYLES.size[size];
  const fontSizeClass = EDITABLE_TEXTBOX_STYLES.fontSize[size];
  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  const justifyClass = align === 'right' ? 'justify-end' : 'justify-start';

  if (isEditing) {
    return (
      <span
        className={cn(
          EDITABLE_TEXTBOX_STYLES.base,
          sizeClasses,
          fontSizeClass,
          EDITABLE_TEXTBOX_STYLES.editing,
          justifyClass,
          className,
        )}
      >
        {prefix}
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          disabled={saving}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={cn(
            'editable-textbox-input flex-1 min-w-0 bg-transparent outline-none border-0 p-0',
            fontSizeClass,
            alignClass,
            inputClassName,
          )}
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-[#0066FF] shrink-0 ml-1" />}
      </span>
    );
  }

  const displayValue = value ? (format ? format(value) : value) : '';

  return (
    <span
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        EDITABLE_TEXTBOX_STYLES.base,
        sizeClasses,
        fontSizeClass,
        EDITABLE_TEXTBOX_STYLES.idle,
        justifyClass,
        disabled && 'cursor-default opacity-60 hover:bg-transparent',
        className,
      )}
      title={editOnDoubleClick ? 'Double-click to edit' : 'Click to edit'}
      aria-label={ariaLabel}
    >
      {prefix}
      <span className={cn('truncate', fontSizeClass, alignClass, !displayValue && EDITABLE_TEXTBOX_STYLES.placeholder)}>
        {displayValue || placeholder}
      </span>
      {saving && <Loader2 className="h-3 w-3 animate-spin text-[#0066FF] shrink-0 ml-1" />}
    </span>
  );
}
