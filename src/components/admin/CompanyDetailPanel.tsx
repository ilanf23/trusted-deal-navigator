import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  X, Maximize2, Building2, User, Mail, Phone, Globe, ArrowRight,
  Tag, FileText, Clock, ChevronRight, Briefcase,
  Pencil, Check, Loader2, MessageSquare, Users, ChevronDown, Layers,
  FolderOpen, AtSign, MapPin, Trash2,
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
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format, formatDistanceToNow } from 'date-fns';

// ── Company type ──
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
  known_as: string | null;
  clx_file_name: string | null;
  bank_relationships: string | null;
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

interface CompanyDetailPanelProps {
  company: Company;
  contactTypeConfig: Record<string, ContactTypeConfigEntry>;
  teamMemberMap: Record<string, string>;
  teamMembers?: TeamMember[];
  onClose: () => void;
  onExpand?: () => void;
  onContactTypeChange?: (companyId: string, newType: string) => void;
  onCompanyUpdate?: (updatedCompany: Company) => void;
}

const CONTACT_TYPES = [
  'Client', 'Prospect', 'Referral Partner', 'Lender',
  'Attorney', 'CPA', 'Vendor', 'Other',
];

const contactTypeConfigDefault: Record<string, ContactTypeConfigEntry> = {
  Client: { label: 'Client', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500', pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  Prospect: { label: 'Prospect', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', dot: 'bg-blue-500', pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  'Referral Partner': { label: 'Referral Partner', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  Lender: { label: 'Lender', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800', dot: 'bg-violet-500', pill: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  Attorney: { label: 'Attorney', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800', dot: 'bg-rose-500', pill: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
  CPA: { label: 'CPA', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800', dot: 'bg-cyan-500', pill: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  Vendor: { label: 'Vendor', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800', dot: 'bg-orange-500', pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  Other: { label: 'Other', color: 'text-slate-700 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800', dot: 'bg-slate-500', pill: 'bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300' },
};

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

// ── Generic inline-save helper (leads table) ──
function useInlineSave(
  companyId: string,
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
    const fieldMap: Record<string, string> = { contact_name: 'name' };
    const dbField = fieldMap[field] || field;
    const { error } = await supabase
      .from('leads')
      .update({ [dbField]: trimmed || null })
      .eq('id', companyId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, currentValue, field, companyId, onSaved]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}

// ── Editable field row ──
function EditableField({
  icon, label, value, field, companyId, onSaved,
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  companyId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(companyId, field, value, onSaved);
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
  icon, value, field, companyId, placeholder, onSaved,
}: {
  icon: React.ReactNode; value: string; field: string;
  companyId: string; placeholder: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(companyId, field, value, onSaved);
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
      .from('leads')
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

// ── Editable Rich Text Field ──
function EditableRichTextField({
  value, companyId, field, onSaved, placeholder = 'Click to add...',
}: {
  value: string; companyId: string; field: string;
  onSaved: (field: string, newValue: string) => void;
  placeholder?: string;
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
      .from('leads')
      .update({ [field]: trimmed || null } as any)
      .eq('id', companyId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, value, field, companyId, onSaved]);

  if (editing) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3">
        <RichTextEditor
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
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
        <p className="text-[13px] text-muted-foreground italic">{placeholder}</p>
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

// ── Timeline icon config ──
const TIMELINE_ICON_CONFIG: Record<string, { icon: React.ReactNode; dotColor: string }> = {
  call: { icon: <Phone className="h-3 w-3" />, dotColor: 'bg-blue-500 text-white' },
  sms: { icon: <MessageSquare className="h-3 w-3" />, dotColor: 'bg-emerald-500 text-white' },
  email: { icon: <Mail className="h-3 w-3" />, dotColor: 'bg-amber-500 text-white' },
  comment: { icon: <MessageSquare className="h-3 w-3" />, dotColor: 'bg-slate-500 text-white' },
};

// ── Activity Tab Content ──
function ActivityTabContent({ company }: { company: Company }) {
  // First get lead IDs that match this company, then get communications for those leads
  const { data: communications = [], isLoading } = useQuery({
    queryKey: ['company-activity-timeline', company.company_name],
    queryFn: async () => {
      // Find leads associated with this company
      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('company_name', company.company_name);
      if (!leads || leads.length === 0) return [];
      const leadIds = leads.map((l) => l.id);
      const { data, error } = await supabase
        .from('communications')
        .select('id, communication_type, direction, content, duration_seconds, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const timelineItems = useMemo(() => {
    return communications.map((c) => {
      const typeLabel = c.communication_type === 'sms' ? 'SMS' : c.communication_type === 'call' ? 'Call' : 'Email';
      const dirLabel = c.direction === 'inbound' ? 'Inbound' : 'Outbound';
      return {
        id: c.id,
        type: c.communication_type,
        title: `${dirLabel} ${typeLabel}`,
        content: c.content,
        createdAt: c.created_at,
        direction: c.direction,
        durationSeconds: c.duration_seconds,
      };
    });
  }, [communications]);

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
      {timelineItems.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Communications will appear here</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-0.5">
            {timelineItems.map((item) => {
              const iconCfg = TIMELINE_ICON_CONFIG[item.type] ?? TIMELINE_ICON_CONFIG.comment;
              return (
                <div key={item.id} className="flex gap-3 py-2.5 relative">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 ${iconCfg.dotColor}`}>
                    {iconCfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground leading-tight">{item.title}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {item.content && (
                      <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{item.content}</p>
                    )}

                    {item.type === 'call' && item.durationSeconds != null && item.durationSeconds > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {Math.floor(item.durationSeconds / 60)}m {item.durationSeconds % 60}s
                      </p>
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
function RelatedTabContent({ company, contactTypeConfig }: { company: Company; contactTypeConfig: Record<string, ContactTypeConfigEntry> }) {
  const { data: relatedPeople = [], isLoading } = useQuery({
    queryKey: ['company-related-people', company.company_name],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, name, title, email, phone, contact_type')
        .eq('company_name', company.company_name)
        .order('name', { ascending: true });
      return data || [];
    },
  });

  if (isLoading) {
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

  return (
    <div className="px-5 py-4 space-y-1">
      {/* Associated People */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-1 rounded-lg transition-colors">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="text-indigo-500"><Users className="h-3.5 w-3.5" /></span> People
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
            {relatedPeople.length}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 pb-2">
          {relatedPeople.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1">No people associated</p>
          ) : (
            <div className="space-y-1.5 pt-1">
              {relatedPeople.map((person) => {
                const personTypeCfg = contactTypeConfig[person.contact_type ?? 'Other'];
                return (
                  <div key={person.id} className="flex items-center gap-2.5 py-1.5">
                    <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${getAvatarGradient(person.name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                      {person.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{person.name}</p>
                      {person.title && (
                        <p className="text-[11px] text-muted-foreground truncate">{person.title}</p>
                      )}
                    </div>
                    {personTypeCfg && (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${personTypeCfg.pill}`}>
                        {personTypeCfg.label}
                      </span>
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
            {(() => {
              const typeCfg = contactTypeConfig[company.contact_type ?? 'Other'];
              return typeCfg ? (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${typeCfg.bg}`}>
                  <span className={`h-2 w-2 rounded-full ${typeCfg.dot}`} />
                  <span className={`text-[11px] font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>
                </div>
              ) : (
                <Badge variant="outline" className="text-[11px]">{company.contact_type}</Badge>
              );
            })()}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ══════════════════════════════════════════════════
// ── Main Panel ──
// ══════════════════════════════════════════════════
export default function CompanyDetailPanel({
  company,
  contactTypeConfig,
  teamMemberMap,
  teamMembers = [],
  onClose,
  onExpand,
  onContactTypeChange,
  onCompanyUpdate,
}: CompanyDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'related'>('details');
  const queryClient = useQueryClient();
  const typeCfg = contactTypeConfig[company.contact_type ?? 'Other'];
  const initial = company.company_name[0]?.toUpperCase() ?? '?';
  const gradient = getAvatarGradient(company.company_name);

  const handleFieldSaved = useCallback((field: string, newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
    if (onCompanyUpdate) {
      if (field === 'tags') {
        try {
          onCompanyUpdate({ ...company, tags: JSON.parse(newValue) });
        } catch {
          onCompanyUpdate({ ...company });
        }
      } else {
        onCompanyUpdate({ ...company, [field]: newValue || null });
      }
    }
    toast.success('Updated');
  }, [company, onCompanyUpdate, queryClient]);

  // Owner dropdown handler
  const handleOwnerChange = useCallback(async (newOwnerId: string) => {
    const { error } = await supabase
      .from('leads')
      .update({ assigned_to: newOwnerId || null })
      .eq('id', company.id);
    if (error) {
      toast.error('Failed to update owner');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
    if (onCompanyUpdate) {
      onCompanyUpdate({ ...company, assigned_to: newOwnerId || null });
    }
    toast.success('Updated');
  }, [company, onCompanyUpdate, queryClient]);

  return (
    <aside className="shrink-0 w-[380px] border-l border-border/60 bg-card flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0">
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #6d28d9, #8b5cf6, #a78bfa)' }} />

        <div className="px-5 pt-4 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-10 w-10 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md`}>
                {initial}
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-foreground truncate leading-tight">{company.company_name}</h2>
                {company.contact_name && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <User className="h-3 w-3 shrink-0" />
                    {company.contact_name}
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
            {company.website && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground truncate max-w-[140px]">{company.website}</span>
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
                <Select value={company.contact_type ?? 'Other'} onValueChange={(v) => onContactTypeChange(company.id, v)}>
                  <SelectTrigger className="h-9 w-full text-xs border-border bg-card rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${typeCfg?.dot ?? 'bg-muted-foreground'}`} />
                      <SelectValue>{typeCfg?.label ?? company.contact_type}</SelectValue>
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

            {/* Company info */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Company Info</span>
              <div className="space-y-1.5">
                <EditableContactRow icon={<Building2 className="h-3.5 w-3.5" />} value={company.company_name} field="company_name" companyId={company.id} placeholder="Company name" onSaved={handleFieldSaved} />
                <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={company.contact_name ?? ''} field="contact_name" companyId={company.id} placeholder="Add contact name..." onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={company.phone ?? ''} field="phone" companyId={company.id} placeholder="Add phone..." onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={company.email_domain ?? ''} field="email_domain" companyId={company.id} placeholder="Add email domain..." onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Globe className="h-3.5 w-3.5" />} value={company.website ?? ''} field="website" companyId={company.id} placeholder="Add website..." onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Owner */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Owner</span>
              <div className="rounded-xl border border-border overflow-hidden">
                {teamMembers.length > 0 ? (
                  <div className="px-3 py-2">
                    <Select value={company.assigned_to ?? 'unassigned'} onValueChange={(v) => handleOwnerChange(v === 'unassigned' ? '' : v)}>
                      <SelectTrigger className="h-9 w-full text-xs border-border bg-card rounded-lg">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <SelectValue>
                            {company.assigned_to
                              ? teamMemberMap[company.assigned_to] ?? 'Unknown'
                              : 'Unassigned'}
                          </SelectValue>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                        {teamMembers.map((tm) => (
                          <SelectItem key={tm.id} value={tm.id} className="text-xs">
                            <div className="flex items-center gap-2">
                              {tm.avatar_url ? (
                                <img src={tm.avatar_url} alt="" className="h-4 w-4 rounded-full" />
                              ) : (
                                <div className={`h-4 w-4 rounded-full bg-gradient-to-br ${getAvatarGradient(tm.name)} flex items-center justify-center text-white text-[8px] font-bold`}>
                                  {tm.name[0]?.toUpperCase()}
                                </div>
                              )}
                              {tm.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <ReadOnlyField
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="Owner"
                    value={company.assigned_to ? (teamMemberMap[company.assigned_to] ?? 'Unknown') : 'Unassigned'}
                  />
                )}
              </div>
            </div>

            {/* Details */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Details</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                <EditableField icon={<User className="h-3.5 w-3.5" />} label="Known As" value={company.known_as ?? ''} field="known_as" companyId={company.id} onSaved={handleFieldSaved} />
                <EditableField icon={<FolderOpen className="h-3.5 w-3.5" />} label="CLX File Name" value={company.clx_file_name ?? ''} field="clx_file_name" companyId={company.id} onSaved={handleFieldSaved} />
                <EditableField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={company.source ?? ''} field="source" companyId={company.id} onSaved={handleFieldSaved} />
                <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Last Contacted" value={formatDate(company.last_activity_at)} />
                <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={formatDate(company.created_at)} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tags</span>
              <EditableTags tags={company.tags ?? []} companyId={company.id} onSaved={handleFieldSaved} />
            </div>

            {/* About */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">About</span>
              <EditableRichTextField value={company.notes ?? ''} companyId={company.id} field="notes" onSaved={handleFieldSaved} placeholder="Background info about this company..." />
            </div>

            {/* Bank Relationships */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Bank Relationships</span>
              <EditableRichTextField value={company.bank_relationships ?? ''} companyId={company.id} field="bank_relationships" onSaved={handleFieldSaved} placeholder="Excluded lender names from CLX agreement..." />
            </div>
          </div>
        </ScrollArea>
      )}

      {activeTab === 'activity' && (
        <ScrollArea className="flex-1">
          <ActivityTabContent company={company} />
        </ScrollArea>
      )}

      {activeTab === 'related' && (
        <ScrollArea className="flex-1">
          <RelatedTabContent company={company} contactTypeConfig={contactTypeConfig} />
        </ScrollArea>
      )}

      {/* ── Footer ── */}
      {onExpand && (
        <div className="shrink-0 border-t border-border px-5 py-3">
          <Button
            variant="outline"
            className="w-full h-9 text-xs font-semibold gap-2"
            onClick={onExpand}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Open full record
          </Button>
        </div>
      )}
    </aside>
  );
}

export { contactTypeConfigDefault };
export type { Company, CompanyDetailPanelProps };
