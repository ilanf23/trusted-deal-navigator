import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, DollarSign, Maximize2, Building2, User, Mail, Phone,
  Tag, FileText, Clock, ArrowRight, ChevronRight, Briefcase, Hash,
  Pencil, Check, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { differenceInDays, parseISO, format } from 'date-fns';

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
    'from-violet-500 to-purple-600',
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
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '—';
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
            className="w-full text-right text-[13px] font-medium text-slate-800 bg-white border border-violet-200 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all"
          />
          {saving && <Loader2 className="h-3 w-3 animate-spin text-violet-500 shrink-0" />}
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-slate-50/80 transition-colors cursor-pointer group">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-[13px] text-right truncate max-w-[170px] ${highlight ? 'font-bold text-emerald-700' : 'font-medium text-slate-800'}`}>
          {value || '—'}
        </span>
        <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
    <div className="flex items-center justify-between px-3.5 py-2 bg-white hover:bg-slate-50/80 transition-colors">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="h-7 w-auto min-w-[100px] text-[13px] font-medium text-slate-800 border-transparent hover:border-slate-200 bg-transparent shadow-none px-2 gap-1">
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
          className="flex-1 text-[13px] text-slate-700 bg-transparent outline-none placeholder:text-slate-300"
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-violet-500 shrink-0" />}
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50/80 hover:bg-slate-100/80 transition-colors group cursor-pointer">
      <div className="text-slate-400 group-hover:text-slate-500 shrink-0">{icon}</div>
      <span className={`text-[13px] truncate flex-1 ${value ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}`}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
      <div className="rounded-lg bg-violet-50/50 border border-violet-100 p-2.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={save}
          placeholder="tag1, tag2, tag3..."
          disabled={saving}
          className="w-full text-[13px] text-slate-700 bg-transparent outline-none placeholder:text-slate-300"
        />
        <p className="text-[10px] text-slate-400 mt-1">Comma-separated. Press Enter to save.</p>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-violet-500 mt-1" />}
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer group">
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 items-center">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[11px] px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border-violet-200 font-medium">
              {tag}
            </Badge>
          ))}
          <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-slate-400 italic">No tags</p>
          <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
          className="w-full text-[13px] text-slate-600 leading-relaxed bg-transparent outline-none resize-none placeholder:text-slate-300"
          rows={3}
        />
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-violet-100">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-violet-500" />}
          <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1">
            <Check className="h-3 w-3" />Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 cursor-pointer hover:border-slate-200 hover:bg-slate-50 transition-all group">
      {value ? (
        <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-[13px] text-slate-400 italic">Click to add notes...</p>
      )}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="h-3 w-3 text-slate-400" />
        <span className="text-[11px] text-slate-400">Click to edit</span>
      </div>
    </div>
  );
}

// ── Read-only row (Pipeline, Created) ──
function ReadOnlyField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 bg-white">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <span className="text-[13px] font-medium text-slate-800 text-right truncate max-w-[180px]">{value}</span>
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
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? '—') : '—';
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
    <aside className="shrink-0 w-[380px] border-l border-border/60 bg-white flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
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
                <h2 className="text-[15px] font-bold text-slate-900 truncate leading-tight">{lead.name}</h2>
                {lead.company_name && (
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3 shrink-0" />
                    {lead.company_name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
              {onExpand && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" title="Expand full view" onClick={onExpand}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-700 tabular-nums">{formatValue(dealValue)}</span>
            </div>
            {stageCfg && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${stageCfg.bg}`}>
                <span className={`h-2 w-2 rounded-full ${stageCfg.dot}`} />
                <span className={`text-xs font-semibold ${stageCfg.color}`}>{stageCfg.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 gap-1 border-b border-slate-100">
          {(['details', 'activity', 'related'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all relative ${
                activeTab === tab ? 'text-violet-700' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-violet-600" />
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
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Stage Progress</span>
                {daysInStage !== null && (
                  <span className={`text-[11px] font-medium flex items-center gap-1 ${daysInStage > 14 ? 'text-amber-600' : 'text-slate-400'}`}>
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
                        isCurrent ? `${cfg?.dot ?? 'bg-slate-500'} shadow-sm ring-2 ring-offset-1 ring-slate-200` : isPast ? 'bg-violet-400' : 'bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>
              {/* Stage dropdown */}
              {onStageChange && (
                <Select value={lead.status} onValueChange={(v) => onStageChange(lead.id, v as LeadStatus)}>
                  <SelectTrigger className="h-9 w-full text-xs border-slate-200 bg-white rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${stageCfg?.dot ?? 'bg-slate-400'}`} />
                      <SelectValue>{stageCfg?.label ?? lead.status}</SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {UNDERWRITING_STATUSES.map((s) => {
                      const cfg = stageConfig[s];
                      return (
                        <SelectItem key={s} value={s} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${cfg?.dot ?? 'bg-slate-400'}`} />
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
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Contact</span>
              <div className="space-y-1.5">
                <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={lead.name} field="name" leadId={lead.id} placeholder="Name" onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={lead.email ?? ''} field="email" leadId={lead.id} placeholder="Add email..." onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={lead.phone ?? ''} field="phone" leadId={lead.id} placeholder="Add phone..." onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Deal Details — all editable */}
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Deal Details</span>
              <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
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
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Tags</span>
              <EditableTags tags={lead.tags ?? []} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>

            {/* Notes — editable */}
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Notes</span>
              <EditableNotes value={lead.notes ?? ''} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>
          </div>
        </ScrollArea>
      )}

      {activeTab === 'activity' && (
        <ScrollArea className="flex-1">
          <div className="px-5 py-10 flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Clock className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-500">Activity timeline</p>
            <p className="text-xs text-slate-400 mt-0.5">Coming soon</p>
          </div>
        </ScrollArea>
      )}

      {activeTab === 'related' && (
        <ScrollArea className="flex-1">
          <div className="px-5 py-10 flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-500">Related records</p>
            <p className="text-xs text-slate-400 mt-0.5">Coming soon</p>
          </div>
        </ScrollArea>
      )}

      {/* Footer */}
      {onExpand && (
        <div className="shrink-0 px-5 py-3 border-t border-slate-100">
          <button onClick={onExpand} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors">
            Open full record
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </aside>
  );
}
