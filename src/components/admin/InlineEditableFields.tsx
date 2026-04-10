import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Pencil, Check, Loader2, X, Tag, Lock,
} from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUndo } from '@/contexts/UndoContext';
import type { Database } from '@/integrations/supabase/types';
import { useInlineSave, persistInlineFieldChange } from './shared/useInlineSave';
import { EditableTextBox } from './shared/EditableTextBox';

// Re-export for back-compat with existing import sites
export { useInlineSave };

type LeadStatus = Database['public']['Enums']['lead_status'];

// Format phone numbers to (XXX) XXX-XXXX
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// ── Canonical 10-stage underwriting statuses ──
export const UNDERWRITING_STATUSES: LeadStatus[] = [
  'review_kill_keep',
  'initial_review',
  'waiting_on_needs_list',
  'waiting_on_client',
  'complete_files_for_review',
  'need_structure_from_brad',
  'maura_underwriting',
  'brad_underwriting',
  'need_structure',
  'underwriting_review',
  'senior_underwriting',
  'uw_paused',
  'ready_for_wu_approval',
];

export const stageConfig: Record<string, { label: string; color: string; bg: string; dot: string; pill: string }> = {
  review_kill_keep: {
    label: 'Review Kill / Keep',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
    pill: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  },
  initial_review: {
    label: 'Initial Review',
    color: 'text-sky-700 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800',
    dot: 'bg-sky-500',
    pill: 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300',
  },
  waiting_on_needs_list: {
    label: 'Waiting on Needs List',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  },
  waiting_on_client: {
    label: 'Waiting on Client',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
    pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  },
  complete_files_for_review: {
    label: 'Complete Files for Review',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  },
  need_structure_from_brad: {
    label: 'Need Structure from Brad',
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
    pill: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300',
  },
  maura_underwriting: {
    label: 'Maura Underwriting',
    color: 'text-pink-700 dark:text-pink-400',
    bg: 'bg-pink-50 dark:bg-pink-950/50 border-pink-200 dark:border-pink-800',
    dot: 'bg-pink-500',
    pill: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300',
  },
  brad_underwriting: {
    label: 'Brad Underwriting',
    color: 'text-teal-700 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
    pill: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
  },
  need_structure: {
    label: 'Need Structure',
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
    pill: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300',
  },
  underwriting_review: {
    label: 'UW Review',
    color: 'text-pink-700 dark:text-pink-400',
    bg: 'bg-pink-50 dark:bg-pink-950/50 border-pink-200 dark:border-pink-800',
    dot: 'bg-pink-500',
    pill: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300',
  },
  senior_underwriting: {
    label: 'Senior UW',
    color: 'text-teal-700 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
    pill: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
  },
  uw_paused: {
    label: 'UW Paused',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    pill: 'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300',
  },
  ready_for_wu_approval: {
    label: 'Ready for WU Approval',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  },
};

// ── Editable Deal-details row ──
export function EditableField({
  icon, label, value, field, leadId, highlight = false, onSaved, transform, tableName = 'potential',
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  leadId: string; highlight?: boolean;
  onSaved: (field: string, newValue: string) => void;
  transform?: (val: string) => unknown;
  tableName?: string;
}) {
  const { registerUndo } = useUndo();

  const handleSave = useCallback(
    async (next: string) => {
      await persistInlineFieldChange({
        leadId,
        field,
        nextValue: next,
        previousValue: value,
        onSaved,
        registerUndo,
        transform,
        tableName,
      });
    },
    [leadId, field, value, onSaved, registerUndo, transform, tableName],
  );

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors overflow-hidden ${
        highlight ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30' : ''
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        {icon}
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{label}</span>
      </div>
      <EditableTextBox
        value={value || ''}
        onSave={handleSave}
        size="sm"
        align="right"
        placeholder="—"
        className={`min-w-0 max-w-[70%] ${highlight ? 'font-bold text-blue-700 dark:text-blue-400' : 'font-medium'}`}
        aria-label={label}
      />
    </div>
  );
}

// ── Stacked editable field: label on top, large value/placeholder below ──
export function StackedEditableField({
  label, value, field, leadId, onSaved, transform, tableName = 'potential', emptyText, secondaryValue,
}: {
  label: string; value: string; field: string;
  leadId: string;
  onSaved: (field: string, newValue: string) => void;
  transform?: (val: string) => unknown;
  tableName?: string;
  /** When the value is empty: if provided, shown as a dark-foreground placeholder ("No Source"). Otherwise falls back to a muted "Add {label}" prompt. */
  emptyText?: string;
  /** Optional second line shown below the primary value in muted text (e.g., the formatted dollars below the raw number). Only rendered when value is non-empty and not editing. */
  secondaryValue?: string;
}) {
  const { registerUndo } = useUndo();

  const handleSave = useCallback(
    async (next: string) => {
      await persistInlineFieldChange({
        leadId,
        field,
        nextValue: next,
        previousValue: value,
        onSaved,
        registerUndo,
        transform,
        tableName,
      });
    },
    [leadId, field, value, onSaved, registerUndo, transform, tableName],
  );

  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-3">{label}</label>
      <EditableTextBox
        value={value || ''}
        onSave={handleSave}
        size="lg"
        placeholder={emptyText ?? `Add ${label}`}
        className="w-full"
        aria-label={label}
      />
      {value && secondaryValue && (
        <span className="block text-base font-normal leading-tight text-muted-foreground mt-1 px-3">
          {secondaryValue}
        </span>
      )}
    </div>
  );
}

// ── Stacked Select field: label on top, dropdown trigger styled as large text + chevron on right ──
export function StackedSelectField({
  label, value, options, onChange, placeholder,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-3">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-auto min-h-0 w-full gap-2 rounded-none border-0 bg-transparent p-0 text-[22px] font-normal leading-tight text-foreground shadow-none hover:bg-transparent focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground [&>svg]:opacity-60">
          <SelectValue placeholder={placeholder ?? `Select ${label}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Stacked Owner field: label on top, blue value text, X clear button on the right ──
export function StackedOwnerField({
  label, value, displayValue, options, onChange,
}: {
  label: string;
  value: string;
  displayValue: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const hasValue = Boolean(value);
  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-3">{label}</label>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            className={`h-auto min-h-0 w-full gap-2 rounded-none border-0 bg-transparent p-0 text-[22px] font-normal leading-tight shadow-none hover:bg-transparent focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 [&>svg]:hidden ${hasValue ? 'text-blue-700' : 'text-muted-foreground'}`}
          >
            <SelectValue placeholder="Unassigned">{displayValue || 'Unassigned'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasValue && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Clear ${label}`}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stacked read-only field: label (with optional padlock) on top, large value below ──
export function StackedReadOnlyField({
  label, value, locked = false, secondaryValue,
}: {
  label: string;
  value: string;
  locked?: boolean;
  /** Optional second line shown below the primary value in muted text. */
  secondaryValue?: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <label className="text-sm text-muted-foreground">{label}</label>
        {locked && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Read-only" />}
      </div>
      <p className="text-[22px] font-normal leading-tight text-foreground">{value || '—'}</p>
      {secondaryValue && (
        <p className="text-base font-normal leading-tight text-muted-foreground mt-1">{secondaryValue}</p>
      )}
    </div>
  );
}

// ── Stacked toggle field: label on the left, switch on the right, full row clickable ──
export function StackedToggleField({
  label, value, onToggle,
}: {
  label: string;
  /** Current boolean value (drives the switch position). */
  value: boolean;
  /** Called with the *new* boolean value when the user activates the switch. */
  onToggle: (next: boolean) => void | Promise<void>;
}) {
  // Local optimistic state — flips immediately on click so the visual responds even
  // before the parent's DB save / refetch round-trip completes. We re-sync to the
  // controlled `value` whenever it changes (incl. undo).
  const [optimistic, setOptimistic] = useState(value);
  useEffect(() => { setOptimistic(value); }, [value]);

  const handleClick = useCallback(() => {
    const next = !optimistic;
    setOptimistic(next);
    void onToggle(next);
  }, [optimistic, onToggle]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={label}
      onClick={handleClick}
      className="flex w-full items-center justify-between py-3 border-b border-border hover:bg-muted/40 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`h-5 w-9 rounded-full transition-colors relative shrink-0 ${optimistic ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${optimistic ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  );
}

// ── Select-based editable row (Owned By) ──
export function EditableSelectField({
  icon, label, value, displayValue, field, leadId, options, onSaved, tableName = 'potential',
}: {
  icon: React.ReactNode; label: string; value: string; displayValue: string;
  field: string; leadId: string;
  options: { value: string; label: string }[];
  onSaved: (field: string, newValue: string) => void;
  tableName?: string;
}) {
  const [saving, setSaving] = useState(false);
  const { registerUndo } = useUndo();

  const handleChange = async (newValue: string) => {
    if (newValue === value) return;
    const previousValue = value;
    setSaving(true);
    const { error } = await supabase
      .from(tableName as any)
      .update({ [field]: newValue || null })
      .eq('id', leadId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    registerUndo({
      label: `Updated ${label}`,
      execute: async () => {
        const { error: e } = await supabase.from(tableName as any).update({ [field]: previousValue || null }).eq('id', leadId);
        if (e) throw e;
        onSaved(field, previousValue);
      },
    });
    onSaved(field, newValue);
  };

  return (
    <div className="px-3 py-2 hover:bg-muted/40 transition-colors rounded-lg space-y-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="h-8 w-full text-[13px] font-medium text-foreground border-border bg-transparent shadow-none px-2.5 gap-1 rounded-lg">
            <SelectValue>{displayValue}</SelectValue>
          </SelectTrigger>
          <SelectContent className="min-w-[200px]">
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-[13px]">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
      </div>
    </div>
  );
}

// ── Editable Contact Row ──
export function EditableContactRow({
  icon, value, field, leadId, placeholder, onSaved, tableName = 'potential',
}: {
  icon: React.ReactNode; value: string; field: string;
  leadId: string; placeholder: string;
  onSaved: (field: string, newValue: string) => void;
  tableName?: string;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(leadId, field, value, onSaved, undefined, tableName);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPhone = field === 'phone';
  const displayValue = isPhone ? formatPhoneNumber(value) : value;

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
        <div className="text-blue-400 shrink-0">{icon}</div>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          onBlur={save}
          placeholder={placeholder}
          disabled={saving}
          className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer">
      <div className="text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5">{icon}</div>
      <span className={`text-[13px] break-words min-w-0 flex-1 ${value ? 'text-foreground font-medium' : 'text-muted-foreground italic'}`}>
        {displayValue || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
    </div>
  );
}

// ── Editable Tags (with autocomplete) ──
export function EditableTags({
  tags, leadId, onSaved, tableName = 'potential',
}: {
  tags: string[]; leadId: string;
  onSaved: (field: string, newValue: string) => void;
  tableName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTags, setDraftTags] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all existing tags across ALL three deal pipelines via the
  // `all_deal_tags` view created in the platform-migration migration.
  // This lets a user typing a tag in Underwriting see matches that were
  // originally coined in Potential or Lender Management, which is
  // critical for Copper parity (Copper deduplicates tags globally) and
  // for cross-pipeline reporting consistency. The per-pipeline save
  // path is unchanged — we only widen the autocomplete source.
  const { data: allExistingTags = [] } = useQuery({
    queryKey: ['all-deal-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('all_deal_tags')
        .select('tag')
        .not('tag', 'is', null);
      if (error) throw error;
      const tagSet = new Set<string>();
      (data ?? []).forEach((row) => {
        if (row.tag) tagSet.add(row.tag);
      });
      return Array.from(tagSet).sort();
    },
    staleTime: 60_000,
  });

  // Filtered suggestions
  const suggestions = inputValue.length >= 1
    ? allExistingTags
        .filter(t => t.toLowerCase().includes(inputValue.toLowerCase()))
        .filter(t => !draftTags.includes(t))
        .slice(0, 8)
    : [];

  const showSuggestions = editing && suggestions.length > 0;

  useEffect(() => {
    if (editing) {
      setDraftTags(tags);
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, tags]);

  // Position dropdown
  useEffect(() => {
    if (!showSuggestions || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [showSuggestions, inputValue]);

  const { registerUndo: registerUndoTags } = useUndo();

  const saveTags = async (newTags: string[]) => {
    const currentStr = [...tags].sort().join(',');
    const newStr = [...newTags].sort().join(',');
    if (newStr === currentStr) {
      setEditing(false);
      return;
    }
    const previousTags = [...tags];
    setSaving(true);
    const { error } = await supabase
      .from(tableName as any)
      .update({ tags: newTags.length > 0 ? newTags : null })
      .eq('id', leadId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    registerUndoTags({
      label: 'Updated tags',
      execute: async () => {
        const { error: e } = await supabase.from(tableName as any).update({ tags: previousTags.length > 0 ? previousTags : null }).eq('id', leadId);
        if (e) throw e;
        onSaved('tags', JSON.stringify(previousTags.length > 0 ? previousTags : null));
      },
    });
    onSaved('tags', JSON.stringify(newTags.length > 0 ? newTags : null));
    setEditing(false);
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || draftTags.includes(trimmed)) return;
    setDraftTags(prev => [...prev, trimmed]);
    setInputValue('');
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    setDraftTags(prev => prev.filter(t => t !== tag));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        addTag(suggestions[activeIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Escape') {
      saveTags(draftTags);
    } else if (e.key === 'Backspace' && !inputValue && draftTags.length > 0) {
      setDraftTags(prev => prev.slice(0, -1));
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    }
  };

  // Click outside to save
  useEffect(() => {
    if (!editing) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        saveTags(draftTags);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  if (editing) {
    return (
      <>
        <div ref={containerRef} className="block w-full">
          {draftTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {draftTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-1 text-sm text-foreground"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-muted-foreground/60 hover:text-foreground transition-colors"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
              placeholder="Add Tag"
              disabled={saving}
              className="flex-1 min-w-0 block text-[18px] font-normal leading-tight text-foreground bg-transparent border-0 p-0 outline-none placeholder:text-muted-foreground/60"
            />
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
        </div>

        {/* Suggestions dropdown via portal */}
        {showSuggestions && createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
            className="z-[9999] bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-[240px] overflow-y-auto"
          >
            {suggestions.map((s, i) => {
              const idx = s.toLowerCase().indexOf(inputValue.toLowerCase());
              const before = s.slice(0, idx);
              const match = s.slice(idx, idx + inputValue.length);
              const after = s.slice(idx + inputValue.length);

              return (
                <button
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                  className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] transition-colors ${
                    i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                  }`}
                >
                  <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>
                    {before}<span className="font-semibold text-blue-600 dark:text-blue-400">{match}</span>{after}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="block w-full text-left cursor-pointer"
    >
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-muted px-4 py-1 text-sm text-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <span className="block text-[18px] font-normal leading-tight text-muted-foreground/60">
        Add Tag
      </span>
    </button>
  );
}

// ── Editable Notes ──
export function EditableNotes({
  value, leadId, onSaved, tableName = 'potential',
}: {
  value: string; leadId: string;
  onSaved: (field: string, newValue: string) => void;
  tableName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const { registerUndo: registerUndoNotes } = useUndo();

  useEffect(() => {
    if (editing) {
      setDraft(value);
    }
  }, [editing, value]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    const previousValue = value;
    setSaving(true);
    const { error } = await supabase
      .from(tableName as any)
      .update({ notes: trimmed || null })
      .eq('id', leadId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    registerUndoNotes({
      label: 'Updated notes',
      execute: async () => {
        const { error: e } = await supabase.from(tableName as any).update({ notes: previousValue || null }).eq('id', leadId);
        if (e) throw e;
        onSaved('notes', previousValue);
      },
    });
    onSaved('notes', trimmed);
    setEditing(false);
  }, [draft, value, leadId, onSaved, registerUndoNotes, tableName]);

  if (editing) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3">
        <RichTextEditor
          value={draft}
          onChange={setDraft}
          placeholder="Add notes..."
          minHeight="60px"
          disabled={saving}
        />
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-blue-100">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
          <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1">
            <Check className="h-3 w-3" />Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="rounded-lg border border-border p-3 cursor-pointer hover:border-border hover:bg-muted/50 transition-all group">
      {value ? (
        <HtmlContent value={value} />
      ) : (
        <p className="text-[13px] text-muted-foreground italic">Click to add notes...</p>
      )}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Click to edit</span>
      </div>
    </div>
  );
}

// ── Editable Notes Field (parameterized — for about, history, bank_relationships) ──
export function EditableNotesField({
  value, field, leadId, placeholder, onSaved, tableName = 'potential',
}: {
  value: string; field: string; leadId: string; placeholder?: string;
  onSaved: (field: string, newValue: string) => void;
  tableName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const { registerUndo: registerUndoField } = useUndo();

  useEffect(() => {
    if (editing) {
      setDraft(value);
    }
  }, [editing, value]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    const previousValue = value;
    setSaving(true);
    const { error } = await supabase
      .from(tableName as any)
      .update({ [field]: trimmed || null })
      .eq('id', leadId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    registerUndoField({
      label: `Updated ${field}`,
      execute: async () => {
        const { error: e } = await supabase.from(tableName as any).update({ [field]: previousValue || null }).eq('id', leadId);
        if (e) throw e;
        onSaved(field, previousValue);
      },
    });
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, value, field, leadId, onSaved, registerUndoField, tableName]);

  if (editing) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3">
        <RichTextEditor
          value={draft}
          onChange={setDraft}
          placeholder={placeholder || 'Add details...'}
          minHeight="60px"
          disabled={saving}
        />
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-blue-100">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
          <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1">
            <Check className="h-3 w-3" />Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="rounded-lg border border-border p-3 cursor-pointer hover:border-border hover:bg-muted/50 transition-all group">
      {value ? (
        <HtmlContent value={value} />
      ) : (
        <p className="text-[13px] text-muted-foreground italic">{placeholder || 'Click to add...'}</p>
      )}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Click to edit</span>
      </div>
    </div>
  );
}

// ── Read-only row (Pipeline, Created) ──
export function ReadOnlyField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground w-28 shrink-0">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <span className="text-[13px] font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
