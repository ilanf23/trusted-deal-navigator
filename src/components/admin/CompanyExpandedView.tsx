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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  X, ChevronDown, ChevronRight,
  Users, Building2, FileText,
  CalendarDays, Plus, Pencil, Activity, Clock, AlertCircle,
  User, Mail, Phone, Tag, Briefcase, Loader2,
  Globe, DollarSign, Check,
} from 'lucide-react';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format } from 'date-fns';
import { formatPhoneNumber } from './InlineEditableFields';

/* ─── Types ─── */

interface Company {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email_domain: string | null;
  website: string | null;
  contact_type: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  notes: string | null;
  source: string | null;
  last_activity_at: string | null;
  last_contacted: string | null;
  created_at: string;
  updated_at: string;
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

/* ─── Inline Save Hook (companies table) ─── */

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
      .from('companies')
      .update({ [field]: saveValue } as any)
      .eq('id', companyId);
    setSaving(false);
    if (error) {
      console.error('CompanyExpandedView save error:', { field, companyId, saveValue, error });
      toast.error('Failed to save');
      return;
    }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, currentValue, field, companyId, onSaved, transform]);

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
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50/50">
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
            className="w-full text-right text-[13px] font-medium text-foreground bg-card border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
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
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
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
      .from('companies')
      .update({ tags: newTags.length > 0 ? newTags : null })
      .eq('id', companyId);
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
      <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-2.5">
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

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase
      .from('companies')
      .update({ notes: trimmed || null } as any)
      .eq('id', companyId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    onSaved('notes', trimmed);
    setEditing(false);
  }, [draft, value, companyId, onSaved]);

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
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <span className="text-[13px] font-medium text-foreground text-right truncate">{value}</span>
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

  // Notes editor state for middle column
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  /* ── Field saved handler ── */
  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
    queryClient.invalidateQueries({ queryKey: ['companies-list'] });
    toast.success('Updated');
  }, [companyId, queryClient]);

  /* ── Contact type change ── */
  const handleContactTypeChange = useCallback(async (newType: string) => {
    if (!companyId) return;
    const { error } = await supabase
      .from('companies')
      .update({ contact_type: newType })
      .eq('id', companyId);
    if (error) {
      toast.error('Failed to update contact type');
      return;
    }
    toast.success('Contact type updated');
    queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
    queryClient.invalidateQueries({ queryKey: ['companies-list'] });
  }, [companyId, queryClient]);

  /* ── Owner change ── */
  const handleOwnerChange = useCallback(async (newOwner: string) => {
    if (!companyId) return;
    const { error } = await supabase
      .from('companies')
      .update({ assigned_to: newOwner || null } as any)
      .eq('id', companyId);
    if (error) {
      toast.error('Failed to update owner');
      return;
    }
    toast.success('Owner updated');
    queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
    queryClient.invalidateQueries({ queryKey: ['companies-list'] });
  }, [companyId, queryClient]);

  /* ── Save note to notes field ── */
  const handleSaveNote = useCallback(async () => {
    if (!companyId) return;
    const content = noteContent.trim();
    if (!content || isHtmlEmpty(content)) {
      toast.error('Please enter some content');
      return;
    }
    setSavingNote(true);
    // Append the new note to existing notes
    const { data: current } = await supabase
      .from('companies')
      .select('notes')
      .eq('id', companyId)
      .single();
    const existingNotes = (current as any)?.notes ?? '';
    const timestamp = format(new Date(), 'MMM d, yyyy h:mm a');
    const newEntry = `<p><strong>${timestamp}</strong></p>${content}`;
    const updatedNotes = existingNotes
      ? `${newEntry}<hr/>${existingNotes}`
      : newEntry;
    const { error } = await supabase
      .from('companies')
      .update({ notes: updatedNotes } as any)
      .eq('id', companyId);
    setSavingNote(false);
    if (error) {
      toast.error('Failed to save note');
      return;
    }
    toast.success('Note saved');
    setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['company-expanded', companyId] });
  }, [companyId, noteContent, queryClient]);

  /* ── Queries ── */

  const { data: company, isLoading } = useQuery({
    queryKey: ['company-expanded', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId!)
        .single();
      if (error) throw error;
      return data as unknown as Company;
    },
    enabled: !!companyId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, name').eq('is_active', true);
      return (data || []) as { id: string; name: string }[];
    },
  });

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

  // Related deals (leads table where company_name matches)
  const { data: relatedDeals = [] } = useQuery({
    queryKey: ['company-related-deals', company?.company_name],
    queryFn: async () => {
      if (!company?.company_name) return [];
      const { data } = await supabase
        .from('leads')
        .select('id, name, status, deal_value, assigned_to')
        .eq('company_name', company.company_name)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!company?.company_name,
  });

  /* ── Loading state ── */

  if (isLoading || !company) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  const initial = company.company_name[0]?.toUpperCase() ?? '?';
  const assignedName = company.assigned_to ? (teamMemberMap[company.assigned_to] ?? '\u2014') : '\u2014';
  const inactiveDays = daysSince(company.last_activity_at ?? company.last_contacted);
  const typeCfg = contactTypeConfig[company.contact_type ?? ''];
  const ownerOptions = teamMembers.map((m) => ({ value: m.id, label: m.name }));

  function goBack() {
    navigate('/admin/pipeline/contacts/companies');
  }

  return (
    <div data-full-bleed className="flex flex-col bg-background overflow-hidden h-[calc(100vh-3.5rem)]">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border px-4 py-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={goBack}>
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initial}</span>
          </div>
          <span className="text-sm font-bold text-foreground truncate">{company.company_name}</span>
          {typeCfg && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${typeCfg.bg} ${typeCfg.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${typeCfg.dot}`} />
              {typeCfg.label}
            </span>
          )}
        </div>
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Company Details */}
        <ScrollArea className="w-[400px] shrink-0 border-r border-border bg-card">
          <div className="px-6 py-6 space-y-6">

            {/* Company Card */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Company</span>
              <div className="rounded-2xl bg-gradient-to-b from-card to-muted/20 dark:to-muted/10 border border-border/60 shadow-sm p-5">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-white">{initial}</span>
                  </div>
                  <div className="min-w-0 space-y-1 flex-1">
                    <p className="text-base font-bold tracking-tight text-foreground truncate">{company.company_name}</p>
                    {company.contact_name && (
                      <p className="text-[13px] text-muted-foreground truncate">{company.contact_name}</p>
                    )}
                    {typeCfg && (
                      <div className={`flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg border w-fit ${typeCfg.bg}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${typeCfg.dot} shrink-0`} />
                        <span className={`text-xs font-medium ${typeCfg.color}`}>{typeCfg.label}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator className="!my-4 opacity-50" />
                <div className="space-y-1">
                  <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={company.contact_name ?? ''} field="contact_name" companyId={company.id} placeholder="Add contact name..." onSaved={handleFieldSaved} />
                  <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={company.phone ?? ''} field="phone" companyId={company.id} placeholder="Add phone..." onSaved={handleFieldSaved} />
                  <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={company.email_domain ?? ''} field="email_domain" companyId={company.id} placeholder="Add email domain..." onSaved={handleFieldSaved} />
                  <EditableContactRow icon={<Globe className="h-3.5 w-3.5" />} value={company.website ?? ''} field="website" companyId={company.id} placeholder="Add website..." onSaved={handleFieldSaved} />
                </div>
              </div>
            </div>

            {/* Details */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Details</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
                {/* Contact Type */}
                <div className="px-3 py-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium text-muted-foreground">Contact Type</span>
                  </div>
                  <Select value={company.contact_type ?? ''} onValueChange={handleContactTypeChange}>
                    <SelectTrigger className={`h-8 w-full text-[13px] rounded-lg ${typeCfg?.bg ?? 'bg-muted'} ${typeCfg?.color ?? 'text-foreground'} border-border shadow-none px-2.5 gap-1`}>
                      <SelectValue>{typeCfg?.label ?? company.contact_type ?? '\u2014'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="min-w-[220px]">
                      {CONTACT_TYPES.map((ct) => {
                        const cfg = contactTypeConfig[ct];
                        return (
                          <SelectItem key={ct} value={ct} className="text-[13px]">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${cfg?.dot ?? 'bg-muted-foreground'}`} />
                              {cfg?.label ?? ct}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {/* Owner */}
                {ownerOptions.length > 0 ? (
                  <div className="px-3 py-2 hover:bg-muted/40 transition-colors rounded-lg space-y-1.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium text-muted-foreground">Owner</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Select value={company.assigned_to ?? ''} onValueChange={handleOwnerChange}>
                        <SelectTrigger className="h-8 w-full text-[13px] font-medium text-foreground border-border bg-transparent shadow-none px-2.5 gap-1 rounded-lg">
                          <SelectValue>{assignedName}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="min-w-[200px]">
                          {ownerOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-[13px]">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <EditableField icon={<User className="h-3.5 w-3.5" />} label="Owner" value={assignedName} field="assigned_to" companyId={company.id} onSaved={handleFieldSaved} />
                )}
                {/* Source */}
                <EditableField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={company.source ?? ''} field="source" companyId={company.id} onSaved={handleFieldSaved} />
                {/* Company Name (editable) */}
                <EditableField icon={<Building2 className="h-3.5 w-3.5" />} label="Company Name" value={company.company_name} field="company_name" companyId={company.id} onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Tags</span>
              <EditableTags tags={company.tags ?? []} companyId={company.id} onSaved={handleFieldSaved} />
            </div>

            {/* Notes */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Notes</span>
              <EditableNotes value={company.notes ?? ''} companyId={company.id} onSaved={handleFieldSaved} />
            </div>

            {/* Fixed (read-only info) */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Fixed</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-muted/50">
                <ReadOnlyField icon={<Briefcase className="h-3.5 w-3.5" />} label="Pipeline" value="Companies" />
                <ReadOnlyField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Created" value={formatDate(company.created_at)} />
                <ReadOnlyField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Updated" value={formatDate(company.updated_at)} />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* MIDDLE: Activity / Notes */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/20">
          {/* Stats Bar */}
          <div className="shrink-0 grid grid-cols-3 gap-3 px-5 py-3.5 border-b border-border bg-card">
            <StatBox
              value={inactiveDays ?? '\u2014'}
              label="Days Since Activity"
              icon={<AlertCircle className="h-3.5 w-3.5" />}
              bg="bg-white dark:bg-slate-900/80"
              border={(inactiveDays ?? 0) > 30 ? 'border-red-500' : 'border-amber-500'}
              valueColor={(inactiveDays ?? 0) > 30 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}
              iconBg={(inactiveDays ?? 0) > 30 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}
            />
            <StatBox
              value={relatedPeople.length}
              label="Related People"
              icon={<Users className="h-3.5 w-3.5 text-blue-500" />}
              bg="bg-white dark:bg-slate-900/80"
              border="border-blue-500"
              valueColor="text-blue-700 dark:text-blue-400"
              iconBg="bg-blue-100 dark:bg-blue-900/40"
            />
            <StatBox
              value={relatedDeals.length}
              label="Related Deals"
              icon={<DollarSign className="h-3.5 w-3.5 text-emerald-500" />}
              bg="bg-white dark:bg-slate-900/80"
              border="border-emerald-500"
              valueColor="text-emerald-700 dark:text-emerald-400"
              iconBg="bg-emerald-100 dark:bg-emerald-900/40"
            />
          </div>

          {/* Notes Editor */}
          <div className="shrink-0 flex items-center justify-center gap-2 border-b border-border px-6 py-2.5 bg-card">
            <span className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/25">
              <Pencil className="h-3.5 w-3.5" />
              Add Note
            </span>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5">
              <div className="space-y-4">
                <RichTextEditor
                  value={noteContent}
                  onChange={setNoteContent}
                  placeholder="Write a note about this company..."
                  minHeight="120px"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={savingNote || isHtmlEmpty(noteContent)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 rounded-lg"
                  >
                    {savingNote && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                    Save Note
                  </Button>
                </div>
              </div>

              {/* Existing notes display */}
              {company.notes && (
                <>
                  <Separator className="my-6" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Existing Notes</h3>
                  <div className="rounded-xl bg-card border border-border p-4">
                    <HtmlContent value={company.notes} className="text-sm text-foreground" />
                  </div>
                </>
              )}

              {/* Activity placeholder */}
              {!company.notes && (
                <>
                  <Separator className="my-6" />
                  <div className="border border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                    <p className="text-xs text-muted-foreground">Use the note editor above to add the first entry</p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: Related */}
        <ScrollArea className="w-[260px] shrink-0 border-l border-border bg-card">
          <div className="py-4 px-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block px-3">Related</span>

            {/* Related People */}
            <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={relatedPeople.length} onAdd={() => toast.info('Navigate to People to add a contact for this company')}>
              <div className="space-y-2 py-1">
                {relatedPeople.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/admin/pipeline/contacts/people/${p.id}`)}
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

            {/* Calendar Events placeholder */}
            <RelatedSection icon={<CalendarDays className="h-3.5 w-3.5" />} label="Calendar Events" count={0}>
              <p className="text-xs text-muted-foreground py-1">No events</p>
            </RelatedSection>

            {/* Files placeholder */}
            <RelatedSection icon={<FileText className="h-3.5 w-3.5" />} label="Files" count={0}>
              <p className="text-xs text-muted-foreground py-1">No files</p>
            </RelatedSection>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
