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
  MessageSquare, Pencil,
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

const stageConfig: Record<string, { label: string; color: string }> = {
  moving_to_underwriting: { label: 'Moving to UW', color: 'text-blue-700' },
  underwriting: { label: 'Underwriting', color: 'text-amber-700' },
  ready_for_wu_approval: { label: 'Ready for Approval', color: 'text-violet-700' },
  pre_approval_issued: { label: 'Pre-Approval Issued', color: 'text-emerald-700' },
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
    <div className="flex items-start justify-between py-2 gap-3">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="text-sm text-foreground text-right">{children}</div>
    </div>
  );
}

/* ─── Stats Card ─── */
function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-2">
      <span className="text-lg font-bold text-foreground tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

/* ─── Related Section ─── */
function RelatedSection({ icon, label, count, children }: {
  icon: React.ReactNode; label: string; count: number; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/40 px-3 rounded-md transition-colors">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          {icon} {label}
        </span>
        <span className="text-[11px] text-muted-foreground ml-1">({count})</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={(e) => e.stopPropagation()}>
          <Plus className="h-3 w-3" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-1">
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

  function goBack() {
    navigate(-1);
  }

  return (
    <div data-full-bleed className="flex flex-col bg-background overflow-hidden h-[calc(100vh-3.5rem)]">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
            <X className="h-4 w-4" />
          </Button>
          <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-foreground truncate">{lead.name}</h1>
            {lead.company_name && (
              <p className="text-xs text-muted-foreground truncate">{lead.company_name}</p>
            )}
          </div>
          <Badge variant="secondary" className="gap-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border-emerald-200">
            <DollarSign className="h-3 w-3" />
            Opportunity
          </Badge>
          <span className="text-sm font-semibold text-foreground tabular-nums">{formatValue(dealValue)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Follow">
            <Star className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="shrink-0 border-b border-border flex items-center justify-center gap-0 divide-x divide-border py-1">
        <StatBox value={interactionCount} label="Interactions" />
        <StatBox value={lastContacted} label="Last Contacted" />
        <StatBox value={inactiveDays ?? '—'} label="Inactive Days" />
        <StatBox value={daysInStage ?? '—'} label="Days in Stage" />
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Details */}
        <ScrollArea className="w-[320px] shrink-0 border-r border-border">
          <div className="px-4 py-3 divide-y divide-border/50">
            <DetailField label="Name" required>
              <span className="font-medium">{lead.name}</span>
            </DetailField>
            <DetailField label="Pipeline">
              <span>Underwriting</span>
            </DetailField>
            <DetailField label="Stage">
              <Select value={lead.status} disabled>
                <SelectTrigger className="h-7 w-auto min-w-[130px] text-xs border-border/60">
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
              <span className="text-muted-foreground">—</span>
            </DetailField>
            <DetailField label="Tags">
              {lead.tags && lead.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1 justify-end">
                  {lead.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[11px] px-1.5 py-0">{tag}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailField>
            <DetailField label="Value">
              <span className="font-medium tabular-nums">{formatValue(dealValue)}</span>
            </DetailField>
            <DetailField label="Owned By">
              <span>{assignedName}</span>
            </DetailField>
            <DetailField label="Source">
              <span>{lead.source ?? '—'}</span>
            </DetailField>
            <DetailField label="Description">
              <span className="text-xs text-muted-foreground line-clamp-4">{lead.notes ?? '—'}</span>
            </DetailField>
          </div>
          <div className="px-4 pb-4">
            <button className="text-xs text-primary hover:underline">+ Add new field</button>
          </div>
        </ScrollArea>

        {/* CENTER: Activity */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-0 border-b border-border px-5">
            <button
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activityTab === 'log'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActivityTab('log')}
            >
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Log Activity
              </span>
            </button>
            <button
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activityTab === 'note'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActivityTab('note')}
            >
              <span className="inline-flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Create Note
              </span>
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-5 py-4">
              {activityTab === 'log' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Select defaultValue="todo">
                      <SelectTrigger className="h-8 w-[120px] text-xs">
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
                    className="min-h-[80px] text-sm resize-none"
                  />
                </div>
              ) : (
                <Textarea
                  placeholder="Write a note..."
                  className="min-h-[120px] text-sm resize-none"
                />
              )}

              {/* Earlier section */}
              <Separator className="my-6" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Earlier</h3>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet</p>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: Related */}
        <ScrollArea className="w-[240px] shrink-0 border-l border-border">
          <div className="py-2">
            <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={contacts.length}>
              {contacts.length > 0 ? (
                <div className="space-y-1.5 py-1">
                  {contacts.map((c) => (
                    <div key={c.id} className="text-xs text-foreground">
                      <span className="font-medium">{c.name}</span>
                      {c.title && <span className="text-muted-foreground ml-1">· {c.title}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">No contacts</p>
              )}
            </RelatedSection>

            <RelatedSection icon={<Building2 className="h-3.5 w-3.5" />} label="Companies" count={lead.company_name ? 1 : 0}>
              {lead.company_name ? (
                <p className="text-xs text-foreground py-1">{lead.company_name}</p>
              ) : (
                <p className="text-xs text-muted-foreground py-1">No companies</p>
              )}
            </RelatedSection>

            <RelatedSection icon={<CheckSquare className="h-3.5 w-3.5" />} label="Tasks" count={taskCount}>
              <button className="text-xs text-primary hover:underline py-1">+ Add task...</button>
            </RelatedSection>

            <RelatedSection icon={<FileText className="h-3.5 w-3.5" />} label="Files" count={0}>
              <p className="text-xs text-muted-foreground py-1">No files</p>
            </RelatedSection>

            <RelatedSection icon={<CalendarDays className="h-3.5 w-3.5" />} label="Calendar Events" count={0}>
              <p className="text-xs text-muted-foreground py-1">No events</p>
            </RelatedSection>

            <RelatedSection icon={<FolderOpen className="h-3.5 w-3.5" />} label="Projects" count={0}>
              <p className="text-xs text-muted-foreground py-1">No projects</p>
            </RelatedSection>

            <RelatedSection icon={<Layers className="h-3.5 w-3.5" />} label="Pipeline Records" count={1}>
              <div className="text-xs py-1">
                <span className={stageCfg?.color}>{stageCfg?.label ?? lead.status}</span>
              </div>
            </RelatedSection>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
