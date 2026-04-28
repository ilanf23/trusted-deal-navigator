import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, DollarSign, Maximize2, Building2, User, Mail, Phone, PhoneCall, Hash,
  Tag, FileText, Clock, ArrowRight, ChevronRight, Briefcase,
  Pencil, Check, Loader2, MessageSquare, Users, CheckSquare, ChevronDown, Flag, Layers,
  FolderOpen, AtSign, MapPin, Trash2,
} from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { LeadFilesSection } from '@/components/admin/LeadFilesSection';
import { HtmlContent } from '@/components/ui/html-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { formatPhoneNumber } from './InlineEditableFields';
import { useInlineSave as useSharedInlineSave, persistInlineFieldChange } from './shared/useInlineSave';
import { EditableTextBox } from './shared/EditableTextBox';
import { PipelineSelectField } from './PipelineSelectField';
import { useUndo } from '@/contexts/UndoContext';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { AddOpportunityDialog } from './AddOpportunityDialog';
import { useAddOpportunityFromPanel } from './shared/useAddOpportunityFromPanel';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import type { CrmTable } from '@/hooks/usePipelineMutations';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { differenceInDays, parseISO, format, formatDistanceToNow } from 'date-fns';

type Lead = Database['public']['Tables']['potential']['Row'];

interface StageConfigEntry {
  title: string;
  color: string;
  dot: string;
  pill: string;
}

interface TeamMember {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface EntityEmail { id: string; entity_id: string; entity_type: string; email: string; email_type: string; is_primary: boolean; }
interface EntityPhone { id: string; entity_id: string; entity_type: string; phone_number: string; phone_type: string; is_primary: boolean; }
interface EntityAddress { id: string; entity_id: string; entity_type: string; address_type: string; address_line_1: string | null; address_line_2: string | null; city: string | null; state: string | null; zip_code: string | null; country: string | null; is_primary: boolean; }

interface PipelineDetailPanelProps {
  lead: Lead;
  stageConfig: Record<string, StageConfigEntry>;
  currentStageId?: string;
  teamMemberMap: Record<string, string>;
  teamMembers?: TeamMember[];
  formatValue?: (v: number) => string;
  fakeValue?: (id: string) => number;
  onClose: () => void;
  onExpand?: () => void;
  onStageChange?: (leadId: string, newStatus: string) => void;
  onLeadUpdate?: (updatedLead: Lead) => void;
  /** Which deal pipeline this lead belongs to. Drives entity_contacts filtering and the Add Opportunity default. Defaults to 'potential'. */
  tableName?: CrmTable;
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
  return useSharedInlineSave(leadId, field, currentValue, onSaved, undefined, 'potential');
}

// ── Editable Deal-details row ──
function EditableField({
  icon, label, value, field, leadId, highlight = false, onSaved,
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  leadId: string; highlight?: boolean;
  onSaved: (field: string, newValue: string) => void;
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
        tableName: 'potential',
      });
    },
    [leadId, field, value, onSaved, registerUndo],
  );

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 transition-colors overflow-hidden">
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
        className={`min-w-0 max-w-[70%] ${highlight ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-medium'}`}
        aria-label={label}
      />
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
      .from('potential')
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
        tableName: 'potential',
      });
    },
    [leadId, field, value, onSaved, registerUndo],
  );

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <EditableTextBox
        value={value || ''}
        onSave={handleSave}
        placeholder={placeholder}
        size="sm"
        format={field === 'phone' ? formatPhoneNumber : undefined}
        className="flex-1 min-w-0"
        aria-label={placeholder}
      />
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
      .from('potential')
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

// ── Editable Rich Text Field (generic) ──
function EditableRichTextField({
  value, leadId, field, onSaved, placeholder = 'Click to add...',
}: {
  value: string; leadId: string; field: string; placeholder?: string;
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
      .from('potential')
      .update({ [field]: trimmed || null })
      .eq('id', leadId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, value, field, leadId, onSaved]);

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

// ── Contact Email Row ──
function ContactEmailRow({ entry, onDelete }: { entry: EntityEmail; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors group">
      <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full capitalize shrink-0">
        {entry.email_type}
      </Badge>
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/admin/gmail?compose=new&to=${encodeURIComponent(entry.email)}`); }}
        className="text-[13px] text-foreground font-medium truncate flex-1 text-left hover:underline hover:text-blue-600 transition-colors"
      >
        {entry.email}
      </button>
      <button onClick={() => onDelete(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
      </button>
    </div>
  );
}

// ── Contact Phone Row ──
function ContactPhoneRow({ entry, onDelete, onCall }: { entry: EntityPhone; onDelete: (id: string) => void; onCall?: (phone: string) => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors group">
      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full capitalize shrink-0">
        {entry.phone_type}
      </Badge>
      <span className="text-[13px] text-foreground font-medium truncate flex-1">{formatPhoneNumber(entry.phone_number)}</span>
      {onCall && (
        <button onClick={() => onCall(entry.phone_number)} title="Call this number" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <PhoneCall className="h-3 w-3 text-green-600 hover:text-green-700" />
        </button>
      )}
      <button onClick={() => onDelete(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
      </button>
    </div>
  );
}

// ── Address Block ──
function AddressBlock({ entry, onDelete }: { entry: EntityAddress; onDelete: (id: string) => void }) {
  const parts = [entry.address_line_1, entry.address_line_2].filter(Boolean);
  const cityLine = [entry.city, entry.state, entry.zip_code].filter(Boolean).join(', ');
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors group">
      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {parts.map((p, i) => (
          <p key={i} className="text-[13px] text-foreground font-medium truncate">{p}</p>
        ))}
        {cityLine && <p className="text-[12px] text-muted-foreground truncate">{cityLine}</p>}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full capitalize mt-1">
          {entry.address_type}
        </Badge>
      </div>
      <button onClick={() => onDelete(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
      </button>
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
    queryKey: ['pipeline-activity-timeline', 'communications', lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('id, communication_type, direction, content, duration_seconds, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['pipeline-activity-timeline', 'activities', lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, activity_type, title, content, created_at')
        .eq('entity_id', lead.id)
        .eq('entity_type', 'potential')
        .order('created_at', { ascending: false });
      if (error) throw error;
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
                          {stageConfig[fromStage]?.title ?? fromStage}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stageConfig[toStage]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                          {stageConfig[toStage]?.title ?? toStage}
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
function RelatedTabContent({
  lead,
  stageConfig,
  tableName,
}: {
  lead: Lead;
  stageConfig: Record<string, StageConfigEntry>;
  tableName: CrmTable;
}) {
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['pipeline-related', 'contacts', lead.id, tableName],
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_contacts')
        .select('id, name, title, email, phone, is_primary')
        .eq('entity_id', lead.id)
        .eq('entity_type', tableName)
        .order('is_primary', { ascending: false });
      return data || [];
    },
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['pipeline-related', 'tasks', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, is_completed, due_date')
        .eq('lead_id', lead.id)
        .order('is_completed', { ascending: true })
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: milestones = [], isLoading: loadingMilestones } = useQuery({
    queryKey: ['pipeline-related', 'milestones', lead.id],
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
    queryKey: ['pipeline-related', 'waiting_on', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('deal_waiting_on')
        .select('id, owner, description, due_date, resolved_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ['pipeline-files-count', lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_files')
        .select('id')
        .eq('entity_id', lead.id)
        .eq('entity_type', 'potential');
      return data || [];
    },
  });

  const isLoading = loadingContacts || loadingTasks || loadingMilestones || loadingWaiting;

  const { data: assignableUsers = [] } = useAssignableUsers();
  const { setOpen: setAddOppOpen, dialogProps: addOppDialogProps } = useAddOpportunityFromPanel({
    defaultPipeline: tableName,
    sourceContacts: contacts,
    ownerOptions: assignableUsers.map((u) => ({ value: u.id, label: u.name })),
  });

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
      {/* Add Opportunity (tab-level action) */}
      <div className="pb-2">
        <Button
          type="button"
          onClick={() => setAddOppOpen(true)}
          className="h-8 px-3 text-[12px] font-semibold text-white bg-[#3b2778] hover:bg-[#4a3490]"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Opportunity
        </Button>
      </div>

      {/* People */}
      <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={contacts.length} iconColor="text-blue-500">
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">No contacts added</p>
        ) : (
          <div className="space-y-2 pt-1">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5">
                <CrmAvatar name={c.name} />
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
            <CrmAvatar name={lead.company_name} />
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

      {/* Files */}
      <RelatedSection icon={<FileText className="h-3.5 w-3.5" />} label="Files" count={files.length} iconColor="text-orange-500">
        <LeadFilesSection leadId={lead.id} leadName={lead.name} companyName={lead.company_name} />
      </RelatedSection>

      {/* Pipeline */}
      <RelatedSection icon={<Layers className="h-3.5 w-3.5" />} label="Pipeline" count={1} iconColor="text-blue-500">
        <div className="pt-1">
          {stageCfg ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full">
              <span className={`h-2 w-2 rounded-full ${stageCfg.dot}`} />
              <span className="text-[11px] font-semibold text-foreground">{stageCfg.title}</span>
            </div>
          ) : (
            <Badge variant="outline" className="text-[11px]">{lead.status}</Badge>
          )}
        </div>
      </RelatedSection>

      <AddOpportunityDialog {...addOppDialogProps} />
    </div>
  );
}

// ══════════════════════════════════════════════════
// ── Main Panel ──
// ══════════════════════════════════════════════════
export default function PipelineDetailPanel({
  lead,
  stageConfig,
  currentStageId,
  teamMemberMap,
  teamMembers = [],
  formatValue,
  fakeValue,
  onClose,
  onExpand,
  onStageChange,
  onLeadUpdate,
  tableName = 'potential',
}: PipelineDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'related'>('details');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stageKeys = useMemo(() => Object.keys(stageConfig), [stageConfig]);
  const activeStageKey = currentStageId ?? lead.status;
  const stageCfg = stageConfig[activeStageKey];
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? '\u2014') : '\u2014';
  const dealValue = fakeValue ? fakeValue(lead.id) : null;
  const daysInStage = daysSince(lead.updated_at);
  const currentStageIdx = stageKeys.indexOf(activeStageKey);

  const handleFieldSaved = useCallback((field: string, newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
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

  // ── Add-form state ──
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailType, setNewEmailType] = useState('work');
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneType, setNewPhoneType] = useState('work');
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddressLine1, setNewAddressLine1] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressZip, setNewAddressZip] = useState('');
  const [newAddressType, setNewAddressType] = useState('business');

  // ── Satellite table queries ──
  const { data: leadEmails = [] } = useQuery({
    queryKey: ['entity-emails', 'pipeline', lead?.id],
    queryFn: async () => {
      const { data } = await supabase.from('entity_emails').select('*').eq('entity_id', lead.id).eq('entity_type', 'potential');
      return (data || []) as EntityEmail[];
    },
    enabled: !!lead,
  });

  const { data: leadPhones = [] } = useQuery({
    queryKey: ['entity-phones', 'pipeline', lead?.id],
    queryFn: async () => {
      const { data } = await supabase.from('entity_phones').select('*').eq('entity_id', lead.id).eq('entity_type', 'potential');
      return (data || []) as EntityPhone[];
    },
    enabled: !!lead,
  });

  const { data: leadAddresses = [] } = useQuery({
    queryKey: ['entity-addresses', 'pipeline', lead?.id],
    queryFn: async () => {
      const { data } = await supabase.from('entity_addresses').select('*').eq('entity_id', lead.id).eq('entity_type', 'potential');
      return (data || []) as EntityAddress[];
    },
    enabled: !!lead,
  });

  // ── Satellite table mutations ──
  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('entity_emails').insert({ entity_id: lead.id, entity_type: 'potential', email, email_type: newEmailType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-emails', 'pipeline', lead?.id] });
      setNewEmail('');
      setShowAddEmail(false);
      toast.success('Email added');
    },
    onError: () => toast.error('Failed to add email'),
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from('entity_emails').delete().eq('id', emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-emails', 'pipeline', lead?.id] });
      toast.success('Email removed');
    },
  });

  const addPhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await supabase.from('entity_phones').insert({ entity_id: lead.id, entity_type: 'potential', phone_number: phone, phone_type: newPhoneType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-phones', 'pipeline', lead?.id] });
      setNewPhone('');
      setShowAddPhone(false);
      toast.success('Phone added');
    },
    onError: () => toast.error('Failed to add phone'),
  });

  const deletePhoneMutation = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase.from('entity_phones').delete().eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-phones', 'pipeline', lead?.id] });
      toast.success('Phone removed');
    },
  });

  const addAddressMutation = useMutation({
    mutationFn: async () => {
      if (!newAddressLine1.trim()) return;
      const { error } = await supabase.from('entity_addresses').insert({
        entity_id: lead.id,
        entity_type: 'potential',
        address_line_1: newAddressLine1.trim(),
        city: newAddressCity.trim() || null,
        state: newAddressState.trim() || null,
        zip_code: newAddressZip.trim() || null,
        address_type: newAddressType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-addresses', 'pipeline', lead?.id] });
      setNewAddressLine1('');
      setNewAddressCity('');
      setNewAddressState('');
      setNewAddressZip('');
      setShowAddAddress(false);
      toast.success('Address added');
    },
    onError: () => toast.error('Failed to add address'),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('entity_addresses').delete().eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-addresses', 'pipeline', lead?.id] });
      toast.success('Address removed');
    },
  });

  return (
    <aside className="absolute top-0 right-0 z-30 w-[380px] border-l border-border/60 bg-card flex flex-col max-h-full overflow-y-auto shadow-xl animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0">

        <div className="px-5 pt-4 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <CrmAvatar name={lead.name} imageUrl={lead.image_url} size="xl" />
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
              {dealValue != null && formatValue && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatValue(dealValue)}</span>
                </div>
              )}
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
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${stageCfg.pill}`}>
                <span className={`h-2 w-2 rounded-full ${stageCfg.dot}`} />
                <span className="text-xs font-semibold">{stageCfg.title}</span>
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
                {stageKeys.map((stageKey, idx) => {
                  const cfg = stageConfig[stageKey];
                  const isCurrent = stageKey === activeStageKey;
                  const isPast = idx < currentStageIdx;
                  return (
                    <div
                      key={stageKey}
                      title={cfg?.title ?? stageKey}
                      className={`flex-1 h-1.5 rounded-full transition-all ${
                        isCurrent ? `${cfg?.dot ?? 'bg-muted-foreground'} shadow-sm ring-2 ring-offset-1 ring-border` : isPast ? 'bg-blue-400' : 'bg-border'
                      }`}
                    />
                  );
                })}
              </div>
              {/* Stage dropdown */}
              {onStageChange && (
                <Select value={activeStageKey} onValueChange={(v) => onStageChange(lead.id, v)}>
                  <SelectTrigger className="h-9 w-full text-xs border-border bg-card rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${stageCfg?.dot ?? 'bg-muted-foreground'}`} />
                      <SelectValue>{stageCfg?.title ?? lead.status}</SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {stageKeys.map((s) => {
                      const cfg = stageConfig[s];
                      return (
                        <SelectItem key={s} value={s} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${cfg?.dot ?? 'bg-muted-foreground'}`} />
                            {cfg?.title ?? s}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Contact -- all editable */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Contact</span>
              <div className="space-y-1.5">
                <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={lead.name} field="name" leadId={lead.id} placeholder="Name" onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={lead.email ?? ''} field="email" leadId={lead.id} placeholder="Add email..." onSaved={handleFieldSaved} />
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={lead.phone ?? ''} field="phone" leadId={lead.id} placeholder="Add phone..." onSaved={handleFieldSaved} />
                  </div>
                  {lead.phone && (
                    <button
                      onClick={() => navigate(`/admin/calls?phone=${encodeURIComponent(lead.phone!.replace(/\D/g, ''))}&leadId=${lead.id}`)}
                      title="Call this number"
                      className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Deal Details -- all editable */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Deal Details</span>
              <div>
                <PipelineSelectField dealId={lead.id} currentPipeline="potential" variant="inline" icon={<Briefcase className="h-3.5 w-3.5" />} />
                <EditableField icon={<FolderOpen className="h-3.5 w-3.5" />} label="CLX File Name" value={lead.clx_file_name ?? ''} field="clx_file_name" leadId={lead.id} onSaved={handleFieldSaved} />
                <EditableField icon={<User className="h-3.5 w-3.5" />} label="Known As" value={lead.known_as ?? ''} field="known_as" leadId={lead.id} onSaved={handleFieldSaved} />
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
                <EditableField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={lead.source ?? ''} field="source" leadId={lead.id} onSaved={handleFieldSaved} />
                {dealValue != null && formatValue && (
                  <ReadOnlyField icon={<DollarSign className="h-3.5 w-3.5" />} label="Value" value={formatValue(dealValue)} />
                )}
                <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={formatDate(lead.created_at)} />
                <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Last Contacted" value={formatDate(lead.last_activity_at)} />
              </div>
            </div>

            {/* Tags -- editable */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tags</span>
              <EditableTags tags={lead.tags ?? []} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>

            {/* Email */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Email</span>
              <div className="space-y-1">
                {leadEmails.map((e) => (
                  <ContactEmailRow key={e.id} entry={e} onDelete={(id) => deleteEmailMutation.mutate(id)} />
                ))}
                {showAddEmail ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg">
                    <AtSign className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <Select value={newEmailType} onValueChange={setNewEmailType}>
                      <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work" className="text-xs">Work</SelectItem>
                        <SelectItem value="personal" className="text-xs">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                    <input autoFocus value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newEmail.trim()) addEmailMutation.mutate(newEmail.trim()); if (e.key === 'Escape') { setShowAddEmail(false); setNewEmail(''); } }} placeholder="email@example.com" className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
                  </div>
                ) : (
                  <button onClick={() => setShowAddEmail(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Email</button>
                )}
              </div>
            </div>

            {/* Phone */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Phone</span>
              <div className="space-y-1">
                {leadPhones.map((p) => (
                  <ContactPhoneRow key={p.id} entry={p} onDelete={(id) => deletePhoneMutation.mutate(id)} onCall={(phone) => navigate(`/admin/calls?phone=${encodeURIComponent(phone.replace(/\D/g, ''))}&leadId=${lead.id}`)} />
                ))}
                {showAddPhone ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg">
                    <Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <Select value={newPhoneType} onValueChange={setNewPhoneType}>
                      <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work" className="text-xs">Work</SelectItem>
                        <SelectItem value="personal" className="text-xs">Personal</SelectItem>
                        <SelectItem value="mobile" className="text-xs">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                    <input autoFocus value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newPhone.trim()) addPhoneMutation.mutate(newPhone.trim()); if (e.key === 'Escape') { setShowAddPhone(false); setNewPhone(''); } }} placeholder="(555) 123-4567" className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
                  </div>
                ) : (
                  <button onClick={() => setShowAddPhone(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Phone</button>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Address</span>
              <div className="space-y-1">
                {leadAddresses.map((a) => (
                  <AddressBlock key={a.id} entry={a} onDelete={(id) => deleteAddressMutation.mutate(id)} />
                ))}
                {showAddAddress ? (
                  <div className="rounded-lg p-2.5 space-y-2">
                    <input autoFocus value={newAddressLine1} onChange={(e) => setNewAddressLine1(e.target.value)} placeholder="Address line 1" className="w-full text-[13px] text-foreground bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
                    <div className="flex gap-1.5">
                      <input value={newAddressCity} onChange={(e) => setNewAddressCity(e.target.value)} placeholder="City" className="flex-1 text-[13px] bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
                      <input value={newAddressState} onChange={(e) => setNewAddressState(e.target.value)} placeholder="State" className="w-16 text-[13px] bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
                      <input value={newAddressZip} onChange={(e) => setNewAddressZip(e.target.value)} placeholder="Zip" className="w-20 text-[13px] bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Select value={newAddressType} onValueChange={setNewAddressType}>
                        <SelectTrigger className="h-8 w-[110px] text-xs border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="business" className="text-xs">Business</SelectItem>
                          <SelectItem value="home" className="text-xs">Home</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setShowAddAddress(false); setNewAddressLine1(''); setNewAddressCity(''); setNewAddressState(''); setNewAddressZip(''); }} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
                        <button onClick={() => addAddressMutation.mutate()} disabled={!newAddressLine1.trim()} className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md disabled:opacity-50">Save</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddAddress(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Address</button>
                )}
              </div>
            </div>

            {/* About */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">About</span>
              <EditableRichTextField value={lead.notes ?? ''} leadId={lead.id} field="notes" onSaved={handleFieldSaved} placeholder="Background info about this contact..." />
            </div>

            {/* Bank Relationships */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Bank Relationships</span>
              <EditableRichTextField value={lead.bank_relationships ?? ''} leadId={lead.id} field="bank_relationships" onSaved={handleFieldSaved} placeholder="Excluded lender names from CLX agreement..." />
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
          <RelatedTabContent lead={lead} stageConfig={stageConfig} tableName={tableName} />
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
