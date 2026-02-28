import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  X, Star, DollarSign, ChevronDown, ChevronRight,
  Users, Building2, CheckSquare, FileText,
  CalendarDays, FolderOpen, Layers, Plus,
  MessageSquare, Pencil, Activity, Clock, AlertCircle, TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';


type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const UNDERWRITING_STATUSES: LeadStatus[] = [
  'moving_to_underwriting',
  'underwriting',
  'ready_for_wu_approval',
  'pre_approval_issued',
];

const stageConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  moving_to_underwriting: { label: 'Moving to UW', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  underwriting: { label: 'Underwriting', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  ready_for_wu_approval: { label: 'Ready for Approval', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  pre_approval_issued: { label: 'Pre-Approval Issued', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

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

/* ─── Detail Field Row ─── */
function DetailField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex items-start justify-between py-3 px-3.5 gap-4">
      <span className="text-xs font-medium text-slate-500 shrink-0 pt-0.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="text-[13px] font-medium text-slate-800 text-right">{children}</div>
    </div>
  );
}

/* ─── Stats Card ─── */
function StatBox({ value, label, icon, color }: { value: string | number; label: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-3.5 gap-1">
      <div className="flex items-center gap-1.5">
        <span className={color}>{icon}</span>
        <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
      </div>
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
    </div>
  );
}

/* ─── Related Section ─── */
function RelatedSection({ icon, label, count, iconColor, children }: {
  icon: React.ReactNode; label: string; count: number; iconColor?: string; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-slate-50/80 px-4 rounded-lg transition-colors">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <span className={iconColor}>{icon}</span> {label}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-slate-100 text-slate-500">
          {count}
        </Badge>
        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto text-slate-400 hover:text-slate-600" onClick={(e) => e.stopPropagation()}>
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
  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');

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

  const { data: taskCount = 0 } = useQuery({
    queryKey: ['lead-task-count', leadId],
    queryFn: async () => {
      const { count } = await supabase
        .from('evan_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId!);
      return count ?? 0;
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

  const dealValue = fakeValue(lead.id);
  const initial = lead.name[0]?.toUpperCase() ?? '?';
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? '—') : '—';
  const daysInStage = daysSince(lead.updated_at);
  const inactiveDays = daysSince(lead.last_activity_at);
  const lastContacted = formatShortDate(lead.last_activity_at);
  const stageCfg = stageConfig[lead.status];
  const inactiveColor = (inactiveDays ?? 0) > 30 ? 'text-red-600' : 'text-amber-600';

  function goBack() {
    navigate(-1);
  }

  return (
    <div data-full-bleed className="flex flex-col bg-background overflow-hidden h-[calc(100vh-3.5rem)]">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-200/80 px-6 py-4 bg-gradient-to-r from-slate-50/80 to-violet-50/40">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={goBack}>
            <X className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-slate-900 truncate">{lead.name}</h1>
            {lead.company_name && (
              <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3 text-slate-400" />
                {lead.company_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">Opportunity</span>
            </div>
            <span className="text-sm font-bold text-emerald-700 tabular-nums">{formatValue(dealValue)}</span>
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="shrink-0 border-b border-slate-200/80 flex items-center justify-center gap-0 divide-x divide-slate-200/60 py-1 bg-slate-50/50">
        <StatBox value={interactionCount} label="Interactions" icon={<Activity className="h-4 w-4" />} color="text-blue-600" />
        <StatBox value={lastContacted} label="Last Contacted" icon={<Clock className="h-4 w-4" />} color="text-violet-600" />
        <StatBox value={inactiveDays ?? '—'} label="Inactive Days" icon={<AlertCircle className="h-4 w-4" />} color={inactiveColor} />
        <StatBox value={daysInStage ?? '—'} label="Days in Stage" icon={<TrendingUp className="h-4 w-4" />} color="text-emerald-600" />
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Details */}
        <ScrollArea className="w-[340px] shrink-0 border-r border-slate-200/80 bg-white">
          <div className="px-5 py-5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 block">Deal Details</span>
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              <DetailField label="Name" required>
                <span className="font-medium">{lead.name}</span>
              </DetailField>
              <DetailField label="Pipeline">
                <Badge variant="secondary" className="text-[11px] rounded-full bg-violet-50 text-violet-700 border-violet-200 px-2.5">Underwriting</Badge>
              </DetailField>
              <DetailField label="Stage">
                <Select value={lead.status} disabled>
                  <SelectTrigger className={`h-7 w-auto min-w-[130px] text-xs rounded-lg ${stageCfg?.border ?? 'border-slate-200'} ${stageCfg?.bg ?? ''} ${stageCfg?.color ?? ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNDERWRITING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {stageConfig[s]?.label ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DetailField>
              <DetailField label="CLX File Name">
                <span>{lead.company_name ?? lead.name}</span>
              </DetailField>
              <DetailField label="Waiting On">
                <span className="text-slate-400 italic">—</span>
              </DetailField>
              <DetailField label="Tags">
                {lead.tags && lead.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {lead.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[11px] px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border-violet-200 font-medium">{tag}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">—</span>
                )}
              </DetailField>
              <DetailField label="Value">
                <span className="font-semibold tabular-nums text-emerald-600">{formatValue(dealValue)}</span>
              </DetailField>
              <DetailField label="Owned By">
                <span className="text-violet-600 font-medium">{assignedName}</span>
              </DetailField>
              <DetailField label="Source">
                {lead.source ? (
                  <Badge variant="secondary" className="text-[11px] rounded-full bg-violet-50 text-violet-700 border-violet-200 px-2.5 font-medium">{lead.source}</Badge>
                ) : (
                  <span className="text-slate-400 italic">—</span>
                )}
              </DetailField>
              <DetailField label="Description">
                <span className="text-xs text-slate-500 line-clamp-4">{lead.notes ?? <span className="text-slate-400 italic">—</span>}</span>
              </DetailField>
            </div>
          </div>
          <div className="px-5 pb-5">
            <button className="text-xs text-violet-600 font-medium hover:text-violet-700 transition-colors">+ Add new field</button>
          </div>
        </ScrollArea>

        {/* CENTER: Activity */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/30">
          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-0 border-b border-slate-200/80 px-6 bg-white">
            <button
              className={`px-4 py-3 text-xs font-semibold transition-colors relative ${
                activityTab === 'log'
                  ? 'text-violet-700'
                  : 'text-slate-400 hover:text-slate-600'
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
                  ? 'text-violet-700'
                  : 'text-slate-400 hover:text-slate-600'
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
                    <Select defaultValue="todo">
                      <SelectTrigger className="h-8 w-[120px] text-xs rounded-lg border-slate-200">
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
                    placeholder="Add a note..."
                    className="min-h-[80px] text-sm resize-none rounded-xl border-slate-200 focus-visible:border-violet-400 focus-visible:ring-violet-400/20"
                  />
                </div>
              ) : (
                <Textarea
                  placeholder="Write a note..."
                  className="min-h-[120px] text-sm resize-none rounded-xl border-slate-200 focus-visible:border-violet-400 focus-visible:ring-violet-400/20"
                />
              )}

              {/* Earlier section */}
              <Separator className="my-6" />
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Earlier</h3>
              <div className="space-y-3">
                <div className="border border-dashed border-slate-200 rounded-xl py-10 flex flex-col items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-400">No activity recorded yet</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: Related */}
        <ScrollArea className="w-[260px] shrink-0 border-l border-slate-200/80 bg-white">
          <div className="py-4 px-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-3">Related</span>
            <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={contacts.length} iconColor="text-blue-500">
              {contacts.length > 0 ? (
                <div className="space-y-2 py-1">
                  {contacts.map((c) => (
                    <div key={c.id} className="text-xs text-slate-700 flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium">{c.name}</span>
                      {c.title && <span className="text-slate-400">· {c.title}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-1">No contacts</p>
              )}
            </RelatedSection>

            <RelatedSection icon={<Building2 className="h-3.5 w-3.5" />} label="Companies" count={lead.company_name ? 1 : 0} iconColor="text-indigo-500">
              {lead.company_name ? (
                <div className="text-xs text-slate-700 py-1 flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
                    {lead.company_name[0]?.toUpperCase()}
                  </div>
                  {lead.company_name}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-1">No companies</p>
              )}
            </RelatedSection>

            <RelatedSection icon={<CheckSquare className="h-3.5 w-3.5" />} label="Tasks" count={taskCount} iconColor="text-emerald-500">
              <button className="text-xs text-violet-600 font-medium hover:text-violet-700 transition-colors py-1">+ Add task...</button>
            </RelatedSection>

            <RelatedSection icon={<FileText className="h-3.5 w-3.5" />} label="Files" count={0} iconColor="text-orange-500">
              <p className="text-xs text-slate-400 py-1">No files</p>
            </RelatedSection>

            <RelatedSection icon={<CalendarDays className="h-3.5 w-3.5" />} label="Calendar Events" count={0} iconColor="text-rose-500">
              <p className="text-xs text-slate-400 py-1">No events</p>
            </RelatedSection>

            <RelatedSection icon={<FolderOpen className="h-3.5 w-3.5" />} label="Projects" count={0} iconColor="text-cyan-500">
              <p className="text-xs text-slate-400 py-1">No projects</p>
            </RelatedSection>

            <RelatedSection icon={<Layers className="h-3.5 w-3.5" />} label="Pipeline Records" count={1} iconColor="text-violet-500">
              <div className="text-xs py-1">
                <Badge variant="secondary" className={`text-[11px] ${stageCfg?.bg ?? ''} ${stageCfg?.color ?? ''} ${stageCfg?.border ?? ''}`}>
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
