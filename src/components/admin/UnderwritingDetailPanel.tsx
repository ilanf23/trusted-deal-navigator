import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X, DollarSign, Maximize2, Building2, User, Mail, Phone,
  Tag, FileText, Clock, ArrowRight, ChevronRight, Briefcase, Hash,
  Pencil, Check, Loader2, MessageSquare, Users, CheckSquare, ChevronDown, Flag, Layers,
} from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { differenceInDays, parseISO, format, formatDistanceToNow } from 'date-fns';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

interface StageConfigEntry {
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

interface UnderwritingDetailPanelProps {
  lead: Lead;
  stageConfig: Record<string, StageConfigEntry>;
  teamMemberMap: Record<string, string>;
  teamMembers?: TeamMember[];
  formatValue: (v: number) => string;
  fakeValue: (id: string) => number;
  onClose: () => void;
  onExpand?: () => void;
  onStageChange?: (leadId: string, newStatus: LeadStatus) => void;
  onLeadUpdate?: (updatedLead: Lead) => void;
}

const UNDERWRITING_STATUSES: LeadStatus[] = [
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
  leadId: string,
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
      .eq('id', leadId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, currentValue, field, leadId, onSaved]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}

// ── Editable Deal-details row ──
function EditableField({
  icon, label, value, field, leadId, highlight = false, onSaved,
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  leadId: string; highlight?: boolean;
  onSaved: (field: string, newValue: string) => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(leadId, field, value, onSaved);
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
        <span className={`text-[13px] text-right truncate ${highlight ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-medium text-foreground'}`}>
          {value || '\u2014'}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}

// ── Select-based editable row (Owned By) ──
function EditableSelectField({
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
    <div className="px-3 py-2 hover:bg-muted/40 transition-colors space-y-1.5">
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
function EditableContactRow({
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
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

// ── Editable Tags ──
function EditableTags({
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
    // Pass as JSON for the parent to parse
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
  value, leadId, onSaved,
}: {
  value: string; leadId: string;
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

// ── Read-only row (Pipeline, Created) ──
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
  stage_change: { icon: <ArrowRight className="h-3 w-3" />, dotColor: 'bg-blue-500 text-white' },
  call: { icon: <Phone className="h-3 w-3" />, dotColor: 'bg-blue-500 text-white' },
  sms: { icon: <MessageSquare className="h-3 w-3" />, dotColor: 'bg-emerald-500 text-white' },
  email: { icon: <Mail className="h-3 w-3" />, dotColor: 'bg-amber-500 text-white' },
  comment: { icon: <MessageSquare className="h-3 w-3" />, dotColor: 'bg-slate-500 text-white' },
  meeting: { icon: <Users className="h-3 w-3" />, dotColor: 'bg-rose-500 text-white' },
};

// ── Related Section (collapsible) ──
function RelatedSection({ icon, label, count, iconColor, children }: {
  icon: React.ReactNode; label: string; count: number; iconColor?: string; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-1 rounded-lg transition-colors">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className={iconColor}>{icon}</span> {label}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
          {count}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Activity Tab Content ──
function ActivityTabContent({ lead, stageConfig }: { lead: Lead; stageConfig: Record<string, StageConfigEntry> }) {
  const { data: communications = [], isLoading: loadingComms } = useQuery({
    queryKey: ['lead-activity-timeline', 'communications', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('evan_communications')
        .select('id, communication_type, direction, content, duration_seconds, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['lead-activity-timeline', 'activities', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_activities')
        .select('id, activity_type, title, content, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const isLoading = loadingComms || loadingActivities;

  interface TimelineItem {
    id: string;
    type: string;
    title: string;
    content: string | null;
    createdAt: string;
    source: 'communication' | 'activity';
    direction?: string;
    durationSeconds?: number | null;
  }

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    for (const c of communications) {
      const typeLabel = c.communication_type === 'sms' ? 'SMS' : c.communication_type === 'call' ? 'Call' : 'Email';
      const dirLabel = c.direction === 'inbound' ? 'Inbound' : 'Outbound';
      items.push({
        id: c.id,
        type: c.communication_type,
        title: `${dirLabel} ${typeLabel}`,
        content: c.content,
        createdAt: c.created_at,
        source: 'communication',
        direction: c.direction,
        durationSeconds: c.duration_seconds,
      });
    }

    for (const a of activities) {
      items.push({
        id: a.id,
        type: a.activity_type,
        title: a.title ?? a.activity_type,
        content: a.content,
        createdAt: a.created_at,
        source: 'activity',
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }, [communications, activities]);

  if (isLoading) {
    return (
      <div className="px-5 py-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
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
          <p className="text-xs text-muted-foreground mt-0.5">Communications and events will appear here</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-0.5">
            {timelineItems.map((item) => {
              const iconCfg = TIMELINE_ICON_CONFIG[item.type] ?? TIMELINE_ICON_CONFIG.comment;

              // Parse stage_change content for badges
              let fromStage: string | null = null;
              let toStage: string | null = null;
              if (item.type === 'stage_change' && item.content) {
                try {
                  const parsed = JSON.parse(item.content);
                  fromStage = parsed.from;
                  toStage = parsed.to;
                } catch { /* ignore */ }
              }

              return (
                <div key={item.id} className="flex gap-3 py-2.5 relative">
                  {/* Icon dot */}
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 ${iconCfg.dotColor}`}>
                    {iconCfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground leading-tight">{item.title}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Stage change badges */}
                    {item.type === 'stage_change' && fromStage && toStage && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stageConfig[fromStage]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                          {stageConfig[fromStage]?.label ?? fromStage}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stageConfig[toStage]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                          {stageConfig[toStage]?.label ?? toStage}
                        </span>
                      </div>
                    )}

                    {/* Communication content preview */}
                    {item.type !== 'stage_change' && item.content && (
                      <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{item.content}</p>
                    )}

                    {/* Call duration */}
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
function RelatedTabContent({ lead, stageConfig }: { lead: Lead; stageConfig: Record<string, StageConfigEntry> }) {
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['lead-related', 'contacts', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_contacts')
        .select('id, name, title, email, phone, is_primary')
        .eq('lead_id', lead.id)
        .order('is_primary', { ascending: false });
      return data || [];
    },
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['lead-related', 'tasks', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('evan_tasks')
        .select('id, title, status, is_completed, due_date')
        .eq('lead_id', lead.id)
        .order('is_completed', { ascending: true })
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: milestones = [], isLoading: loadingMilestones } = useQuery({
    queryKey: ['lead-related', 'milestones', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('deal_milestones')
        .select('id, milestone_name, completed, completed_at, position')
        .eq('lead_id', lead.id)
        .order('position', { ascending: true });
      return data || [];
    },
  });

  const { data: waitingOn = [], isLoading: loadingWaiting } = useQuery({
    queryKey: ['lead-related', 'waiting_on', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('deal_waiting_on')
        .select('id, owner, description, due_date, resolved_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const isLoading = loadingContacts || loadingTasks || loadingMilestones || loadingWaiting;

  if (isLoading) {
    return (
      <div className="px-5 py-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const stageCfg = stageConfig[lead.status];
  const openWaiting = waitingOn.filter((w) => !w.resolved_at);

  return (
    <div className="px-5 py-4 space-y-1">
      {/* People */}
      <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={contacts.length} iconColor="text-blue-500">
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">No contacts added</p>
        ) : (
          <div className="space-y-2 pt-1">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5">
                <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${getAvatarGradient(c.name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                  {c.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate leading-tight">
                    {c.name}
                    {c.is_primary && <span className="ml-1 text-[10px] text-blue-500 dark:text-blue-400 font-semibold">Primary</span>}
                  </p>
                  {c.title && <p className="text-[11px] text-muted-foreground truncate">{c.title}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </RelatedSection>

      {/* Company */}
      <RelatedSection icon={<Building2 className="h-3.5 w-3.5" />} label="Company" count={lead.company_name ? 1 : 0} iconColor="text-indigo-500">
        {lead.company_name ? (
          <div className="flex items-center gap-2.5 pt-1">
            <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(lead.company_name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
              {lead.company_name[0]?.toUpperCase() ?? '?'}
            </div>
            <p className="text-[12px] font-medium text-foreground">{lead.company_name}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic py-1">No company set</p>
        )}
      </RelatedSection>

      {/* Tasks */}
      <RelatedSection icon={<CheckSquare className="h-3.5 w-3.5" />} label="Tasks" count={tasks.length} iconColor="text-emerald-500">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">No tasks</p>
        ) : (
          <div className="space-y-1.5 pt-1">
            {tasks.map((t) => (
              <div key={t.id} className={`flex items-center gap-2 ${t.is_completed ? 'opacity-50' : ''}`}>
                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                  t.is_completed ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700' : 'border-border'
                }`}>
                  {t.is_completed && <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />}
                </div>
                <span className={`text-[12px] truncate flex-1 ${t.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {t.title}
                </span>
                {t.status && !t.is_completed && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 rounded-full shrink-0">
                    {t.status}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </RelatedSection>

      {/* Milestones */}
      <RelatedSection icon={<Flag className="h-3.5 w-3.5" />} label="Milestones" count={milestones.length} iconColor="text-amber-500">
        {milestones.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">No milestones</p>
        ) : (
          <div className="space-y-1.5 pt-1">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                  m.completed ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700' : 'border-border'
                }`}>
                  {m.completed && <Check className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />}
                </div>
                <span className={`text-[12px] truncate flex-1 ${m.completed ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {m.milestone_name}
                </span>
                {m.completed_at && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(m.completed_at)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </RelatedSection>

      {/* Waiting On */}
      <RelatedSection icon={<Clock className="h-3.5 w-3.5" />} label="Waiting On" count={openWaiting.length} iconColor="text-rose-500">
        {openWaiting.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">Nothing pending</p>
        ) : (
          <div className="space-y-2 pt-1">
            {openWaiting.map((w) => {
              const isOverdue = w.due_date && new Date(w.due_date) < new Date();
              return (
                <div key={w.id} className={`rounded-lg border p-2 ${isOverdue ? 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30' : 'border-border bg-muted/30'}`}>
                  <p className={`text-[12px] font-medium ${isOverdue ? 'text-rose-700 dark:text-rose-400' : 'text-foreground'}`}>{w.owner}</p>
                  {w.description && <p className="text-[11px] text-muted-foreground mt-0.5">{w.description}</p>}
                  {w.due_date && (
                    <p className={`text-[10px] mt-1 ${isOverdue ? 'text-rose-500 dark:text-rose-400 font-medium' : 'text-muted-foreground'}`}>
                      {isOverdue ? 'Overdue: ' : 'Due: '}{formatDate(w.due_date)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </RelatedSection>

      {/* Pipeline */}
      <RelatedSection icon={<Layers className="h-3.5 w-3.5" />} label="Pipeline" count={1} iconColor="text-blue-500">
        <div className="pt-1">
          {stageCfg ? (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${stageCfg.bg}`}>
              <span className={`h-2 w-2 rounded-full ${stageCfg.dot}`} />
              <span className={`text-[11px] font-semibold ${stageCfg.color}`}>{stageCfg.label}</span>
            </div>
          ) : (
            <Badge variant="outline" className="text-[11px]">{lead.status}</Badge>
          )}
        </div>
      </RelatedSection>
    </div>
  );
}

// ══════════════════════════════════════════════════
// ── Main Panel ──
// ══════════════════════════════════════════════════
export default function UnderwritingDetailPanel({
  lead,
  stageConfig,
  teamMemberMap,
  teamMembers = [],
  formatValue,
  fakeValue,
  onClose,
  onExpand,
  onStageChange,
  onLeadUpdate,
}: UnderwritingDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'related'>('details');
  const queryClient = useQueryClient();
  const stageCfg = stageConfig[lead.status];
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? '\u2014') : '\u2014';
  const dealValue = fakeValue(lead.id);
  const initial = lead.name[0]?.toUpperCase() ?? '?';
  const gradient = getAvatarGradient(lead.name);
  const daysInStage = daysSince(lead.updated_at);
  const currentStageIdx = UNDERWRITING_STATUSES.indexOf(lead.status as LeadStatus);

  const handleFieldSaved = useCallback((field: string, newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
    if (onLeadUpdate) {
      if (field === 'tags') {
        // newValue is JSON-encoded
        try {
          onLeadUpdate({ ...lead, tags: JSON.parse(newValue) });
        } catch {
          onLeadUpdate({ ...lead });
        }
      } else {
        onLeadUpdate({ ...lead, [field]: newValue || null });
      }
    }
    toast.success('Updated');
  }, [lead, onLeadUpdate, queryClient]);

  const ownerOptions = teamMembers.map((m) => ({ value: m.id, label: m.name }));

  return (
    <aside className="shrink-0 w-[380px] border-l border-border/60 bg-card flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0">
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #6d28d9, #8b5cf6, #a78bfa)' }} />

        <div className="px-5 pt-4 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md`}>
                {initial}
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-foreground truncate leading-tight">{lead.name}</h2>
                {lead.company_name && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3 shrink-0" />
                    {lead.company_name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatValue(dealValue)}</span>
              </div>
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
            {stageCfg && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${stageCfg.bg}`}>
                <span className={`h-2 w-2 rounded-full ${stageCfg.dot}`} />
                <span className={`text-xs font-semibold ${stageCfg.color}`}>{stageCfg.label}</span>
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

            {/* Stage Progress */}
            <div className="rounded-xl border border-border p-3.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Stage Progress</span>
                {daysInStage !== null && (
                  <span className={`text-[11px] font-medium flex items-center gap-1 ${daysInStage > 14 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                    <Clock className="h-3 w-3" />
                    {daysInStage}d in stage
                  </span>
                )}
              </div>
              {/* Progress dots */}
              <div className="flex items-center gap-0.5 mb-3">
                {UNDERWRITING_STATUSES.map((status, idx) => {
                  const cfg = stageConfig[status];
                  const isCurrent = status === lead.status;
                  const isPast = idx < currentStageIdx;
                  return (
                    <div
                      key={status}
                      title={cfg?.label ?? status}
                      className={`flex-1 h-1.5 rounded-full transition-all ${
                        isCurrent ? `${cfg?.dot ?? 'bg-muted-foreground'} shadow-sm ring-2 ring-offset-1 ring-border` : isPast ? 'bg-blue-400' : 'bg-border'
                      }`}
                    />
                  );
                })}
              </div>
              {/* Stage dropdown */}
              {onStageChange && (
                <Select value={lead.status} onValueChange={(v) => onStageChange(lead.id, v as LeadStatus)}>
                  <SelectTrigger className="h-9 w-full text-xs border-border bg-card rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${stageCfg?.dot ?? 'bg-muted-foreground'}`} />
                      <SelectValue>{stageCfg?.label ?? lead.status}</SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {UNDERWRITING_STATUSES.map((s) => {
                      const cfg = stageConfig[s];
                      return (
                        <SelectItem key={s} value={s} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${cfg?.dot ?? 'bg-muted-foreground'}`} />
                            {cfg?.label ?? s}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Contact — all editable */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Contact</span>
              <div className="space-y-1.5">
                <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={lead.name} field="name" leadId={lead.id} placeholder="Name" onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={lead.email ?? ''} field="email" leadId={lead.id} placeholder="Add email..." onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={lead.phone ?? ''} field="phone" leadId={lead.id} placeholder="Add phone..." onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Deal Details — all editable */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Deal Details</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                <ReadOnlyField icon={<Briefcase className="h-3.5 w-3.5" />} label="Pipeline" value="Underwriting" />
                <EditableField icon={<Hash className="h-3.5 w-3.5" />} label="CLX File" value={lead.company_name ?? ''} field="company_name" leadId={lead.id} onSaved={handleFieldSaved} />
                {ownerOptions.length > 0 ? (
                  <EditableSelectField
                    icon={<User className="h-3.5 w-3.5" />}
                    label="Owned By"
                    value={lead.assigned_to ?? ''}
                    displayValue={assignedName}
                    field="assigned_to"
                    leadId={lead.id}
                    options={ownerOptions}
                    onSaved={handleFieldSaved}
                  />
                ) : (
                  <EditableField icon={<User className="h-3.5 w-3.5" />} label="Owned By" value={assignedName} field="assigned_to" leadId={lead.id} onSaved={handleFieldSaved} />
                )}
                <EditableField icon={<FileText className="h-3.5 w-3.5" />} label="UW Number" value={lead.uw_number ?? ''} field="uw_number" leadId={lead.id} onSaved={handleFieldSaved} />
                <ReadOnlyField icon={<DollarSign className="h-3.5 w-3.5" />} label="Value" value={formatValue(dealValue)} />
                <EditableField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={lead.source ?? ''} field="source" leadId={lead.id} onSaved={handleFieldSaved} />
                <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={formatDate(lead.created_at)} />
              </div>
            </div>

            {/* Tags — editable */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tags</span>
              <EditableTags tags={lead.tags ?? []} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>

            {/* Notes — editable */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Notes</span>
              <EditableNotes value={lead.notes ?? ''} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>
          </div>
        </ScrollArea>
      )}

      {activeTab === 'activity' && (
        <ScrollArea className="flex-1">
          <ActivityTabContent lead={lead} stageConfig={stageConfig} />
        </ScrollArea>
      )}

      {activeTab === 'related' && (
        <ScrollArea className="flex-1">
          <RelatedTabContent lead={lead} stageConfig={stageConfig} />
        </ScrollArea>
      )}

      {/* Footer */}
      {onExpand && (
        <div className="shrink-0 px-5 py-3 border-t border-border">
          <button onClick={onExpand} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
            Open full record
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </aside>
  );
}
