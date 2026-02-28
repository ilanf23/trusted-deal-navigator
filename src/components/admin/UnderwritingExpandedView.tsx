import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  X, DollarSign, ChevronDown, ChevronRight,
  Users, Building2, CheckSquare, FileText,
  CalendarDays, FolderOpen, Layers, Plus,
  MessageSquare, Pencil, Activity, Clock, AlertCircle, TrendingUp,
  User, Mail, Phone, Hash, Tag, Briefcase, Loader2,
} from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format } from 'date-fns';

import {
  UNDERWRITING_STATUSES,
  stageConfig as canonicalStageConfig,
  EditableField,
  EditableSelectField,
  EditableContactRow,
  EditableTags,
  EditableNotes,
  ReadOnlyField,
} from './InlineEditableFields';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const VALUE_BUCKETS = [25000, 50000, 75000, 100000, 150000, 200000, 250000, 350000, 500000, 750000];

function seededRand(seed: string, index: number): number {
  let h = index * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 16;
  }
  return Math.abs(h) / 0xffffffff;
}

function fakeValue(id: string): number {
  return VALUE_BUCKETS[Math.floor(seededRand(id, 1) * VALUE_BUCKETS.length)];
}

function formatValue(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try { return differenceInDays(new Date(), parseISO(dateStr)); } catch { return null; }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'M/d/yyyy'); } catch { return '—'; }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return '—'; }
}

const ACTIVITY_TYPE_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  call: { icon: Phone, color: 'text-blue-500' },
  email: { icon: Mail, color: 'text-emerald-500' },
  meeting: { icon: Users, color: 'text-violet-500' },
  note: { icon: Pencil, color: 'text-amber-500' },
  todo: { icon: CheckSquare, color: 'text-muted-foreground' },
};

/* ─── Stats Card ─── */
function StatBox({ value, label, icon, color }: { value: string | number; label: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-3.5 gap-1">
      <div className="flex items-center gap-1.5">
        <span className={color}>{icon}</span>
        <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
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

export default function UnderwritingExpandedView() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');

  // Activity form state
  const [activityType, setActivityType] = useState('todo');
  const [activityNote, setActivityNote] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);

  // Task inline add state
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // ── Stage change handler ──
  const handleStageChange = useCallback(async (newStatus: LeadStatus) => {
    if (!leadId) return;
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId);
    if (error) {
      toast.error('Failed to update stage');
      return;
    }
    toast.success('Stage updated');
    queryClient.invalidateQueries({ queryKey: ['lead-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
  }, [leadId, queryClient]);

  // ── Field saved handler ──
  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['lead-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
    toast.success('Updated');
  }, [leadId, queryClient]);

  // ── Save activity ──
  const handleSaveActivity = useCallback(async () => {
    if (!leadId) return;
    const content = activityTab === 'log' ? activityNote.trim() : noteContent.trim();
    const type = activityTab === 'log' ? activityType : 'note';
    if (!content) {
      toast.error('Please enter some content');
      return;
    }
    setSavingActivity(true);
    const { error } = await supabase.from('lead_activities').insert({
      lead_id: leadId,
      activity_type: type,
      content,
      title: type === 'note' ? 'Note' : type.charAt(0).toUpperCase() + type.slice(1),
    });
    setSavingActivity(false);
    if (error) {
      toast.error('Failed to save activity');
      return;
    }
    toast.success('Activity saved');
    if (activityTab === 'log') setActivityNote('');
    else setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
  }, [leadId, activityTab, activityType, activityNote, noteContent, queryClient]);

  // ── Save task ──
  const handleSaveTask = useCallback(async () => {
    if (!leadId || !newTaskTitle.trim()) return;
    setSavingTask(true);
    const { error } = await supabase.from('evan_tasks').insert({
      lead_id: leadId,
      title: newTaskTitle.trim(),
      status: 'pending',
      priority: 'medium',
    });
    setSavingTask(false);
    if (error) {
      toast.error('Failed to create task');
      return;
    }
    toast.success('Task created');
    setNewTaskTitle('');
    setAddingTask(false);
    queryClient.invalidateQueries({ queryKey: ['lead-tasks', leadId] });
  }, [leadId, newTaskTitle, queryClient]);

  // ── Queries ──
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead-expanded', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId!)
        .single();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!leadId,
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

  const { data: interactionCount = 0 } = useQuery({
    queryKey: ['lead-interactions', leadId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('evan_communications')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId!);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!leadId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['lead-contacts', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_contacts').select('*').eq('lead_id', leadId!);
      return data ?? [];
    },
    enabled: !!leadId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['lead-tasks', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('evan_tasks')
        .select('id, title, status, priority')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!leadId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!leadId,
  });

  if (isLoading || !lead) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  const dealValue = lead.deal_value ?? fakeValue(lead.id);
  const dealValueStr = lead.deal_value != null ? String(lead.deal_value) : '';
  const initial = lead.name[0]?.toUpperCase() ?? '?';
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? '—') : '—';
  const daysInStage = daysSince(lead.updated_at);
  const inactiveDays = daysSince(lead.last_activity_at);
  const lastContacted = formatShortDate(lead.last_activity_at);
  const stageCfg = canonicalStageConfig[lead.status];
  const inactiveColor = (inactiveDays ?? 0) > 30 ? 'text-red-600' : 'text-amber-600';
  const ownerOptions = teamMembers.map((m) => ({ value: m.id, label: m.name }));

  function goBack() {
    navigate(-1);
  }

  return (
    <div data-full-bleed className="flex flex-col bg-background overflow-hidden h-[calc(100vh-3.5rem)]">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border px-6 py-4 bg-gradient-to-r from-muted/50 to-violet-50/20 dark:to-violet-950/20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={goBack}>
            <X className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-foreground truncate">{lead.name}</h1>
            {lead.company_name && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                {lead.company_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Opportunity</span>
            </div>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatValue(dealValue)}</span>
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="shrink-0 border-b border-border flex items-center justify-center gap-0 divide-x divide-border py-1 bg-muted/30">
        <StatBox value={interactionCount} label="Interactions" icon={<Activity className="h-4 w-4" />} color="text-blue-600" />
        <StatBox value={lastContacted} label="Last Contacted" icon={<Clock className="h-4 w-4" />} color="text-violet-600" />
        <StatBox value={inactiveDays ?? '—'} label="Inactive Days" icon={<AlertCircle className="h-4 w-4" />} color={inactiveColor} />
        <StatBox value={daysInStage ?? '—'} label="Days in Stage" icon={<TrendingUp className="h-4 w-4" />} color="text-emerald-600" />
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Details — fully editable */}
        <ScrollArea className="w-[340px] shrink-0 border-r border-border bg-card">
          <div className="px-5 py-5 space-y-5">

            {/* Contact Section */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Contact</span>
              <div className="space-y-1.5">
                <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={lead.name} field="name" leadId={lead.id} placeholder="Name" onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={lead.email ?? ''} field="email" leadId={lead.id} placeholder="Add email..." onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={lead.phone ?? ''} field="phone" leadId={lead.id} placeholder="Add phone..." onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Deal Details */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Deal Details</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                <ReadOnlyField icon={<Briefcase className="h-3.5 w-3.5" />} label="Pipeline" value="Underwriting" />

                {/* Stage — enabled select with 10-stage list */}
                <div className="flex items-center justify-between px-3.5 py-2 bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium text-muted-foreground">Stage</span>
                  </div>
                  <Select value={lead.status} onValueChange={(v) => handleStageChange(v as LeadStatus)}>
                    <SelectTrigger className={`h-7 w-auto min-w-[130px] text-xs rounded-lg ${stageCfg?.bg ?? 'bg-muted'} ${stageCfg?.color ?? 'text-foreground'} border-transparent hover:border-border shadow-none px-2 gap-1`}>
                      <SelectValue>{stageCfg?.label ?? lead.status}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {UNDERWRITING_STATUSES.map((s) => {
                        const cfg = canonicalStageConfig[s];
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
                </div>

                <EditableField icon={<Hash className="h-3.5 w-3.5" />} label="CLX File Name" value={lead.company_name ?? ''} field="company_name" leadId={lead.id} onSaved={handleFieldSaved} />
                <EditableField icon={<Clock className="h-3.5 w-3.5" />} label="Waiting On" value={lead.waiting_on ?? ''} field="waiting_on" leadId={lead.id} onSaved={handleFieldSaved} />
                <EditableField icon={<FileText className="h-3.5 w-3.5" />} label="UW Number" value={lead.uw_number ?? ''} field="uw_number" leadId={lead.id} onSaved={handleFieldSaved} />

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
                <EditableField icon={<DollarSign className="h-3.5 w-3.5" />} label="Value" value={dealValueStr} field="deal_value" leadId={lead.id} onSaved={handleFieldSaved} highlight transform={(v) => { const n = parseFloat(v.replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; }} />
                <ReadOnlyField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Created" value={formatDate(lead.created_at)} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tags</span>
              <EditableTags tags={lead.tags ?? []} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>

            {/* Notes */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Notes</span>
              <EditableNotes value={lead.notes ?? ''} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>
          </div>
        </ScrollArea>

        {/* CENTER: Activity */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/20">
          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-0 border-b border-border px-6 bg-card">
            <button
              className={`px-4 py-3 text-xs font-semibold transition-colors relative ${
                activityTab === 'log'
                  ? 'text-violet-700 dark:text-violet-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActivityTab('log')}
            >
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Log Activity
              </span>
              {activityTab === 'log' && (
                <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-violet-600" />
              )}
            </button>
            <button
              className={`px-4 py-3 text-xs font-semibold transition-colors relative ${
                activityTab === 'note'
                  ? 'text-violet-700 dark:text-violet-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActivityTab('note')}
            >
              <span className="inline-flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Create Note
              </span>
              {activityTab === 'note' && (
                <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-violet-600" />
              )}
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
                        <SelectItem value="todo" className="text-xs">To Do</SelectItem>
                        <SelectItem value="call" className="text-xs">Call</SelectItem>
                        <SelectItem value="email" className="text-xs">Email</SelectItem>
                        <SelectItem value="meeting" className="text-xs">Meeting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={activityNote}
                    onChange={(e) => setActivityNote(e.target.value)}
                    placeholder="Add a note..."
                    className="min-h-[80px] text-sm resize-none rounded-xl border-border focus-visible:border-violet-400 focus-visible:ring-violet-400/20"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveActivity}
                      disabled={savingActivity || !activityNote.trim()}
                      className="bg-violet-600 hover:bg-violet-700 text-white text-xs px-4 rounded-lg"
                    >
                      {savingActivity && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      Save Activity
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write a note..."
                    className="min-h-[120px] text-sm resize-none rounded-xl border-border focus-visible:border-violet-400 focus-visible:ring-violet-400/20"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveActivity}
                      disabled={savingActivity || !noteContent.trim()}
                      className="bg-violet-600 hover:bg-violet-700 text-white text-xs px-4 rounded-lg"
                    >
                      {savingActivity && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      Save Note
                    </Button>
                  </div>
                </div>
              )}

              {/* Earlier — Activity History */}
              <Separator className="my-6" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Earlier</h3>
              <div className="space-y-3">
                {activities.length > 0 ? (
                  activities.map((act) => {
                    const typeInfo = ACTIVITY_TYPE_ICONS[act.activity_type] ?? ACTIVITY_TYPE_ICONS.note;
                    const IconComp = typeInfo.icon;
                    return (
                      <div key={act.id} className="flex gap-3 p-3 rounded-xl bg-card border border-border hover:border-border transition-colors">
                        <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${typeInfo.color}`}>
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-foreground">{act.title || act.activity_type}</span>
                            <span className="text-[10px] text-muted-foreground">{formatShortDate(act.created_at)}</span>
                          </div>
                          {act.content && (
                            <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{act.content}</p>
                          )}
                        </div>
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
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block px-3">Related</span>
            <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={contacts.length} iconColor="text-blue-500">
              {contacts.length > 0 ? (
                <div className="space-y-2 py-1">
                  {contacts.map((c) => (
                    <div key={c.id} className="text-xs text-foreground flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium">{c.name}</span>
                      {c.title && <span className="text-muted-foreground">· {c.title}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">No contacts</p>
              )}
            </RelatedSection>

            <RelatedSection icon={<Building2 className="h-3.5 w-3.5" />} label="Companies" count={lead.company_name ? 1 : 0} iconColor="text-indigo-500">
              {lead.company_name ? (
                <div className="text-xs text-foreground py-1 flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0">
                    {lead.company_name[0]?.toUpperCase()}
                  </div>
                  {lead.company_name}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">No companies</p>
              )}
            </RelatedSection>

            <RelatedSection
              icon={<CheckSquare className="h-3.5 w-3.5" />}
              label="Tasks"
              count={tasks.length}
              iconColor="text-emerald-500"
              onAdd={() => setAddingTask(true)}
            >
              <div className="space-y-2 py-1">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <CheckSquare className={`h-3.5 w-3.5 shrink-0 ${t.status === 'completed' || t.status === 'done' ? 'text-emerald-500' : 'text-muted-foreground/50'}`} />
                    <span className={`flex-1 truncate ${t.status === 'completed' || t.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                      {t.title}
                    </span>
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
                {tasks.length === 0 && !addingTask && (
                  <p className="text-xs text-muted-foreground">No tasks</p>
                )}
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
                      className="flex-1 text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                    />
                    {savingTask && <Loader2 className="h-3 w-3 animate-spin text-violet-500 shrink-0" />}
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTask(true)}
                    className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:text-violet-700 dark:hover:text-violet-300 transition-colors py-1"
                  >
                    + Add task...
                  </button>
                )}
              </div>
            </RelatedSection>

            <RelatedSection icon={<FileText className="h-3.5 w-3.5" />} label="Files" count={0} iconColor="text-orange-500">
              <p className="text-xs text-muted-foreground py-1">No files</p>
            </RelatedSection>

            <RelatedSection icon={<CalendarDays className="h-3.5 w-3.5" />} label="Calendar Events" count={0} iconColor="text-rose-500">
              <p className="text-xs text-muted-foreground py-1">No events</p>
            </RelatedSection>

            <RelatedSection icon={<FolderOpen className="h-3.5 w-3.5" />} label="Projects" count={0} iconColor="text-cyan-500">
              <p className="text-xs text-muted-foreground py-1">No projects</p>
            </RelatedSection>

            <RelatedSection icon={<Layers className="h-3.5 w-3.5" />} label="Pipeline Records" count={1} iconColor="text-violet-500">
              <div className="text-xs py-1">
                <Badge variant="secondary" className={`text-[11px] ${stageCfg?.bg ?? ''} ${stageCfg?.color ?? ''}`}>
                  {stageCfg?.label ?? lead.status}
                </Badge>
              </div>
            </RelatedSection>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
