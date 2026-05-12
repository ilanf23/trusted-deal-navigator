import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { isHtmlEmpty } from '@/lib/sanitize';
import { EntityFilesSection } from '@/components/admin/files/EntityFilesSection';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import {
  X, ChevronDown, ChevronRight, ChevronUp,
  Users, Building2, FileText, CheckSquare,
  CalendarDays, Plus, Pencil, Activity, Clock, AlertCircle, MessageSquare,
  User, Mail, Phone, Tag, Briefcase, Loader2,
  Globe, DollarSign, Check,
} from 'lucide-react';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { useUndo } from '@/contexts/UndoContext';
import { useCall } from '@/contexts/CallContext';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { differenceInDays, parseISO, format } from 'date-fns';
import {
  formatPhoneNumber,
  StackedEditableField,
  StackedSelectField,
  StackedOwnerField,
  StackedReadOnlyField,
  EditableTags as InlineEditableTags,
  EditableNotesField,
} from './InlineEditableFields';

/* ─── Types ─── */

interface Company {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  direct_phone: string | null;
  fax_phone: string | null;
  email_domain: string | null;
  website: string | null;
  contact_type: string | null;
  social_linkedin: string | null;
  address: string | null;
  description: string | null;
  visibility: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  notes: string | null;
  source: string | null;
  last_activity_at: string | null;
  last_contacted: string | null;
  clx_file_name: string | null;
  about: string | null;
  history: string | null;
  created_at: string;
  updated_at: string;
  deals_count?: number;
}

/* ─── Constants ─── */

const CONTACT_TYPES = ['Client', 'Prospect', 'Referral Partner', 'Lender', 'Attorney', 'CPA', 'Vendor', 'Other'];

const contactTypeConfig: Record<string, { label: string; color: string; bg: string; dot: string; pill: string }> = {
  Client: { label: 'Client', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500', pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  Prospect: { label: 'Prospect', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', dot: 'bg-blue-500', pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  'Referral Partner': { label: 'Referral Partner', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  Lender: { label: 'Lender', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800', dot: 'bg-violet-500', pill: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  Attorney: { label: 'Attorney', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800', dot: 'bg-rose-500', pill: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
  CPA: { label: 'CPA', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800', dot: 'bg-cyan-500', pill: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  Vendor: { label: 'Vendor', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800', dot: 'bg-orange-500', pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  Other: { label: 'Other', color: 'text-slate-700 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800', dot: 'bg-slate-500', pill: 'bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300' },
};

/* ─── Helpers ─── */

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try { return differenceInDays(new Date(), parseISO(dateStr)); } catch { return null; }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return '\u2014'; }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try { return format(parseISO(dateStr), 'M/d/yyyy'); } catch { return '\u2014'; }
}

const ACTIVITY_TYPE_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  call: { icon: Phone, color: 'text-blue-500' },
  email: { icon: Mail, color: 'text-emerald-500' },
  meeting: { icon: Users, color: 'text-blue-500' },
  note: { icon: Pencil, color: 'text-amber-500' },
  todo: { icon: CheckSquare, color: 'text-muted-foreground' },
  follow_up: { icon: Users, color: 'text-blue-500' },
};

/* ─── Inline Save Hook (companies table) ─── */

// Map Company field names to companies table column names
const FIELD_TO_COLUMN: Record<string, string> = {
  contact_name: 'name',
};

function useInlineSave(
  companyId: string,
  field: string,
  currentValue: string,
  onSaved: (field: string, newValue: string) => void,
  transform?: (val: string) => unknown,
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const { registerUndo } = useUndo();

  useEffect(() => {
    if (editing) setDraft(currentValue);
  }, [editing, currentValue]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === currentValue) {
      setEditing(false);
      return;
    }
    // email_domain is derived from email, not a direct column
    if (field === 'email_domain') {
      toast.info('Email domain is derived from the company email');
      setEditing(false);
      return;
    }
    const previousValue = currentValue;
    setSaving(true);
    const saveValue = transform ? transform(trimmed) : (trimmed || null);
    const dbField = FIELD_TO_COLUMN[field] ?? field;
    const { error } = await supabase
      .from('companies')
      .update({ [dbField]: saveValue } as any)
      .eq('id', companyId);
    setSaving(false);
    if (error) {
      console.error('CompanyExpandedView save error:', { field: dbField, companyId, saveValue, error });
      toast.error('Failed to save');
      return;
    }
    registerUndo({
      label: `Updated ${field}`,
      execute: async () => {
        const restoreValue = transform ? transform(previousValue) : (previousValue || null);
        const { error: e } = await supabase.from('companies').update({ [dbField]: restoreValue } as any).eq('id', companyId);
        if (e) throw e;
        onSaved(field, previousValue);
      },
    });
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, currentValue, field, companyId, onSaved, transform, registerUndo]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}

/* ─── Editable Field ─── */

function EditableField({
  icon, label, value, field, companyId, highlight = false, onSaved, transform,
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  companyId: string; highlight?: boolean;
  onSaved: (field: string, newValue: string) => void;
  transform?: (val: string) => unknown;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(companyId, field, value, onSaved, transform);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-2 text-blue-400 shrink-0">
          {icon}
          <span className="text-xs font-medium text-blue-500">{label}</span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 justify-end">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            onBlur={save}
            disabled={saving}
            className="w-full text-right text-[13px] font-medium text-foreground bg-transparent border-0 border-b border-b-primary/30 rounded-none px-0 py-0 outline-none focus:border-b-primary focus:ring-0 transition-colors"
          />
          {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer group ${highlight ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30' : 'hover:bg-muted/40'}`}>
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        {icon}
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-[13px] text-right truncate ${highlight ? 'font-bold text-blue-700 dark:text-blue-400' : 'font-medium text-foreground'}`}>
          {value || '\u2014'}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}

/* ─── Editable Contact Row ─── */

function EditableContactRow({
  icon, value, field, companyId, placeholder, onSaved,
}: {
  icon: React.ReactNode; value: string; field: string;
  companyId: string; placeholder: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(companyId, field, value, onSaved);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPhone = field === 'phone';
  const displayValue = isPhone ? formatPhoneNumber(value) : value;

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
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
    <div onClick={() => setEditing(true)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer">
      <div className="text-muted-foreground group-hover:text-foreground shrink-0">{icon}</div>
      <span className={`text-[13px] truncate flex-1 ${value ? 'text-foreground font-medium' : 'text-muted-foreground italic'}`}>
        {displayValue || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

/* ─── Editable Tags ─── */

function EditableTags({
  tags, companyId, onSaved,
}: {
  tags: string[]; companyId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags.join(', '));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(tags.join(', '));
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
  }, [editing, tags]);

  const { registerUndo: registerUndoTags } = useUndo();

  const save = async () => {
    const newTags = draft.split(',').map(t => t.trim()).filter(Boolean);
    const currentStr = tags.join(',');
    const newStr = newTags.join(',');
    if (newStr === currentStr) {
      setEditing(false);
      return;
    }
    const previousTags = [...tags];
    setSaving(true);
    const { error } = await supabase
      .from('companies')
      .update({ tags: newTags.length > 0 ? newTags : null })
      .eq('id', companyId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    registerUndoTags({
      label: 'Updated tags',
      execute: async () => {
        const { error: e } = await supabase.from('companies').update({ tags: previousTags.length > 0 ? previousTags : null }).eq('id', companyId);
        if (e) throw e;
        onSaved('tags', JSON.stringify(previousTags.length > 0 ? previousTags : null));
      },
    });
    onSaved('tags', JSON.stringify(newTags.length > 0 ? newTags : null));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg p-2.5">
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
        {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 mt-1" />}
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer group">
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 items-center">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-medium">
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

/* ─── Editable Notes ─── */

function EditableNotes({
  value, companyId, onSaved,
}: {
  value: string; companyId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setDraft(value);
  }, [editing, value]);

  const { registerUndo: registerUndoNotes } = useUndo();

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    const previousValue = value;
    setSaving(true);
    const { error } = await supabase
      .from('companies')
      .update({ notes: trimmed || null } as any)
      .eq('id', companyId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    registerUndoNotes({
      label: 'Updated notes',
      execute: async () => {
        const { error: e } = await supabase.from('companies').update({ notes: previousValue || null } as any).eq('id', companyId);
        if (e) throw e;
        onSaved('notes', previousValue);
      },
    });
    onSaved('notes', trimmed);
    setEditing(false);
  }, [draft, value, companyId, onSaved, registerUndoNotes]);

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

/* ─── Read-only Field ─── */

function ReadOnlyField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

/* ─── Stats Card ─── */

function StatBox({ value, label, icon, bg, border, valueColor, iconBg }: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
  valueColor: string;
  iconBg: string;
}) {
  return (
    <div className={`relative flex flex-col gap-0.5 rounded-lg px-3.5 py-2.5 border-2 ${bg} ${border} min-w-0 flex-1 shadow-sm`}>
      <span className={`absolute top-2 right-2.5 h-6 w-6 rounded-full flex items-center justify-center ${iconBg}`}>{icon}</span>
      <span className={`text-xl font-extrabold tabular-nums leading-tight ${valueColor}`}>{value}</span>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}

/* ─── Related Section ─── */

function RelatedSection({ icon, label, count, iconColor, onAdd, children }: {
  icon: React.ReactNode; label: string; count: number; iconColor?: string; onAdd?: () => void; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-4 rounded-lg transition-colors">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className={iconColor}>{icon}</span> {label}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
          {count}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 ml-auto text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            if (onAdd) onAdd();
            else toast.info('Coming soon');
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ─── Main Component ─── */

export default function CompanyExpandedView() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerUndo, isUndoingRef } = useUndo();
  const { setSearchComponent } = useAdminTopBar();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    );
    return () => setSearchComponent(null);
  }, [searchTerm]);

  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');

  // Activity form state
  const [activityType, setActivityType] = useState('todo');
  const [activityNote, setActivityNote] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);

  // Activity expand / comments state
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);

  // Task inline add state
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const { teamMember } = useTeamMember();

  /* ── Field saved handler ── */
  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    if (!isUndoingRef.current) toast.success('Updated');
  }, [companyId, queryClient, isUndoingRef]);

  /* ── Contact type change ── */
  const handleContactTypeChange = useCallback(async (newType: string) => {
    if (!companyId) return;
    const { data: current } = await supabase.from('companies').select('contact_type').eq('id', companyId).single();
    const previousType = current?.contact_type ?? null;
    const { error } = await supabase
      .from('companies')
      .update({ contact_type: newType })
      .eq('id', companyId);
    if (error) {
      toast.error('Failed to update contact type');
      return;
    }
    registerUndo({
      label: `Contact type changed to ${newType}`,
      execute: async () => {
        const { error: e } = await supabase.from('companies').update({ contact_type: previousType }).eq('id', companyId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
        queryClient.invalidateQueries({ queryKey: ['companies'] });
      },
    });
    toast.success('Contact type updated');
    queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
  }, [companyId, queryClient, registerUndo]);

  /* ── Owner change ── */
  const handleOwnerChange = useCallback(async (newOwner: string) => {
    if (!companyId) return;
    const { data: current } = await supabase.from('companies').select('assigned_to').eq('id', companyId).single();
    const previousOwner = current?.assigned_to ?? null;
    const { error } = await supabase
      .from('companies')
      .update({ assigned_to: newOwner || null } as any)
      .eq('id', companyId);
    if (error) {
      toast.error('Failed to update owner');
      return;
    }
    registerUndo({
      label: 'Owner updated',
      execute: async () => {
        const { error: e } = await supabase.from('companies').update({ assigned_to: previousOwner } as any).eq('id', companyId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
        queryClient.invalidateQueries({ queryKey: ['companies'] });
      },
    });
    toast.success('Owner updated');
    queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
  }, [companyId, queryClient, registerUndo]);

  /* ── Click-to-call for the Primary Contact phone row. Matches the pattern
       used by the deal pipeline expanded views so the left column behaves
       consistently — phone rows dial through the global CallContext. ── */
  const { makeOutboundCall } = useCall();
  const handleCallPhone = useCallback((phone: string) => {
    void makeOutboundCall(phone, companyId, undefined);
  }, [makeOutboundCall, companyId]);

  /* ── Save activity ── */
  const handleSaveActivity = useCallback(async () => {
    if (!companyId) return;
    const rawContent = activityTab === 'log' ? activityNote : noteContent;
    const content = rawContent.trim();
    const type = activityTab === 'log' ? activityType : 'note';
    if (!content || isHtmlEmpty(content)) {
      toast.error('Please enter some content');
      return;
    }
    setSavingActivity(true);
    const { error } = await supabase.from('activities').insert({
      entity_id: companyId,
      entity_type: 'companies',
      activity_type: type,
      content,
      title: type === 'note' ? 'Note' : type.charAt(0).toUpperCase() + type.slice(1),
    });
    setSavingActivity(false);
    if (error) {
      toast.error('Failed to save activity');
      return;
    }
    // Update last_activity_at
    await supabase.from('companies').update({ last_activity_at: new Date().toISOString() } as any).eq('id', companyId);
    toast.success('Activity saved');
    if (activityTab === 'log') setActivityNote('');
    else setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['company-activities', companyId] });
    queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
  }, [companyId, activityTab, activityType, activityNote, noteContent, queryClient]);

  /* ── Save activity comment ── */
  const handleSaveComment = useCallback(async (activityId: string) => {
    const text = (commentTexts[activityId] ?? '').trim();
    if (!text || !companyId) return;
    setSavingComment(activityId);
    const { error } = await supabase.from('activity_comments').insert({
      activity_id: activityId,
      lead_id: companyId,
      content: text,
      created_by: teamMember?.name ?? null,
    });
    setSavingComment(null);
    if (error) {
      toast.error('Failed to save comment');
      return;
    }
    setCommentTexts((prev) => ({ ...prev, [activityId]: '' }));
    queryClient.invalidateQueries({ queryKey: ['company-activity-comments', companyId] });
  }, [companyId, commentTexts, teamMember, queryClient]);

  /* ── Save task ── */
  const handleSaveTask = useCallback(async () => {
    if (!companyId || !newTaskTitle.trim()) return;
    setSavingTask(true);
    const { error } = await supabase.from('tasks').insert({
      title: newTaskTitle.trim(),
      status: 'todo',
      priority: 'medium',
      description: `Related to company: ${companyId}`,
    });
    setSavingTask(false);
    if (error) {
      toast.error('Failed to create task');
      return;
    }
    toast.success('Task created');
    setNewTaskTitle('');
    setAddingTask(false);
    queryClient.invalidateQueries({ queryKey: ['company-tasks', companyId] });
  }, [companyId, newTaskTitle, queryClient]);

  /* ── Queries ── */

  const { data: company, isLoading } = useQuery({
    queryKey: ['company-expanded', companyId],
    queryFn: async () => {
      const { data: companyRow, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId!)
        .single();
      if (error) throw error;

      const row = companyRow as any;
      return {
        id: row.id,
        company_name: row.company_name || row.name,
        contact_name: row.name,
        phone: row.phone ?? null,
        direct_phone: row.direct_phone ?? null,
        fax_phone: row.fax_phone ?? null,
        website: row.website ?? row.work_website ?? null,
        email_domain: row.email_domain ?? (row.email ? row.email.split('@')[1] || null : null),
        contact_type: row.contact_type,
        social_linkedin: row.social_linkedin ?? null,
        address: row.address ?? null,
        description: row.description ?? null,
        visibility: row.visibility ?? null,
        tags: row.tags,
        assigned_to: row.assigned_to,
        notes: row.notes,
        source: row.source,
        last_activity_at: row.last_activity_at,
        last_contacted: row.last_contacted ?? null,
        clx_file_name: row.clx_file_name ?? null,
        about: row.about ?? null,
        history: row.history ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deals_count: row.deals_count ?? 0,
      } as Company;
    },
    enabled: !!companyId,
  });

  const { data: teamMembers = [] } = useAssignableUsers();

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  // Related people (people table where company_name matches)
  const { data: relatedPeople = [] } = useQuery({
    queryKey: ['company-related-people', company?.company_name],
    queryFn: async () => {
      if (!company?.company_name) return [];
      const { data } = await supabase
        .from('people')
        .select('id, name, title, email, phone')
        .eq('company_name', company.company_name)
        .order('name');
      return data ?? [];
    },
    enabled: !!company?.company_name,
  });

  // Related deals (pipeline table where company_name matches)
  const { data: relatedDeals = [] } = useQuery({
    queryKey: ['company-related-deals', company?.company_name],
    queryFn: async () => {
      if (!company?.company_name) return [];
      const { data } = await supabase
        .from('potential')
        .select('id, name, status, deal_value, assigned_to')
        .eq('company_name', company.company_name)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!company?.company_name,
  });

  // Company activities
  const { data: activities = [] } = useQuery({
    queryKey: ['company-activities', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('entity_id', companyId!)
        .eq('entity_type', 'companies')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Activity comments
  const { data: activityCommentsMap = {} } = useQuery({
    queryKey: ['company-activity-comments', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_comments')
        .select('*')
        .eq('lead_id', companyId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      for (const c of data ?? []) {
        (map[c.activity_id] ??= []).push(c);
      }
      return map;
    },
    enabled: !!companyId,
  });

  // Tasks (tasks related to this company via description)
  const { data: tasks = [] } = useQuery({
    queryKey: ['company-tasks', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, priority')
        .ilike('description', `%${companyId}%`)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  /* ── Loading state ── */

  if (isLoading || !company) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  const assignedName = company.assigned_to ? (teamMemberMap[company.assigned_to] ?? '\u2014') : '\u2014';
  const inactiveDays = daysSince(company.last_activity_at ?? company.last_contacted);
  const typeCfg = contactTypeConfig[company.contact_type ?? ''];
  const ownerOptions = teamMembers.map((m) => ({ value: m.id, label: m.name }));
  const contactTypeOptions = CONTACT_TYPES.map((ct) => ({ value: ct, label: contactTypeConfig[ct]?.label ?? ct }));

  function goBack() {
    navigate('/admin/contacts/companies');
  }

  return (
    <div data-full-bleed className="company-expanded-view system-font flex flex-col bg-background md:overflow-hidden overflow-y-auto h-[calc(100vh-3.5rem)]">
      <style>{`
        .company-expanded-view,
        .company-expanded-view *:not(svg):not(svg *) {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        }
        .company-expanded-view [data-radix-scroll-area-viewport] {
          overflow-x: hidden !important;
        }
      `}</style>
      {/* ── 3-Column Body ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden">

        {/* LEFT: Company Details — structured to match ExpandedLeftColumn (Pipeline). Plain div w/
            native overflow so long unbroken values don't push the column wider; Radix
            ScrollArea's table-display viewport doesn't constrain inner width. */}
        <div className="w-full md:w-[255px] lg:w-[323px] xl:w-[408px] md:shrink-0 md:min-w-[204px] min-w-0 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto overflow-x-hidden">
          <div className="px-4 md:pl-6 md:pr-4 lg:pl-8 lg:pr-5 xl:pl-11 xl:pr-6 py-6 space-y-6">

            {/* ── Close (X) ── */}
            <button
              onClick={goBack}
              className="flex items-center text-muted-foreground hover:text-foreground transition-colors -ml-2 py-1"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* ── Contact Card Header ── */}
            <div className="flex items-start gap-4">
              <CrmAvatar name={company.company_name} size="xl" />
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-xl font-semibold text-foreground break-words leading-tight">{company.company_name}</h2>
                {company.contact_name && (
                  <p className="text-sm text-muted-foreground mt-0.5 break-words">{company.contact_name}</p>
                )}
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground bg-muted/50">
                    <Building2 className="h-3 w-3" />
                    Company
                  </span>
                </div>
              </div>
            </div>

            {/* Name */}
            <StackedEditableField
              label="Name"
              value={company.company_name}
              field="company_name"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* CLX - File Name */}
            <StackedEditableField
              label="CLX - File Name"
              value={company.clx_file_name ?? ''}
              field="clx_file_name"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* Phone (Work Phone) */}
            <StackedEditableField
              label="Phone (Work Phone)"
              value={company.phone ? formatPhoneNumber(company.phone) : ''}
              field="phone"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* Primary Contact — visually mirrors the deal-pipeline left column:
                avatar + name row, then click-to-call phone and mailto email
                rows as hoverable buttons. */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Primary Contact</label>
              <div className="border-b border-border pb-3">
                {company.contact_name ? (
                  <div className="flex items-start gap-3 px-1 py-1.5">
                    <CrmAvatar name={company.contact_name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-base text-foreground break-words">{company.contact_name}</p>
                      {company.company_name && (
                        <p className="text-xs text-muted-foreground break-words">{company.company_name}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-1 py-1.5">
                    <p className="text-sm text-muted-foreground italic">No primary contact</p>
                  </div>
                )}
                {company.phone && (
                  <button
                    type="button"
                    onClick={() => handleCallPhone(company.phone!)}
                    className="w-full flex items-start gap-2 px-1 py-1 min-w-0 text-left rounded hover:bg-muted/60 transition-colors"
                    title={`Call ${formatPhoneNumber(company.phone)}`}
                  >
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    <span className="text-sm text-foreground min-w-0 flex-1 whitespace-nowrap">{formatPhoneNumber(company.phone)}</span>
                  </button>
                )}
                {company.email_domain && (
                  <a
                    href={`mailto:${company.email_domain}`}
                    className="w-full flex items-start gap-2 px-1 py-1 min-w-0 text-left rounded hover:bg-muted/60 transition-colors"
                    title={`Email ${company.email_domain}`}
                  >
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    <span className="text-sm text-foreground break-all min-w-0 flex-1">{company.email_domain}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Direct Phone */}
            <StackedEditableField
              label="Direct Phone"
              value={company.direct_phone ? formatPhoneNumber(company.direct_phone) : ''}
              field="direct_phone"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* Fax Phone */}
            <StackedEditableField
              label="Fax Phone"
              value={company.fax_phone ? formatPhoneNumber(company.fax_phone) : ''}
              field="fax_phone"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* Owner */}
            {ownerOptions.length > 0 ? (
              <StackedOwnerField
                label="Owner"
                value={company.assigned_to ?? ''}
                displayValue={assignedName}
                options={ownerOptions}
                onChange={(v) => { void handleOwnerChange(v); }}
              />
            ) : (
              <StackedReadOnlyField label="Owner" value={assignedName} />
            )}

            {/* Website (Work Website) */}
            <StackedEditableField
              label="Website (Work Website)"
              value={company.website ?? ''}
              field="website"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* Contact Type */}
            <StackedSelectField
              label="Contact Type"
              value={company.contact_type ?? ''}
              options={contactTypeOptions}
              onChange={handleContactTypeChange}
            />

            {/* Email Domain */}
            <StackedEditableField
              label="Email Domain"
              value={company.email_domain ?? ''}
              field="email_domain"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* Social (LinkedIn) */}
            <StackedEditableField
              label="Social (LinkedIn)"
              value={company.social_linkedin ?? ''}
              field="social_linkedin"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* Address */}
            <StackedEditableField
              label="Address"
              value={company.address ?? ''}
              field="address"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* Description */}
            <StackedEditableField
              label="Description"
              value={company.description ?? ''}
              field="description"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
            />

            {/* Visibility */}
            <StackedEditableField
              label="Visibility"
              value={company.visibility ?? ''}
              field="visibility"
              leadId={company.id}
              onSaved={handleFieldSaved}
              tableName="companies"
              emptyText="Everyone"
            />

            {/* Tags */}
            <div>
              <label className="text-sm text-muted-foreground block mb-3">Tags</label>
              <InlineEditableTags tags={company.tags ?? []} leadId={company.id} onSaved={handleFieldSaved} tableName="companies" />
            </div>

            {/* Last Contacted */}
            <StackedReadOnlyField
              label="Last Contacted"
              value={formatDate(company.last_contacted ?? company.last_activity_at)}
              locked
            />

            {/* About */}
            <div>
              <label className="text-sm text-muted-foreground block mb-3">About</label>
              <EditableNotesField value={company.about ?? ''} field="about" leadId={company.id} placeholder="Add About" onSaved={handleFieldSaved} tableName="companies" />
            </div>

            {/* History */}
            <div>
              <label className="text-sm text-muted-foreground block mb-3">History</label>
              <EditableNotesField value={company.history ?? ''} field="history" leadId={company.id} placeholder="Add History" onSaved={handleFieldSaved} tableName="companies" />
            </div>

          </div>
        </div>

        {/* MIDDLE: Activity */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f5f0fa] dark:bg-purple-950/20">
          <ScrollArea className="flex-1">
            <div className="px-3 md:px-4 lg:px-6 pt-5">
              {/* Stats — floating card */}
              <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card mb-5">
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">{inactiveDays ?? '\u2014'}</span>
                  <span className="text-[11px] text-muted-foreground">Inactive Days</span>
                </div>
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">{relatedPeople.length}</span>
                  <span className="text-[11px] text-muted-foreground">Related People</span>
                </div>
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">{relatedDeals.length}</span>
                  <span className="text-[11px] text-muted-foreground">Related Deals</span>
                </div>
              </div>

              {/* Activity tabs + form — floating card */}
              <div className="rounded-lg border border-border bg-card overflow-hidden mb-5">
                <div className="flex items-stretch border-b border-gray-200 dark:border-border">
                  {([
                    { key: 'log' as const, label: 'Log Activity' },
                    { key: 'note' as const, label: 'Create Note' },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                        activityTab === tab.key
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setActivityTab(tab.key)}
                    >
                      {tab.label}
                      {activityTab === tab.key && (
                        <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-700 dark:bg-blue-500" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5">
              {activityTab === 'log' ? (
                <div className="space-y-4">
                  {/* Activity type dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setActivityDropdownOpen(!activityDropdownOpen)}
                      className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border hover:bg-muted/40 transition-colors text-sm font-medium text-foreground"
                    >
                      {(() => {
                        const types: Record<string, { label: string; icon: typeof CheckSquare }> = {
                          todo: { label: 'To Do', icon: CheckSquare },
                          call: { label: 'Phone Call', icon: Phone },
                          meeting: { label: 'Meeting', icon: CalendarDays },
                          email: { label: 'Email', icon: MessageSquare },
                          follow_up: { label: 'Follow Up', icon: Users },
                        };
                        const t = types[activityType] ?? types.todo;
                        const Icon = t.icon;
                        return <><Icon className="h-4 w-4 text-muted-foreground" />{t.label}</>;
                      })()}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                    </button>

                    {activityDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActivityDropdownOpen(false)} />
                        <div className="absolute z-50 top-full left-0 mt-1.5 w-[320px] bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                          <div className="py-1">
                            {([
                              { value: 'todo', label: 'To Do', icon: CheckSquare },
                              { value: 'call', label: 'Phone Call', icon: Phone },
                              { value: 'meeting', label: 'Meeting', icon: CalendarDays },
                              { value: 'email', label: 'Email', icon: MessageSquare },
                              { value: 'follow_up', label: 'Follow Up', icon: Users },
                            ] as const)
                              .map((opt) => {
                                const Icon = opt.icon;
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => { setActivityType(opt.value); setActivityDropdownOpen(false); }}
                                    className={`flex items-center gap-3.5 w-full text-left px-4 py-3 text-sm transition-colors ${
                                      activityType === opt.value ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' : 'text-foreground hover:bg-muted/50'
                                    }`}
                                  >
                                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{opt.label}</span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <RichTextEditor
                    value={activityNote}
                    onChange={setActivityNote}
                    placeholder="Add a note..."
                    minHeight="80px"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveActivity}
                      disabled={savingActivity || isHtmlEmpty(activityNote)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 rounded-lg"
                    >
                      {savingActivity && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      Save Activity
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <RichTextEditor
                    value={noteContent}
                    onChange={setNoteContent}
                    placeholder="Write a note..."
                    minHeight="120px"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveActivity}
                      disabled={savingActivity || isHtmlEmpty(noteContent)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 rounded-lg"
                    >
                      {savingActivity && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      Save Note
                    </Button>
                  </div>
                </div>
              )}
                </div>
              </div>

              {/* Earlier - Activity History */}
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Earlier</h3>
              <div className="space-y-3">
                {activities.length > 0 ? (
                  activities.map((act: any) => {
                    const typeInfo = ACTIVITY_TYPE_ICONS[act.activity_type] ?? ACTIVITY_TYPE_ICONS.note;
                    const IconComp = typeInfo.icon;
                    const isExpanded = !!expandedActivities[act.id];
                    const comments = activityCommentsMap[act.id] ?? [];
                    const commentCount = comments.length;
                    return (
                      <div
                        key={act.id}
                        className={`rounded-xl bg-card border transition-colors ${isExpanded ? 'border-blue-200' : 'border-border hover:border-border'}`}
                      >
                        <button
                          type="button"
                          className="flex gap-3 p-3 w-full text-left cursor-pointer"
                          onClick={() => setExpandedActivities((prev) => ({ ...prev, [act.id]: !prev[act.id] }))}
                        >
                          <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${typeInfo.color}`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-foreground">{act.title || act.activity_type}</span>
                              <span className="text-[10px] text-muted-foreground">{formatShortDate(act.created_at)}</span>
                              {commentCount > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                  <MessageSquare className="h-2.5 w-2.5 mr-0.5" />{commentCount}
                                </Badge>
                              )}
                            </div>
                            {act.content && (
                              <div className={`text-xs text-muted-foreground ${isExpanded ? '' : 'line-clamp-3'}`}>
                                <HtmlContent value={act.content} className="text-xs text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3">
                            <Separator className="mb-3" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Comments</span>
                            {comments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {comments.map((c: any) => (
                                  <div key={c.id} className="flex gap-2">
                                    <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                                      {(c.created_by ?? '?')[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-medium text-foreground">{c.created_by ?? 'Unknown'}</span>
                                        <span className="text-[10px] text-muted-foreground">{formatShortDate(c.created_at)}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{c.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                                {(teamMember?.name ?? '?')[0]?.toUpperCase()}
                              </div>
                              <input
                                className="flex-1 text-xs bg-muted/50 border border-border rounded-md px-2 py-1 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-300"
                                placeholder="Add a comment..."
                                value={commentTexts[act.id] ?? ''}
                                onChange={(e) => setCommentTexts((prev) => ({ ...prev, [act.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (commentTexts[act.id] ?? '').trim()) {
                                    handleSaveComment(act.id);
                                  }
                                }}
                                disabled={savingComment === act.id}
                              />
                              {savingComment === act.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="border border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: Related — same overflow pattern as the left column. Plain div w/ native
            overflow keeps the "+ Add file" button and other content inside the column;
            Radix ScrollArea's table-display viewport doesn't constrain inner width. */}
        <div className="w-full md:w-[260px] lg:w-[310px] xl:w-[340px] md:shrink-0 md:min-w-[220px] min-w-0 border-t md:border-t-0 md:border-l border-border bg-card overflow-y-auto overflow-x-hidden">
          <div className="py-4 px-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block px-3">Related</span>

            {/* Related People */}
            <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={relatedPeople.length} onAdd={() => toast.info('Navigate to People to add a contact for this company')}>
              <div className="space-y-2 py-1">
                {relatedPeople.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/admin/contacts/people/expanded-view/${p.id}`)}
                    className="text-xs text-foreground flex items-center gap-2 w-full text-left hover:bg-muted/40 rounded-lg px-1 py-1 transition-colors"
                  >
                    <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium truncate block">{p.name}</span>
                      {p.title && <span className="text-muted-foreground text-[10px] truncate block">{p.title}</span>}
                    </div>
                  </button>
                ))}
                {relatedPeople.length === 0 && (
                  <p className="text-xs text-muted-foreground">No related people</p>
                )}
              </div>
            </RelatedSection>

            {/* Related Deals */}
            <RelatedSection icon={<DollarSign className="h-3.5 w-3.5" />} label="Deals" count={relatedDeals.length} onAdd={() => toast.info('Coming soon')}>
              <div className="space-y-2 py-1">
                {relatedDeals.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/admin/pipeline/underwriting/${d.id}`)}
                    className="text-xs text-foreground flex items-center gap-2 w-full text-left hover:bg-muted/40 rounded-lg px-1 py-1 transition-colors"
                  >
                    <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                      {d.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium truncate block">{d.name}</span>
                      <span className="text-muted-foreground text-[10px] truncate block">
                        {d.status?.replace(/_/g, ' ')}
                        {d.deal_value != null && ` \u00b7 $${Number(d.deal_value).toLocaleString()}`}
                      </span>
                    </div>
                  </button>
                ))}
                {relatedDeals.length === 0 && (
                  <p className="text-xs text-muted-foreground">No related deals</p>
                )}
              </div>
            </RelatedSection>

            {/* Tasks */}
            <RelatedSection
              icon={<CheckSquare className="h-3.5 w-3.5" />}
              label="Tasks"
              count={tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'done').length}
              onAdd={() => setAddingTask(true)}
            >
              <div className="space-y-2 py-1">
                {tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'done').map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    <span className="flex-1 truncate text-foreground font-medium">{t.title}</span>
                    {t.priority && (
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded-full ${
                        t.priority === 'high' ? 'border-red-200 text-red-600 bg-red-50' :
                        t.priority === 'medium' ? 'border-amber-200 text-amber-600 bg-amber-50' :
                        'border-border text-muted-foreground'
                      }`}>
                        {t.priority}
                      </Badge>
                    )}
                  </div>
                ))}
                {addingTask ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTaskTitle.trim()) handleSaveTask();
                        if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); }
                      }}
                      placeholder="Task title..."
                      disabled={savingTask}
                      className="flex-1 text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    />
                    {savingTask && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTask(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                  >
                    + Add task...
                  </button>
                )}
                {/* Show completed tasks toggle */}
                {(() => {
                  const completedTasks = tasks.filter((t: any) => t.status === 'completed' || t.status === 'done');
                  if (completedTasks.length === 0) return null;
                  return (
                    <>
                      <button
                        onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 w-full"
                      >
                        {showCompletedTasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Show completed tasks ({completedTasks.length})
                      </button>
                      {showCompletedTasks && completedTasks.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs">
                          <CheckSquare className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="flex-1 truncate line-through text-muted-foreground">{t.title}</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </RelatedSection>

            {/* Calendar Events placeholder */}
            <RelatedSection icon={<CalendarDays className="h-3.5 w-3.5" />} label="Calendar Events" count={0}>
              <p className="text-xs text-muted-foreground py-1">No events</p>
            </RelatedSection>

            {/* Files */}
            <RelatedSection icon={<FileText className="h-3.5 w-3.5" />} label="Files" count={0}>
              <EntityFilesSection
                entityId={company.id}
                entityType="companies"
                entityName={company.company_name}
                companyName={company.company_name}
              />
            </RelatedSection>
          </div>
        </div>
      </div>
    </div>
  );
}
