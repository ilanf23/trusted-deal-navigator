import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  X, Maximize2, Building2, User, Mail, Phone,
  Tag, FileText, Clock, ArrowRight, ChevronRight, Briefcase,
  Pencil, Check, Loader2, MessageSquare, Users, CheckSquare, ChevronDown, Layers,
  Link2,
} from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { formatPhoneNumber } from './InlineEditableFields';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format, formatDistanceToNow } from 'date-fns';

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

interface ContactTypeConfigEntry {
  label: string;
  color: string;
  bg: string;
  dot: string;
  pill: string;
}

interface TeamMember {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface PeopleDetailPanelProps {
  person: Person;
  contactTypeConfig: Record<string, ContactTypeConfigEntry>;
  teamMemberMap: Record<string, string>;
  teamMembers?: TeamMember[];
  onClose: () => void;
  onExpand?: () => void;
  onContactTypeChange?: (personId: string, newType: string) => void;
  onPersonUpdate?: (updatedPerson: Person) => void;
}

const CONTACT_TYPES = [
  'Client', 'Prospect', 'Referral Partner', 'Lender',
  'Attorney', 'CPA', 'Vendor', 'Other',
];

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
  try {
    return differenceInDays(new Date(), parseISO(dateStr));
  } catch {
    return null;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '\u2014';
  }
}

// ── Generic inline-save helper ──
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
      .from('people')
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
      .from('people')
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
    if (editing) {
      setDraft(value);
    }
  }, [editing, value]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase
      .from('people')
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

// ── Activity Tab Content ──
function ActivityTabContent({ person, contactTypeConfig }: { person: Person; contactTypeConfig: Record<string, ContactTypeConfigEntry> }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['people-activity-timeline', person.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('people_activities')
        .select('id, activity_type, title, content, created_at')
        .eq('person_id', person.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="px-5 py-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      {activities.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Activities will appear here</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-0.5">
            {activities.map((item) => {
              let fromType: string | null = null;
              let toType: string | null = null;
              if (item.activity_type === 'type_change' && item.content) {
                try {
                  const parsed = JSON.parse(item.content);
                  fromType = parsed.from;
                  toType = parsed.to;
                } catch { /* ignore */ }
              }

              return (
                <div key={item.id} className="flex gap-3 py-2.5 relative">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 bg-blue-500 text-white">
                    <ArrowRight className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground leading-tight">{item.title ?? item.activity_type}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(parseISO(item.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {item.activity_type === 'type_change' && fromType && toType && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${contactTypeConfig[fromType]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                          {contactTypeConfig[fromType]?.label ?? fromType}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${contactTypeConfig[toType]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                          {contactTypeConfig[toType]?.label ?? toType}
                        </span>
                      </div>
                    )}

                    {item.activity_type !== 'type_change' && item.content && (
                      <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{item.content}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Related Tab Content ──
function RelatedTabContent({ person, contactTypeConfig }: { person: Person; contactTypeConfig: Record<string, ContactTypeConfigEntry> }) {
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['people-related', 'tasks', person.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('people_tasks')
        .select('id, title, status, due_date')
        .eq('person_id', person.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  if (loadingTasks) {
    return (
      <div className="px-5 py-4 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const typeCfg = contactTypeConfig[person.contact_type ?? 'Other'];

  return (
    <div className="px-5 py-4 space-y-1">
      {/* Company */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-1 rounded-lg transition-colors">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="text-indigo-500"><Building2 className="h-3.5 w-3.5" /></span> Company
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
            {person.company_name ? 1 : 0}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 pb-2">
          {person.company_name ? (
            <div className="flex items-center gap-2.5 pt-1">
              <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(person.company_name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                {person.company_name[0]?.toUpperCase() ?? '?'}
              </div>
              <p className="text-[12px] font-medium text-foreground">{person.company_name}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-1">No company set</p>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Tasks */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-1 rounded-lg transition-colors">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="text-emerald-500"><CheckSquare className="h-3.5 w-3.5" /></span> Tasks
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
            {tasks.length}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 pb-2">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1">No tasks</p>
          ) : (
            <div className="space-y-1.5 pt-1">
              {tasks.map((t) => {
                const isCompleted = t.status === 'completed';
                return (
                  <div key={t.id} className={`flex items-center gap-2 ${isCompleted ? 'opacity-50' : ''}`}>
                    <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                      isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700' : 'border-border'
                    }`}>
                      {isCompleted && <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <span className={`text-[12px] truncate flex-1 ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {t.title}
                    </span>
                    {t.status && !isCompleted && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 rounded-full shrink-0">
                        {t.status}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Contact Type */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-1 rounded-lg transition-colors">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="text-blue-500"><Layers className="h-3.5 w-3.5" /></span> Contact Type
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
            1
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 pb-2">
          <div className="pt-1">
            {typeCfg ? (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${typeCfg.bg}`}>
                <span className={`h-2 w-2 rounded-full ${typeCfg.dot}`} />
                <span className={`text-[11px] font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>
              </div>
            ) : (
              <Badge variant="outline" className="text-[11px]">{person.contact_type}</Badge>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ══════════════════════════════════════════════════
// ── Main Panel ──
// ══════════════════════════════════════════════════
export default function PeopleDetailPanel({
  person,
  contactTypeConfig,
  teamMemberMap,
  teamMembers = [],
  onClose,
  onExpand,
  onContactTypeChange,
  onPersonUpdate,
}: PeopleDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'related'>('details');
  const queryClient = useQueryClient();
  const typeCfg = contactTypeConfig[person.contact_type ?? 'Other'];
  const initial = person.name[0]?.toUpperCase() ?? '?';
  const gradient = getAvatarGradient(person.name);

  const handleFieldSaved = useCallback((field: string, newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['people-list'] });
    if (onPersonUpdate) {
      if (field === 'tags') {
        try {
          onPersonUpdate({ ...person, tags: JSON.parse(newValue) });
        } catch {
          onPersonUpdate({ ...person });
        }
      } else {
        onPersonUpdate({ ...person, [field]: newValue || null });
      }
    }
    toast.success('Updated');
  }, [person, onPersonUpdate, queryClient]);

  return (
    <aside className="shrink-0 w-[380px] border-l border-border/60 bg-card flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0">
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #6d28d9, #8b5cf6, #a78bfa)' }} />

        <div className="px-5 pt-4 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md`}>
                {initial}
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-foreground truncate leading-tight">{person.name}</h2>
                {person.title && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Briefcase className="h-3 w-3 shrink-0" />
                    {person.title}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
              {onExpand && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Expand full view" onClick={onExpand}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {typeCfg && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${typeCfg.bg}`}>
                <span className={`h-2 w-2 rounded-full ${typeCfg.dot}`} />
                <span className={`text-xs font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>
              </div>
            )}
            {person.company_name && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{person.company_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 gap-1 border-b border-border">
          {(['details', 'activity', 'related'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all relative ${
                activeTab === tab ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'details' && (
        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-5">

            {/* Contact Type selector */}
            {onContactTypeChange && (
              <div className="rounded-lg border border-border p-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Contact Type</span>
                <Select value={person.contact_type ?? 'Other'} onValueChange={(v) => onContactTypeChange(person.id, v)}>
                  <SelectTrigger className="h-9 w-full text-xs border-border bg-card rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${typeCfg?.dot ?? 'bg-muted-foreground'}`} />
                      <SelectValue>{typeCfg?.label ?? person.contact_type}</SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
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
            )}

            {/* Contact info */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Contact</span>
              <div className="space-y-1.5">
                <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={person.name} field="name" personId={person.id} placeholder="Name" onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={person.email ?? ''} field="email" personId={person.id} placeholder="Add email..." onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={person.phone ?? ''} field="phone" personId={person.id} placeholder="Add phone..." onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Link2 className="h-3.5 w-3.5" />} value={person.linkedin ?? ''} field="linkedin" personId={person.id} placeholder="Add LinkedIn..." onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Details */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Details</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                <EditableField icon={<Briefcase className="h-3.5 w-3.5" />} label="Title" value={person.title ?? ''} field="title" personId={person.id} onSaved={handleFieldSaved} />
                <EditableField icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={person.company_name ?? ''} field="company_name" personId={person.id} onSaved={handleFieldSaved} />
                <EditableField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={person.source ?? ''} field="source" personId={person.id} onSaved={handleFieldSaved} />
                <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={formatDate(person.created_at)} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tags</span>
              <EditableTags tags={person.tags ?? []} personId={person.id} onSaved={handleFieldSaved} />
            </div>

            {/* Notes */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Notes</span>
              <EditableNotes value={person.notes ?? ''} personId={person.id} onSaved={handleFieldSaved} />
            </div>
          </div>
        </ScrollArea>
      )}

      {activeTab === 'activity' && (
        <ScrollArea className="flex-1">
          <ActivityTabContent person={person} contactTypeConfig={contactTypeConfig} />
        </ScrollArea>
      )}

      {activeTab === 'related' && (
        <ScrollArea className="flex-1">
          <RelatedTabContent person={person} contactTypeConfig={contactTypeConfig} />
        </ScrollArea>
      )}
    </aside>
  );
}
