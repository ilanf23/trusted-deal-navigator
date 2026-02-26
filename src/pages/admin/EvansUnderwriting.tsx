import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EvanLayout from '@/components/evan/EvanLayout';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import {
  Plus,
  List,
  ArrowUpDown,
  ChevronDown,
  Hash,
  Clock,
  Building2,
  User,
  Tag,
  CheckSquare,
  Activity,
  CalendarDays,
  Timer,
  MessageSquare,
  Moon,
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const UNDERWRITING_STATUSES: LeadStatus[] = [
  'moving_to_underwriting',
  'underwriting',
  'ready_for_wu_approval',
  'pre_approval_issued',
];

const stageConfig: Record<string, { label: string; color: string; bg: string }> = {
  moving_to_underwriting: { label: 'Moving to UW', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
  underwriting: { label: 'Underwriting', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  ready_for_wu_approval: { label: 'Ready for Approval', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  pre_approval_issued: { label: 'Pre-Approval Issued', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
};

// Derive a simple Open/Won/Lost status from the lead status
function deriveStatus(status: LeadStatus): { label: string; color: string; bg: string } {
  if (status === 'won') return { label: 'Won', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (status === 'lost') return { label: 'Lost', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
  return { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Opportunities' },
  { id: 'moving_to_underwriting', label: 'Moving to Underwriting' },
  { id: 'underwriting', label: 'Underwriting' },
  { id: 'ready_for_wu_approval', label: 'Ready for Approval' },
  { id: 'pre_approval_issued', label: 'Pre-Approval Issued' },
];

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-pink-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Seeded pseudo-random — same lead ID always produces same values
function seededRand(seed: string, index: number): number {
  let h = index * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 16;
  }
  return Math.abs(h) / 0xffffffff;
}

function fakeValue(id: string): string {
  const buckets = [25000, 50000, 75000, 100000, 150000, 200000, 250000, 350000, 500000, 750000];
  const v = buckets[Math.floor(seededRand(id, 1) * buckets.length)];
  return `$${v.toLocaleString()}`;
}

function fakeTasks(id: string): number {
  return Math.floor(seededRand(id, 2) * 9); // 0–8
}

function fakeInteractions(id: string): number {
  return Math.floor(seededRand(id, 3) * 26); // 0–25
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    return differenceInDays(new Date(), parseISO(dateStr));
  } catch {
    return null;
  }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

type SortField = 'name' | 'company_name' | 'status' | 'last_activity_at' | 'assigned_to' | 'updated_at';
type SortDir = 'asc' | 'desc';

const EvansUnderwriting = () => {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('is_active', true);
      return (data || []) as { id: string; name: string }[];
    },
  });

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['underwriting-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('status', UNDERWRITING_STATUSES)
        .order('last_activity_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  // Fetch task counts keyed by lead_id
  const { data: taskCountMap = {} } = useQuery({
    queryKey: ['underwriting-task-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_tasks')
        .select('lead_id')
        .in('lead_id', leads.map((l) => l.id));
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data) {
        if (row.lead_id) counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: leads.length > 0,
  });

  // Fetch interaction counts keyed by lead_id
  const { data: interactionCountMap = {} } = useQuery({
    queryKey: ['underwriting-interaction-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('lead_id')
        .in('lead_id', leads.map((l) => l.id));
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data) {
        if (row.lead_id) counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: leads.length > 0,
  });

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const status of UNDERWRITING_STATUSES) {
      counts[status] = leads.filter((l) => l.status === status).length;
    }
    return counts;
  }, [leads]);

  const filteredAndSorted = useMemo(() => {
    let result = leads;

    if (activeFilter !== 'all') {
      result = result.filter((l) => l.status === activeFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.company_name ?? '').toLowerCase().includes(q) ||
          (teamMemberMap[l.assigned_to ?? ''] ?? '').toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = ((a[sortField] ?? '') as string);
      const bVal = ((b[sortField] ?? '') as string);
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leads, activeFilter, searchTerm, sortField, sortDir, teamMemberMap]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleRowClick(lead: Lead) {
    setSelectedLead(lead);
    setDialogOpen(true);
  }

  const SortableHeader = ({
    field,
    children,
    className = '',
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground group whitespace-nowrap ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown
          className={`h-3 w-3 transition-opacity ${sortField === field ? 'opacity-100 text-foreground' : 'opacity-0 group-hover:opacity-50'}`}
        />
      </span>
    </th>
  );

  const PlainHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <th
      className={`px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );

  return (
    <EvanLayout>
      <div className="flex h-full min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border bg-background flex flex-col">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Saved Filters</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-3 pb-2">
            <div className="h-px bg-border" />
          </div>

          <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {FILTER_OPTIONS.map((opt) => {
              const isActive = activeFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setActiveFilter(opt.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm transition-colors text-left ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {filterCounts[opt.id] > 0 && (
                    <span className={`ml-1.5 text-xs shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                      {filterCounts[opt.id]}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {/* Page Header */}
          <div className="px-6 pt-5 pb-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-xl font-semibold text-foreground whitespace-nowrap">All Opportunities</h1>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  {isLoading ? '—' : `${filteredAndSorted.length} opportunit${filteredAndSorted.length === 1 ? 'y' : 'ies'}`}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Input
                  placeholder="Search by name, company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 w-56 text-sm"
                />
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Sort
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Table — horizontally scrollable for 14 columns */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur border-b border-border">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <SortableHeader field="name" className="min-w-[200px]">Opportunity</SortableHeader>
                  <SortableHeader field="company_name" className="min-w-[140px]">Company</SortableHeader>
                  <PlainHeader className="min-w-[130px]">Contact</PlainHeader>
                  <PlainHeader className="min-w-[100px]">Value</PlainHeader>
                  <SortableHeader field="assigned_to" className="min-w-[120px]">Owned By</SortableHeader>
                  <PlainHeader className="min-w-[80px]">Tasks</PlainHeader>
                  <PlainHeader className="min-w-[90px]">Status</PlainHeader>
                  <SortableHeader field="status" className="min-w-[160px]">Stage</SortableHeader>
                  <SortableHeader field="updated_at" className="min-w-[110px]">Days in Stage</SortableHeader>
                  <PlainHeader className="min-w-[130px]">Stage Updated</PlainHeader>
                  <SortableHeader field="last_activity_at" className="min-w-[130px]">Last Contacted</SortableHeader>
                  <PlainHeader className="min-w-[110px]">Interactions</PlainHeader>
                  <PlainHeader className="min-w-[110px]">Inactive Days</PlainHeader>
                  <PlainHeader className="min-w-[150px]">Tags</PlainHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Loading opportunities...
                    </td>
                  </tr>
                ) : filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No opportunities found
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map((lead) => {
                    const dealLabel = lead.company_name
                      ? `${lead.name} — ${lead.company_name}`
                      : lead.name;
                    const initials = lead.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    const avatarColor = getAvatarColor(lead.name);
                    const stageInfo = stageConfig[lead.status];
                    const statusInfo = deriveStatus(lead.status);
                    const assignedName = lead.assigned_to
                      ? (teamMemberMap[lead.assigned_to] ?? null)
                      : null;
                    const taskCount = taskCountMap[lead.id] ?? fakeTasks(lead.id);
                    const interactionCount = interactionCountMap[lead.id] ?? fakeInteractions(lead.id);
                    const daysInStage = daysSince(lead.updated_at);
                    const inactiveDays = daysSince(lead.last_activity_at);

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => handleRowClick(lead)}
                        className="cursor-pointer hover:bg-muted/40 transition-colors group"
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3 w-8">
                          <div className="h-4 w-4 rounded border border-border bg-background group-hover:border-primary/40 transition-colors" />
                        </td>

                        {/* Opportunity */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-6 w-6 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                              {initials}
                            </div>
                            <span className="font-medium text-foreground truncate max-w-[170px]">{dealLabel}</span>
                          </div>
                        </td>

                        {/* Company */}
                        <td className="px-3 py-3">
                          {lead.company_name ? (
                            <span className="flex items-center gap-1.5 text-foreground">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[110px]">{lead.company_name}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[100px]">{lead.name}</span>
                          </span>
                        </td>

                        {/* Value */}
                        <td className="px-3 py-3">
                          <span className="text-foreground font-medium tabular-nums">{fakeValue(lead.id)}</span>
                        </td>

                        {/* Owned By */}
                        <td className="px-3 py-3">
                          {assignedName ? (
                            <span className="flex items-center gap-1.5 text-foreground">
                              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[90px]">{assignedName}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Tasks */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5">
                            <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className={taskCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                              {taskCount}
                            </span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusInfo.bg} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Stage */}
                        <td className="px-3 py-3">
                          {stageInfo ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${stageInfo.bg} ${stageInfo.color}`}>
                              {stageInfo.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">{lead.status}</span>
                          )}
                        </td>

                        {/* Days in Stage */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5">
                            <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className={
                              daysInStage !== null && daysInStage > 14
                                ? 'text-amber-600 font-medium'
                                : 'text-foreground'
                            }>
                              {daysInStage !== null ? `${daysInStage}d` : '—'}
                            </span>
                          </span>
                        </td>

                        {/* Stage Updated */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            {formatShortDate(lead.updated_at)}
                          </span>
                        </td>

                        {/* Last Contacted */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {formatShortDate(lead.last_activity_at)}
                          </span>
                        </td>

                        {/* Interactions */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className={interactionCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                              {interactionCount}
                            </span>
                          </span>
                        </td>

                        {/* Inactive Days */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5">
                            <Moon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className={
                              inactiveDays !== null && inactiveDays > 7
                                ? 'text-red-500 font-medium'
                                : 'text-foreground'
                            }>
                              {inactiveDays !== null ? `${inactiveDays}d` : '—'}
                            </span>
                          </span>
                        </td>

                        {/* Tags */}
                        <td className="px-3 py-3">
                          {lead.tags && lead.tags.length > 0 ? (
                            <span className="flex items-center gap-1 flex-wrap">
                              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {lead.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground border border-border"
                                >
                                  {tag}
                                </span>
                              ))}
                              {lead.tags.length > 2 && (
                                <span className="text-xs text-muted-foreground">+{lead.tags.length - 2}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <LeadDetailDialog
        lead={selectedLead}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
          queryClient.invalidateQueries({ queryKey: ['underwriting-task-counts'] });
          queryClient.invalidateQueries({ queryKey: ['underwriting-interaction-counts'] });
        }}
      />
    </EvanLayout>
  );
};

export default EvansUnderwriting;
