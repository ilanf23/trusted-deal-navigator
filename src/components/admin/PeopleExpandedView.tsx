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
import { sanitizeFileName } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  X, ChevronDown, ChevronRight, ChevronUp,
  Users, Building2, CheckSquare, FileText,
  CalendarDays, Layers, Plus,
  MessageSquare, Pencil, Activity, Clock, AlertCircle,
  User, Mail, Phone, Tag, Briefcase, Loader2,
  Linkedin, Check, Upload, Download, Trash2,
} from 'lucide-react';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { differenceInDays, parseISO, format } from 'date-fns';
import { formatPhoneNumber } from './InlineEditableFields';

interface PersonFile {
  id: string;
  lead_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string | null): string {
  if (!fileType) return '\u{1F4C4}';
  if (fileType.startsWith('image/')) return '\u{1F5BC}\uFE0F';
  if (fileType === 'application/pdf') return '\u{1F4D5}';
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return '\u{1F4CA}';
  if (fileType.includes('word') || fileType.includes('document')) return '\u{1F4DD}';
  if (fileType.includes('zip') || fileType.includes('compressed')) return '\u{1F4E6}';
  return '\u{1F4C4}';
}

// ── Person type ──
interface Person {
  id: string;
  name: string;
  title: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  contact_type: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  notes: string | null;
  linkedin: string | null;
  source: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Contact type config ──
const CONTACT_TYPES = [
  'Client', 'Prospect', 'Referral Partner', 'Lender',
  'Attorney', 'CPA', 'Vendor', 'Other',
];

const contactTypeConfig: Record<string, { label: string; color: string; bg: string; dot: string; pill: string }> = {
  Client: {
    label: 'Client',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  },
  Prospect: {
    label: 'Prospect',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  },
  'Referral Partner': {
    label: 'Referral Partner',
    color: 'text-violet-700 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800',
    dot: 'bg-violet-500',
    pill: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300',
  },
  Lender: {
    label: 'Lender',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  },
  Attorney: {
    label: 'Attorney',
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
    pill: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300',
  },
  CPA: {
    label: 'CPA',
    color: 'text-cyan-700 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800',
    dot: 'bg-cyan-500',
    pill: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300',
  },
  Vendor: {
    label: 'Vendor',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
    pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  },
  Other: {
    label: 'Other',
    color: 'text-slate-700 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800',
    dot: 'bg-slate-500',
    pill: 'bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300',
  },
};

// ── Helpers ──

function getAvatarGradient(name: string) {
  const gradients = [
    'from-blue-500 to-blue-600',
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

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
  type_change: { icon: Layers, color: 'text-violet-500' },
};

// ── Inline-save helper (for leads table) ──
function useInlineSave(
  personId: string,
  field: string,
  currentValue: string,
  onSaved: (field: string, newValue: string) => void,
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
    const { error } = await supabase
      .from('leads')
      .update({ [field]: trimmed || null })
      .eq('id', personId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, currentValue, field, personId, onSaved]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}

// ── Editable field row ──
function EditableField({
  icon, label, value, field, personId, onSaved,
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  personId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(personId, field, value, onSaved);
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
    <div onClick={() => setEditing(true)} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer group">
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        {icon}
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] text-right truncate font-medium text-foreground">
          {value || '\u2014'}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}

// ── Editable Contact Row ──
function EditableContactRow({
  icon, value, field, personId, placeholder, onSaved,
}: {
  icon: React.ReactNode; value: string; field: string;
  personId: string; placeholder: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(personId, field, value, onSaved);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const displayValue = field === 'phone' ? formatPhoneNumber(value) : value;

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

// ── Editable Tags ──
function EditableTags({
  tags, personId, onSaved,
}: {
  tags: string[]; personId: string;
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
      .eq('id', personId);
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

// ── Editable Notes ──
function EditableNotes({
  value, personId, onSaved,
}: {
  value: string; personId: string;
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
      .from('leads')
      .update({ notes: trimmed || null })
      .eq('id', personId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    onSaved('notes', trimmed);
    setEditing(false);
  }, [draft, value, personId, onSaved]);

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

// ── Read-only row ──
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

/* --- Stats Card (accent card style) --- */
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

/* --- Related Section --- */
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
        {onAdd && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 ml-auto text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ══════════════════════════════════════════════════
// ── Main Component ──
// ══════════════════════════════════════════════════

export default function PeopleExpandedView() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');

  // Activity form state
  const [activityType, setActivityType] = useState('note');
  const [activityNote, setActivityNote] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);

  // Task inline add state
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Activity expand / comments state
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);

  const { teamMember } = useTeamMember();

  // ── Queries (defined before callbacks that reference query results) ──
  const { data: person, isLoading } = useQuery({
    queryKey: ['person-expanded', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', personId!)
        .single();
      if (error) throw error;
      return data as Person;
    },
    enabled: !!personId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['person-activities', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', personId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!personId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['person-tasks', personId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_activities')
        .select('id, title, content, created_at')
        .eq('lead_id', personId!)
        .eq('activity_type', 'task')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!personId,
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

  // ── Contact type change handler ──
  const handleContactTypeChange = useCallback(async (newType: string) => {
    if (!personId) return;
    const currentType = person?.contact_type ?? null;
    const { error } = await supabase
      .from('leads')
      .update({ contact_type: newType })
      .eq('id', personId);
    if (error) {
      toast.error('Failed to update contact type');
      return;
    }
    toast.success('Contact type updated');
    queryClient.invalidateQueries({ queryKey: ['person-expanded', personId] });
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
    // Log an activity for the type change
    await supabase.from('lead_activities').insert({
      lead_id: personId,
      activity_type: 'type_change',
      title: 'Contact type changed',
      content: JSON.stringify({ from: currentType, to: newType }),
    });
    queryClient.invalidateQueries({ queryKey: ['person-activities', personId] });
  }, [personId, person?.contact_type, queryClient]);

  // ── Field saved handler ──
  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['person-expanded', personId] });
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
    toast.success('Updated');
  }, [personId, queryClient]);

  // ── Save activity ──
  const handleSaveActivity = useCallback(async () => {
    if (!personId) return;
    const rawContent = activityTab === 'log' ? activityNote : noteContent;
    const content = rawContent.trim();
    const type = activityTab === 'log' ? activityType : 'note';
    if (!content || isHtmlEmpty(content)) {
      toast.error('Please enter some content');
      return;
    }
    setSavingActivity(true);
    const { error } = await supabase.from('lead_activities').insert({
      lead_id: personId,
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
    await supabase.from('leads').update({ last_activity_at: new Date().toISOString() }).eq('id', personId);
    toast.success('Activity saved');
    if (activityTab === 'log') setActivityNote('');
    else setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['person-activities', personId] });
    queryClient.invalidateQueries({ queryKey: ['person-expanded', personId] });
  }, [personId, activityTab, activityType, activityNote, noteContent, queryClient]);

  // ── Save task ──
  const handleSaveTask = useCallback(async () => {
    if (!personId || !newTaskTitle.trim()) return;
    setSavingTask(true);
    const { error } = await supabase.from('lead_activities').insert({
      lead_id: personId,
      activity_type: 'task',
      title: newTaskTitle.trim(),
      content: newTaskTitle.trim(),
    });
    setSavingTask(false);
    if (error) {
      toast.error('Failed to create task');
      return;
    }
    toast.success('Task created');
    setNewTaskTitle('');
    setAddingTask(false);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', personId] });
  }, [personId, newTaskTitle, queryClient]);

  // ── Save activity comment ──
  const handleSaveComment = useCallback(async (activityId: string) => {
    const text = (commentTexts[activityId] ?? '').trim();
    if (!text || !personId) return;
    setSavingComment(activityId);
    const { error } = await supabase.from('activity_comments').insert({
      activity_id: activityId,
      lead_id: personId,
      content: text,
      created_by: teamMember?.name ?? null,
    });
    setSavingComment(null);
    if (error) {
      toast.error('Failed to save comment');
      return;
    }
    setCommentTexts((prev) => ({ ...prev, [activityId]: '' }));
    queryClient.invalidateQueries({ queryKey: ['person-activity-comments', personId] });
  }, [personId, commentTexts, teamMember, queryClient]);

  // ── File upload ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !personId) return;
    e.target.value = '';

    console.log('[FileUpload] Lead: starting upload', { name: file.name, size: file.size, type: file.type });

    // Auth check
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('[FileUpload] Lead: no active session', sessionError);
      toast.error('You must be logged in to upload files. Please refresh and sign in again.');
      return;
    }

    setUploadingFile(true);
    const filePath = `${personId}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('lead-files')
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });
    if (uploadError) {
      console.error('[FileUpload] Lead: storage upload error', uploadError);
      setUploadingFile(false);
      const reason = uploadError.message?.includes('security')
        ? 'Permission denied — check your login session'
        : uploadError.message || 'Storage error';
      toast.error(`Upload failed for ${file.name}: ${reason}`);
      return;
    }

    // Store relative path, NOT public URL
    const { error: dbError } = await supabase.from('lead_files').insert({
      lead_id: personId,
      file_name: file.name,
      file_url: filePath,
      file_type: file.type || null,
      file_size: file.size,
    });
    setUploadingFile(false);
    if (dbError) {
      console.error('[FileUpload] Lead: DB insert error', dbError);
      const reason = dbError.message?.includes('row-level security')
        ? 'Permission denied — admin role required'
        : dbError.message || 'Database error';
      toast.error(`Failed to save ${file.name}: ${reason}`);
      // Clean up orphaned storage file
      await supabase.storage.from('lead-files').remove([filePath]);
      return;
    }
    console.log('[FileUpload] Lead: upload success', { filePath });
    toast.success('File uploaded');
    queryClient.invalidateQueries({ queryKey: ['person-files', personId] });
  }, [personId, queryClient]);

  // ── File delete ──
  const handleDeleteFile = useCallback(async (file: PersonFile) => {
    // file_url stores relative path directly
    await supabase.storage.from('lead-files').remove([file.file_url]);

    const { error } = await supabase.from('lead_files').delete().eq('id', file.id);
    if (error) {
      toast.error('Failed to delete file');
      return;
    }
    toast.success('File deleted');
    queryClient.invalidateQueries({ queryKey: ['person-files', personId] });
  }, [personId, queryClient]);

  // ── File download (signed URL) ──
  const handleDownloadFile = useCallback(async (file: PersonFile) => {
    const { data, error } = await supabase.storage
      .from('lead-files')
      .createSignedUrl(file.file_url, 60);
    if (error || !data?.signedUrl) {
      toast.error('Failed to generate download link');
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = file.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ── Person files query ──
  const { data: personFiles = [] } = useQuery({
    queryKey: ['person-files', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_files')
        .select('id, lead_id, file_name, file_url, file_type, file_size, uploaded_by, created_at')
        .eq('lead_id', personId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PersonFile[];
    },
    enabled: !!personId,
  });

  // ── Activity comments query ──
  const { data: activityCommentsMap = {} } = useQuery({
    queryKey: ['person-activity-comments', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_comments')
        .select('*')
        .eq('lead_id', personId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      for (const c of data ?? []) {
        (map[c.activity_id] ??= []).push(c);
      }
      return map;
    },
    enabled: !!personId,
  });

  if (isLoading || !person) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  const initial = person.name[0]?.toUpperCase() ?? '?';
  const gradient = getAvatarGradient(person.name);
  const typeCfg = contactTypeConfig[person.contact_type ?? 'Other'];
  const inactiveDays = daysSince(person.last_activity_at);
  const lastActivityDate = formatShortDate(person.last_activity_at);
  const totalTasks = tasks.length;
  const pendingTasks = tasks;
  const completedTasks: typeof tasks = [];
  const assignedName = person.assigned_to ? (teamMemberMap[person.assigned_to] ?? '\u2014') : '\u2014';

  function goBack() {
    navigate('/admin/pipeline/contacts/people');
  }

  return (
    <div data-full-bleed className="flex flex-col bg-background overflow-hidden h-[calc(100vh-3.5rem)]">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border px-4 py-2 flex items-center">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={goBack}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Details */}
        <ScrollArea className="w-[400px] shrink-0 border-r border-border bg-card">
          <div className="px-6 py-6 space-y-6">

            {/* Primary Contact Card */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Contact</span>
              <div className="rounded-2xl bg-gradient-to-b from-card to-muted/20 dark:to-muted/10 border border-border/60 shadow-sm p-5">
                <div className="flex items-start gap-3.5">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} shadow-md shadow-blue-500/20 flex items-center justify-center shrink-0`}>
                    <span className="text-sm font-bold text-white">{initial}</span>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-base font-bold tracking-tight text-foreground truncate">{person.name}</p>
                    {person.title && (
                      <p className="text-[13px] text-muted-foreground truncate">{person.title}</p>
                    )}
                    {person.company_name && (
                      <p className="text-[13px] text-muted-foreground truncate flex items-center gap-1">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {person.company_name}
                      </p>
                    )}
                    {typeCfg && (
                      <div className={`flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg border ${typeCfg.bg} w-fit`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${typeCfg.dot} shrink-0`} />
                        <span className={`text-xs font-medium ${typeCfg.color}`}>{typeCfg.label}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator className="!my-4 opacity-50" />
                <div className="space-y-1">
                  <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={person.name} field="name" personId={person.id} placeholder="Name" onSaved={handleFieldSaved} />
                  <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={person.email ?? ''} field="email" personId={person.id} placeholder="Add email..." onSaved={handleFieldSaved} />
                  <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={person.phone ?? ''} field="phone" personId={person.id} placeholder="Add phone..." onSaved={handleFieldSaved} />
                  <EditableContactRow icon={<Linkedin className="h-3.5 w-3.5" />} value={person.linkedin ?? ''} field="linkedin" personId={person.id} placeholder="Add LinkedIn..." onSaved={handleFieldSaved} />
                </div>
              </div>
            </div>

            {/* Contact Type Selector */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Contact Type</span>
              <div className="rounded-lg border border-border p-3">
                <Select value={person.contact_type ?? 'Other'} onValueChange={(v) => handleContactTypeChange(v)}>
                  <SelectTrigger className={`h-9 w-full text-xs rounded-lg ${typeCfg?.bg ?? 'bg-muted'} ${typeCfg?.color ?? 'text-foreground'} border-border shadow-none px-2.5 gap-1`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${typeCfg?.dot ?? 'bg-muted-foreground'}`} />
                      <SelectValue>{typeCfg?.label ?? person.contact_type}</SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="min-w-[220px]">
                    {CONTACT_TYPES.map((t) => {
                      const cfg = contactTypeConfig[t];
                      return (
                        <SelectItem key={t} value={t} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${cfg?.dot ?? 'bg-muted-foreground'}`} />
                            {cfg?.label ?? t}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Details (editable) */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Details</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
                <EditableField icon={<Briefcase className="h-3.5 w-3.5" />} label="Title" value={person.title ?? ''} field="title" personId={person.id} onSaved={handleFieldSaved} />
                <EditableField icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={person.company_name ?? ''} field="company_name" personId={person.id} onSaved={handleFieldSaved} />
                <EditableField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={person.source ?? ''} field="source" personId={person.id} onSaved={handleFieldSaved} />
                <EditableField icon={<User className="h-3.5 w-3.5" />} label="Assigned To" value={assignedName} field="assigned_to" personId={person.id} onSaved={handleFieldSaved} />
                <ReadOnlyField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Created" value={formatDate(person.created_at)} />
                <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Updated" value={formatDate(person.updated_at)} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Tags</span>
              <EditableTags tags={person.tags ?? []} personId={person.id} onSaved={handleFieldSaved} />
            </div>

            {/* Notes */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Notes</span>
              <EditableNotes value={person.notes ?? ''} personId={person.id} onSaved={handleFieldSaved} />
            </div>

            {/* Fixed (read-only) */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Fixed</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-muted/50">
                <ReadOnlyField icon={<Layers className="h-3.5 w-3.5" />} label="Type" value={typeCfg?.label ?? person.contact_type ?? '\u2014'} />
                <ReadOnlyField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Created" value={formatDate(person.created_at)} />
                <ReadOnlyField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={person.source ?? '\u2014'} />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* CENTER: Activity */}
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
              value={totalTasks}
              label="Total Tasks"
              icon={<CheckSquare className="h-3.5 w-3.5 text-emerald-500" />}
              bg="bg-white dark:bg-slate-900/80"
              border="border-emerald-500"
              valueColor="text-emerald-700 dark:text-emerald-400"
              iconBg="bg-emerald-100 dark:bg-emerald-900/40"
            />
            <StatBox
              value={typeCfg?.label ?? person.contact_type ?? '\u2014'}
              label="Contact Type"
              icon={<Layers className="h-3.5 w-3.5 text-blue-500" />}
              bg="bg-white dark:bg-slate-900/80"
              border="border-blue-500"
              valueColor="text-blue-700 dark:text-blue-400 text-sm"
              iconBg="bg-blue-100 dark:bg-blue-900/40"
            />
          </div>

          {/* Activity Tabs */}
          <div className="shrink-0 flex items-center justify-center gap-2 border-b border-border px-6 py-2.5 bg-card">
            <button
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activityTab === 'log'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => setActivityTab('log')}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Log Activity
            </button>
            <button
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activityTab === 'note'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => setActivityTab('note')}
            >
              <Pencil className="h-3.5 w-3.5" />
              Create Note
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5">
              {activityTab === 'log' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Select value={activityType} onValueChange={setActivityType}>
                      <SelectTrigger className="h-8 w-[120px] text-xs rounded-lg border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note" className="text-xs">Note</SelectItem>
                        <SelectItem value="call" className="text-xs">Call</SelectItem>
                        <SelectItem value="email" className="text-xs">Email</SelectItem>
                        <SelectItem value="meeting" className="text-xs">Meeting</SelectItem>
                        <SelectItem value="todo" className="text-xs">To Do</SelectItem>
                      </SelectContent>
                    </Select>
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

              {/* Earlier - Activity History */}
              <Separator className="my-6" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Earlier</h3>
              <div className="space-y-3">
                {activities.length > 0 ? (
                  activities.map((act: any) => {
                    const typeInfo = ACTIVITY_TYPE_ICONS[act.activity_type] ?? ACTIVITY_TYPE_ICONS.note;
                    const IconComp = typeInfo.icon;

                    // Handle type_change activities specially (no expand/comments)
                    if (act.activity_type === 'type_change' && act.content) {
                      let fromType: string | null = null;
                      let toType: string | null = null;
                      try {
                        const parsed = JSON.parse(act.content);
                        fromType = parsed.from;
                        toType = parsed.to;
                      } catch { /* ignore */ }

                      return (
                        <div key={act.id} className="flex gap-3 p-3 rounded-xl bg-card border border-border hover:border-border transition-colors">
                          <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${typeInfo.color}`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-foreground">{act.title || 'Contact type changed'}</span>
                              <span className="text-[10px] text-muted-foreground">{formatShortDate(act.created_at)}</span>
                            </div>
                            {fromType && toType && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${contactTypeConfig[fromType]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                                  {contactTypeConfig[fromType]?.label ?? fromType}
                                </span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${contactTypeConfig[toType]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                                  {contactTypeConfig[toType]?.label ?? toType}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

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

        {/* RIGHT: Related */}
        <ScrollArea className="w-[260px] shrink-0 border-l border-border bg-card">
          <div className="py-4 px-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block px-3">Related</span>

            {/* Company */}
            <RelatedSection icon={<Building2 className="h-3.5 w-3.5" />} label="Company" count={person.company_name ? 1 : 0} iconColor="text-indigo-500">
              <div className="space-y-2 py-1">
                {person.company_name ? (
                  <div className="text-xs text-foreground flex items-center gap-2">
                    <div className={`h-5 w-5 rounded-full bg-gradient-to-br ${getAvatarGradient(person.company_name)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                      {person.company_name[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium">{person.company_name}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No company set</p>
                )}
              </div>
            </RelatedSection>

            {/* Tasks */}
            <RelatedSection
              icon={<CheckSquare className="h-3.5 w-3.5" />}
              label="Tasks"
              count={pendingTasks.length}
              iconColor="text-emerald-500"
              onAdd={() => setAddingTask(true)}
            >
              <div className="space-y-2 py-1">
                {pendingTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    <span className="flex-1 truncate text-foreground font-medium">{t.title}</span>
                    {t.created_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatShortDate(t.created_at)}
                      </span>
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
                {completedTasks.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 w-full"
                    >
                      {showCompletedTasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Show completed tasks ({completedTasks.length})
                    </button>
                    {showCompletedTasks && completedTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <CheckSquare className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="flex-1 truncate line-through text-muted-foreground">{t.title}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </RelatedSection>

            {/* Contact Type */}
            <RelatedSection icon={<Layers className="h-3.5 w-3.5" />} label="Contact Type" count={1} iconColor="text-blue-500">
              <div className="py-1">
                {typeCfg ? (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${typeCfg.bg}`}>
                    <span className={`h-2 w-2 rounded-full ${typeCfg.dot}`} />
                    <span className={`text-[11px] font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[11px]">{person.contact_type}</Badge>
                )}
              </div>
            </RelatedSection>

            {/* Files */}
            <RelatedSection
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Files"
              count={personFiles.length}
              iconColor="text-orange-500"
              onAdd={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="space-y-1.5 py-1">
                {personFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-muted/40 transition-colors group">
                    <span className="text-sm shrink-0">{getFileIcon(f.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{f.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(f.file_size)} · {formatShortDate(f.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadFile(f); }}
                        className="p-1 rounded hover:bg-muted"
                        title="Download"
                      >
                        <Download className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(f)}
                        className="p-1 rounded hover:bg-muted"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
                {uploadingFile && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
                    Uploading...
                  </div>
                )}
                {personFiles.length === 0 && !uploadingFile && (
                  <p className="text-xs text-muted-foreground">No files</p>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                >
                  + Upload file...
                </button>
              </div>
            </RelatedSection>

            {/* Calendar Events */}
            <RelatedSection icon={<CalendarDays className="h-3.5 w-3.5" />} label="Calendar Events" count={0} iconColor="text-amber-500">
              <p className="text-xs text-muted-foreground py-1">No events</p>
            </RelatedSection>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
