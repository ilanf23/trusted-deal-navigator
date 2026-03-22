import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, DollarSign, Maximize2, Building2, User, Mail, Phone, PhoneCall,
  Tag, FileText, Clock, ArrowRight, ChevronRight, Briefcase, Hash,
  Pencil, Check, Loader2, MessageSquare, Users, CheckSquare, ChevronDown, Flag, Layers,
  FolderOpen, AtSign, MapPin, Trash2, Send, Bookmark, Copy, MoreHorizontal,
  CalendarDays, Eye, TrendingUp, Star, Globe,
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
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { differenceInDays, parseISO, format, formatDistanceToNow } from 'date-fns';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

interface LeadEmail { id: string; lead_id: string; email: string; email_type: string; is_primary: boolean; }
interface LeadPhone { id: string; lead_id: string; phone_number: string; phone_type: string; is_primary: boolean; }
interface LeadAddress { id: string; lead_id: string; address_type: string; address_line_1: string | null; address_line_2: string | null; city: string | null; state: string | null; zip_code: string | null; country: string | null; is_primary: boolean; }

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
  currentStageId?: string;
  teamMemberMap: Record<string, string>;
  teamMembers?: TeamMember[];
  formatValue: (v: number) => string;
  fakeValue: (id: string) => number;
  onClose: () => void;
  onExpand?: () => void;
  onStageChange?: (leadId: string, newStatus: string) => void;
  onLeadUpdate?: (updatedLead: Lead) => void;
}

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

// ── Copper-style underline field (label above, text below, bottom border) ──
function CopperUnderlineField({
  label, required, value, field, leadId, onSaved,
}: {
  label: string; required?: boolean; value: string; field: string;
  leadId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(leadId, field, value, onSaved);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  return (
    <div>
      <label className="text-sm text-muted-foreground block mb-2">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {editing ? (
        <div className="border-b-2 border-blue-500 pb-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            onBlur={save}
            disabled={saving}
            className="w-full text-base text-foreground bg-transparent outline-none px-1 py-1.5"
          />
          {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 absolute right-1 top-1/2 -translate-y-1/2" />}
        </div>
      ) : (
        <div onClick={() => setEditing(true)} className="border-b border-border pb-1 cursor-pointer group hover:border-muted-foreground transition-colors">
          <p className="text-base text-foreground py-1.5 px-1 truncate">
            {value || <span className="text-muted-foreground italic">—</span>}
          </p>
        </div>
      )}
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

// ── Editable Rich Text Field (generic — for notes, about, bank_relationships, etc.) ──
function EditableRichTextField({
  value, field, leadId, placeholder, onSaved,
}: {
  value: string; field: string; leadId: string; placeholder?: string;
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
          placeholder={placeholder ?? "Add notes..."}
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
        <p className="text-[13px] text-muted-foreground italic">{placeholder ?? 'Click to add notes...'}</p>
      )}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Click to edit</span>
      </div>
    </div>
  );
}

// ── Contact Email Row (satellite) ──
function ContactEmailRow({ entry, onDelete }: { entry: LeadEmail; onDelete: (id: string) => void }) {
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
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/admin/gmail?compose=new&to=${encodeURIComponent(entry.email)}`); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        title="Compose in Gmail"
      >
        <Send className="h-3 w-3 text-blue-500 hover:text-blue-600" />
      </button>
      <button onClick={() => onDelete(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
      </button>
    </div>
  );
}

// ── Contact Phone Row (satellite) ──
function ContactPhoneRow({ entry, onDelete, onCall }: { entry: LeadPhone; onDelete: (id: string) => void; onCall?: (phone: string) => void }) {
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

// ── Address Block (satellite) ──
function AddressBlock({ entry, onDelete }: { entry: LeadAddress; onDelete: (id: string) => void }) {
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
      const { data, error } = await supabase
        .from('communications')
        .select('id, communication_type, direction, content, duration_seconds, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['lead-activity-timeline', 'activities', lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('id, activity_type, title, content, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
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
  const navigate = useNavigate();
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
        .from('tasks')
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

  const { data: files = [] } = useQuery({
    queryKey: ['lead-files-count', lead.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('lead_files')
        .select('id')
        .eq('lead_id', lead.id);
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
          <div className="space-y-3 pt-1">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5 group">
                <div className={`h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[11px] font-bold text-gray-600 dark:text-gray-300 shrink-0 mt-0.5`}>
                  {c.name.split(' ').map((n: string) => n[0]?.toUpperCase()).join('').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p
                      className="text-[12px] font-semibold text-foreground truncate leading-tight hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
                      onClick={async () => {
                        const { data } = await supabase
                          .from('leads')
                          .select('id')
                          .ilike('name', c.name)
                          .limit(1)
                          .maybeSingle();
                        if (data) {
                          navigate(`/admin/contacts/people/expanded-view/${data.id}`);
                        } else {
                          toast.info('No matching person record found');
                        }
                      }}
                    >
                      {c.name}
                    </p>
                    {c.is_primary && (
                      <span className="flex items-center gap-0.5 text-[10px] text-foreground font-medium shrink-0">
                        <Bookmark className="h-3 w-3 fill-current" /> Primary
                      </span>
                    )}
                  </div>
                  {(c.title || lead.company_name) && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.title && <span className="text-blue-600 dark:text-blue-400">{c.title}</span>}
                      {c.title && lead.company_name && ' at '}
                      {lead.company_name && <span className="text-blue-600 dark:text-blue-400">{lead.company_name}</span>}
                    </p>
                  )}
                  {(c.phone || c.email) && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {c.phone && <span>{c.phone}</span>}
                      {c.phone && c.email && <span className="mx-1.5">|</span>}
                      {c.email && <span>{c.email}</span>}
                    </p>
                  )}
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

      {/* Files */}
      <RelatedSection icon={<FileText className="h-3.5 w-3.5" />} label="Files" count={files.length} iconColor="text-orange-500">
        <LeadFilesSection leadId={lead.id} leadName={lead.name} companyName={lead.company_name} />
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
  currentStageId,
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stageKeys = useMemo(() => Object.keys(stageConfig), [stageConfig]);
  const activeStageKey = currentStageId ?? lead.status;
  const stageCfg = stageConfig[activeStageKey];
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? '\u2014') : '\u2014';
  const dealValue = fakeValue(lead.id);
  const initial = lead.name[0]?.toUpperCase() ?? '?';
  const gradient = getAvatarGradient(lead.name);
  const daysInStage = daysSince(lead.updated_at);
  const currentStageIdx = stageKeys.indexOf(activeStageKey);

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

  // ── Satellite add-form state ──
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

  // ── Satellite queries ──
  const { data: leadEmails = [] } = useQuery({
    queryKey: ['lead-emails', lead.id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_emails').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadEmail[];
    },
  });

  const { data: leadPhones = [] } = useQuery({
    queryKey: ['lead-phones', lead.id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_phones').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadPhone[];
    },
  });

  const { data: leadAddresses = [] } = useQuery({
    queryKey: ['lead-addresses', lead.id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_addresses').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadAddress[];
    },
  });

  // ── Satellite mutations ──
  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('lead_emails').insert({ lead_id: lead.id, email, email_type: newEmailType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-emails', lead.id] });
      setNewEmail('');
      setShowAddEmail(false);
      toast.success('Email added');
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from('lead_emails').delete().eq('id', emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-emails', lead.id] });
      toast.success('Email removed');
    },
  });

  const addPhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await supabase.from('lead_phones').insert({ lead_id: lead.id, phone_number: phone, phone_type: newPhoneType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-phones', lead.id] });
      setNewPhone('');
      setShowAddPhone(false);
      toast.success('Phone added');
    },
  });

  const deletePhoneMutation = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase.from('lead_phones').delete().eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-phones', lead.id] });
      toast.success('Phone removed');
    },
  });

  const addAddressMutation = useMutation({
    mutationFn: async () => {
      if (!newAddressLine1.trim()) return;
      const { error } = await supabase.from('lead_addresses').insert({
        lead_id: lead.id,
        address_line_1: newAddressLine1.trim(),
        city: newAddressCity.trim() || null,
        state: newAddressState.trim() || null,
        zip_code: newAddressZip.trim() || null,
        address_type: newAddressType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', lead.id] });
      setNewAddressLine1('');
      setNewAddressCity('');
      setNewAddressState('');
      setNewAddressZip('');
      setNewAddressType('business');
      setShowAddAddress(false);
      toast.success('Address added');
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('lead_addresses').delete().eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', lead.id] });
      toast.success('Address removed');
    },
  });

  return (
    <aside className="shrink-0 w-[380px] border-l border-border/60 bg-card flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0">
        {/* Top control bar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Button className="bg-[#4a2b7a] hover:bg-[#3d2366] text-white rounded-full px-6 h-9 text-sm font-semibold shadow-sm">
              Follow
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contact card */}
        <div className="px-5 pt-5 pb-5">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
              <DollarSign className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-xl font-semibold text-foreground truncate leading-tight">{lead.name}</h2>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {[lead.company_name, formatValue(dealValue)].filter(Boolean).join(' / ')}
              </p>
              <div className="mt-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm font-medium">
                  <DollarSign className="h-3.5 w-3.5" />
                  Opportunity
                </span>
              </div>
            </div>
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

            {/* ── Copper CRM Field List ── */}

            {/* Name */}
            <CopperUnderlineField label="Name" required value={lead.name} field="name" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Pipeline */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Pipeline</label>
              <div className="border-b border-border pb-1">
                <p className="text-base text-foreground py-1.5 px-1">Underwriting</p>
              </div>
            </div>

            {/* Stage */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Stage</label>
              <div className="border-b border-border pb-1">
                {onStageChange ? (
                  <Select value={activeStageKey} onValueChange={(v) => onStageChange(lead.id, v)}>
                    <SelectTrigger className="h-10 w-full text-base text-foreground border-0 bg-transparent shadow-none px-1 rounded-none">
                      <SelectValue>{stageCfg?.label ?? lead.status}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {stageKeys.map((s) => {
                        const cfg = stageConfig[s];
                        return (
                          <SelectItem key={s} value={s} className="text-sm">
                            {cfg?.label ?? s}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-base text-foreground py-1.5 px-1">{stageCfg?.label ?? lead.status}</p>
                )}
              </div>
            </div>

            {/* CLX - File Name */}
            <CopperUnderlineField label="CLX - File Name" value={lead.clx_file_name ?? ''} field="clx_file_name" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Waiting On */}
            <CopperUnderlineField label="Waiting On" value={(lead as any).waiting_on ?? ''} field="waiting_on" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Tags */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Tags</label>
              <EditableTags tags={lead.tags ?? []} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>

            {/* Value */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Value</label>
              <div className="border-b border-border pb-1">
                <p className="text-base text-foreground py-1.5 px-1 tabular-nums">
                  {lead.deal_value != null ? (
                    <>{lead.deal_value.toLocaleString()}<br /><span className="text-sm text-muted-foreground">{formatValue(lead.deal_value)}</span></>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Description</label>
              <EditableRichTextField value={(lead as any).description ?? ''} field="description" leadId={lead.id} placeholder="Add Description" onSaved={handleFieldSaved} />
            </div>

            {/* Primary Contact */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Primary Contact</label>
              <div className="border-b border-border pb-3">
                <div className="flex items-center gap-3 px-1 py-1.5">
                  <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${getAvatarGradient(lead.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {lead.name[0]?.toUpperCase() ?? '?'}{lead.name.split(' ')[1]?.[0]?.toUpperCase() ?? ''}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base text-foreground truncate">{lead.name}</p>
                    {lead.title && <p className="text-xs text-muted-foreground truncate">{lead.title}</p>}
                  </div>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 px-1 py-1">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{formatPhoneNumber(lead.phone)}</span>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-2 px-1 py-1">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{lead.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status / Created */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Created</label>
              <div className="border-b border-border pb-1">
                <p className="text-base text-foreground py-1.5 px-1">{formatDate(lead.created_at)}</p>
              </div>
            </div>

            {/* Close Date */}
            <CopperUnderlineField label="Close Date" value={(lead as any).close_date ? formatDate((lead as any).close_date) : ''} field="close_date" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Loss Reason */}
            <CopperUnderlineField label="Loss Reason" value={(lead as any).loss_reason ?? ''} field="loss_reason" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Company */}
            <CopperUnderlineField label="Company" value={lead.company_name ?? ''} field="company_name" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Owner */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Owner</label>
              <div className="border-b border-border pb-1">
                {ownerOptions.length > 0 ? (
                  <Select value={lead.assigned_to ?? ''} onValueChange={async (v) => {
                    const { error } = await supabase.from('leads').update({ assigned_to: v || null }).eq('id', lead.id);
                    if (!error) { handleFieldSaved('assigned_to', v); }
                  }}>
                    <SelectTrigger className="h-10 w-full text-base text-foreground border-0 bg-transparent shadow-none px-1 rounded-none">
                      <SelectValue>{assignedName}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ownerOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-base text-foreground py-1.5 px-1">{assignedName}</p>
                )}
              </div>
            </div>

            {/* Source */}
            <CopperUnderlineField label="Source" value={lead.source ?? ''} field="source" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Priority */}
            <CopperUnderlineField label="Priority" value={(lead as any).priority ?? ''} field="priority" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Win Percentage */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Win Percentage</label>
              <div className="border-b border-border pb-1">
                <p className="text-base text-foreground py-1.5 px-1 tabular-nums">
                  {(lead as any).win_percentage != null ? (
                    <>{(lead as any).win_percentage}<br /><span className="text-sm text-muted-foreground">{(lead as any).win_percentage}%</span></>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </p>
              </div>
            </div>

            {/* Visibility */}
            <CopperUnderlineField label="Visibility" value={(lead as any).visibility ?? 'everyone'} field="visibility" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Email (satellite) */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Email</label>
              <div className="space-y-1">
                {leadEmails.map((e) => (
                  <ContactEmailRow key={e.id} entry={e} onDelete={(id) => deleteEmailMutation.mutate(id)} />
                ))}
                {showAddEmail ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
                    <AtSign className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <Select value={newEmailType} onValueChange={setNewEmailType}>
                      <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work" className="text-xs">Work</SelectItem>
                        <SelectItem value="personal" className="text-xs">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                    <input autoFocus value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newEmail.trim()) addEmailMutation.mutate(newEmail.trim()); if (e.key === 'Escape') { setShowAddEmail(false); setNewEmail(''); } }} placeholder="email@example.com" className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
                  </div>
                ) : (
                  <button onClick={() => setShowAddEmail(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-1 py-1">+ Add Email</button>
                )}
              </div>
            </div>

            {/* Phone (satellite) */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Phone</label>
              <div className="space-y-1">
                {leadPhones.map((p) => (
                  <ContactPhoneRow key={p.id} entry={p} onDelete={(id) => deletePhoneMutation.mutate(id)} onCall={(phone) => navigate(`/admin/calls?phone=${encodeURIComponent(phone.replace(/\D/g, ''))}&leadId=${lead.id}`)} />
                ))}
                {showAddPhone ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
                    <Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <Select value={newPhoneType} onValueChange={setNewPhoneType}>
                      <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work" className="text-xs">Work</SelectItem>
                        <SelectItem value="personal" className="text-xs">Personal</SelectItem>
                        <SelectItem value="mobile" className="text-xs">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                    <input autoFocus value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newPhone.trim()) addPhoneMutation.mutate(newPhone.trim()); if (e.key === 'Escape') { setShowAddPhone(false); setNewPhone(''); } }} placeholder="(555) 123-4567" className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
                  </div>
                ) : (
                  <button onClick={() => setShowAddPhone(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-1 py-1">+ Add Phone</button>
                )}
              </div>
            </div>

            {/* Address (satellite) */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Address</label>
              <div className="space-y-1">
                {leadAddresses.map((a) => (
                  <AddressBlock key={a.id} entry={a} onDelete={(id) => deleteAddressMutation.mutate(id)} />
                ))}
                {showAddAddress ? (
                  <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-2.5 space-y-2">
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
                  <button onClick={() => setShowAddAddress(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-1 py-1">+ Add Address</button>
                )}
              </div>
            </div>

            {/* About */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">About</label>
              <EditableRichTextField value={lead.about ?? lead.notes ?? ''} field="about" leadId={lead.id} placeholder="Add About" onSaved={handleFieldSaved} />
            </div>

            {/* History */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">History</label>
              <EditableRichTextField value={(lead as any).history ?? ''} field="history" leadId={lead.id} placeholder="Add History" onSaved={handleFieldSaved} />
            </div>

            {/* Bank Relationships */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Bank Relationships</label>
              <EditableRichTextField value={lead.bank_relationships ?? ''} field="bank_relationships" leadId={lead.id} placeholder="Add Bank Relationships" onSaved={handleFieldSaved} />
            </div>

            {/* #UW */}
            <CopperUnderlineField label="#UW" value={lead.uw_number ?? ''} field="uw_number" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Client Working with Other Lenders */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Client Working with Other Lenders</label>
              <div className="border-b border-border pb-1">
                <button
                  onClick={async () => {
                    const newVal = !lead.client_other_lenders;
                    const { error } = await supabase.from('leads').update({ client_other_lenders: newVal }).eq('id', lead.id);
                    if (!error) handleFieldSaved('client_other_lenders', String(newVal));
                  }}
                  className="text-base text-foreground py-1.5 px-1 hover:text-blue-600 transition-colors"
                >
                  {lead.client_other_lenders ? 'Yes' : 'No'}
                </button>
              </div>
            </div>

            {/* Weekly's */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Weekly's</label>
              <div className="border-b border-border pb-1">
                <button
                  onClick={async () => {
                    const newVal = !lead.flagged_for_weekly;
                    const { error } = await supabase.from('leads').update({ flagged_for_weekly: newVal }).eq('id', lead.id);
                    if (!error) handleFieldSaved('flagged_for_weekly', String(newVal));
                  }}
                  className="text-base text-foreground py-1.5 px-1 hover:text-blue-600 transition-colors"
                >
                  {lead.flagged_for_weekly ? 'Yes' : 'No'}
                </button>
              </div>
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
