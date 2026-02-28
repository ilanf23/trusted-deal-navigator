import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pencil, Check, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type LeadStatus = Database['public']['Enums']['lead_status'];

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

// ── Generic inline-save helper ──
export function useInlineSave(
  leadId: string,
  field: string,
  currentValue: string,
  onSaved: (field: string, newValue: string) => void,
  transform?: (val: string) => unknown,
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setDraft(currentValue);
  }, [editing, currentValue]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === currentValue) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const saveValue = transform ? transform(trimmed) : (trimmed || null);
    const { error } = await supabase
      .from('leads')
      .update({ [field]: saveValue })
      .eq('id', leadId);
    setSaving(false);
    if (error) {
      console.error('InlineEditableFields save error:', { field, leadId, saveValue, error });
      toast.error('Failed to save');
      return;
    }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, currentValue, field, leadId, onSaved, transform]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}

// ── Editable Deal-details row ──
export function EditableField({
  icon, label, value, field, leadId, highlight = false, onSaved, transform,
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  leadId: string; highlight?: boolean;
  onSaved: (field: string, newValue: string) => void;
  transform?: (val: string) => unknown;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(leadId, field, value, onSaved, transform);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-1.5 bg-violet-50/50">
        <div className="flex items-center gap-2 text-violet-400 shrink-0">
          {icon}
          <span className="text-xs font-medium text-violet-500">{label}</span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 justify-end">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            onBlur={save}
            disabled={saving}
            className="w-full text-right text-[13px] font-medium text-foreground bg-card border border-violet-200 dark:border-violet-800 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all"
          />
          {saving && <Loader2 className="h-3 w-3 animate-spin text-violet-500 shrink-0" />}
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="flex items-center justify-between px-3.5 py-2.5 bg-card hover:bg-muted/50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-[13px] text-right truncate max-w-[170px] ${highlight ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-medium text-foreground'}`}>
          {value || '—'}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}

// ── Select-based editable row (Owned By) ──
export function EditableSelectField({
  icon, label, value, displayValue, field, leadId, options, onSaved,
}: {
  icon: React.ReactNode; label: string; value: string; displayValue: string;
  field: string; leadId: string;
  options: { value: string; label: string }[];
  onSaved: (field: string, newValue: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (newValue: string) => {
    if (newValue === value) return;
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ [field]: newValue || null })
      .eq('id', leadId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved(field, newValue);
  };

  return (
    <div className="flex items-center justify-between px-3.5 py-2 bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="h-7 w-auto min-w-[100px] text-[13px] font-medium text-foreground border-transparent hover:border-border bg-transparent shadow-none px-2 gap-1">
            <SelectValue>{displayValue}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-violet-500 shrink-0" />}
      </div>
    </div>
  );
}

// ── Editable Contact Row ──
export function EditableContactRow({
  icon, value, field, leadId, placeholder, onSaved,
}: {
  icon: React.ReactNode; value: string; field: string;
  leadId: string; placeholder: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(leadId, field, value, onSaved);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-violet-50/50 border border-violet-100">
        <div className="text-violet-400 shrink-0">{icon}</div>
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
        {saving && <Loader2 className="h-3 w-3 animate-spin text-violet-500 shrink-0" />}
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group cursor-pointer">
      <div className="text-muted-foreground group-hover:text-foreground shrink-0">{icon}</div>
      <span className={`text-[13px] truncate flex-1 ${value ? 'text-foreground font-medium' : 'text-muted-foreground italic'}`}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

// ── Editable Tags ──
export function EditableTags({
  tags, leadId, onSaved,
}: {
  tags: string[]; leadId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags.join(', '));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(tags.join(', '));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, tags]);

  const save = async () => {
    const newTags = draft.split(',').map(t => t.trim()).filter(Boolean);
    const currentStr = tags.join(',');
    const newStr = newTags.join(',');
    if (newStr === currentStr) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ tags: newTags.length > 0 ? newTags : null })
      .eq('id', leadId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved('tags', JSON.stringify(newTags.length > 0 ? newTags : null));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg bg-violet-50/50 border border-violet-100 p-2.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={save}
          placeholder="tag1, tag2, tag3..."
          disabled={saving}
          className="w-full text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
        <p className="text-[10px] text-muted-foreground mt-1">Comma-separated. Press Enter to save.</p>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-violet-500 mt-1" />}
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer group">
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 items-center">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[11px] px-2.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800 font-medium">
              {tag}
            </Badge>
          ))}
          <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground italic">No tags</p>
          <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      )}
    </div>
  );
}

// ── Editable Notes ──
export function EditableNotes({
  value, leadId, onSaved,
}: {
  value: string; leadId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) { el.focus(); el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
      }, 0);
    }
  }, [editing, value]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ notes: trimmed || null })
      .eq('id', leadId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    onSaved('notes', trimmed);
    setEditing(false);
  }, [draft, value, leadId, onSaved]);

  if (editing) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-3">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
          disabled={saving}
          placeholder="Add notes..."
          className="w-full text-[13px] text-foreground/80 leading-relaxed bg-transparent outline-none resize-none placeholder:text-muted-foreground/50"
          rows={3}
        />
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-violet-100">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-violet-500" />}
          <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1">
            <Check className="h-3 w-3" />Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="rounded-xl border border-border bg-muted/30 p-3.5 cursor-pointer hover:border-border hover:bg-muted/50 transition-all group">
      {value ? (
        <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{value}</p>
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

// ── Read-only row (Pipeline, Created) ──
export function ReadOnlyField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 bg-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <span className="text-[13px] font-medium text-foreground text-right truncate max-w-[180px]">{value}</span>
    </div>
  );
}
