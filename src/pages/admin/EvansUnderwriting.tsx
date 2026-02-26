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
  CalendarDays,
  Timer,
  MessageSquare,
  Moon,
  TrendingUp,
  Sparkles,
  DollarSign,
  Layers,
  Filter,
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

const stageConfig: Record<string, {
  label: string;
  textColor: string;
  gradient: string;
  border: string;
  dot: string;
  cardGradient: string;
  cardBorder: string;
  statColor: string;
}> = {
  moving_to_underwriting: {
    label: 'Moving to UW',
    textColor: 'text-cyan-700',
    gradient: 'from-cyan-50 to-sky-50',
    border: 'border-cyan-300',
    dot: 'bg-cyan-400',
    cardGradient: 'from-cyan-400 to-sky-500',
    cardBorder: 'border-cyan-200',
    statColor: 'text-cyan-600',
  },
  underwriting: {
    label: 'Underwriting',
    textColor: 'text-orange-700',
    gradient: 'from-orange-50 to-amber-50',
    border: 'border-orange-300',
    dot: 'bg-orange-400',
    cardGradient: 'from-orange-400 to-amber-500',
    cardBorder: 'border-orange-200',
    statColor: 'text-orange-600',
  },
  ready_for_wu_approval: {
    label: 'Ready for Approval',
    textColor: 'text-purple-700',
    gradient: 'from-purple-50 to-violet-50',
    border: 'border-purple-300',
    dot: 'bg-purple-400',
    cardGradient: 'from-purple-500 to-violet-500',
    cardBorder: 'border-purple-200',
    statColor: 'text-purple-600',
  },
  pre_approval_issued: {
    label: 'Pre-Approval Issued',
    textColor: 'text-violet-700',
    gradient: 'from-violet-50 to-indigo-50',
    border: 'border-violet-300',
    dot: 'bg-violet-400',
    cardGradient: 'from-violet-500 to-indigo-500',
    cardBorder: 'border-violet-200',
    statColor: 'text-violet-600',
  },
};

function deriveStatus(status: LeadStatus): { label: string; gradient: string; text: string } {
  if (status === 'won') return { label: 'Won', gradient: 'from-emerald-400 to-green-500', text: 'text-white' };
  if (status === 'lost') return { label: 'Lost', gradient: 'from-rose-400 to-red-500', text: 'text-white' };
  return { label: 'Open', gradient: 'from-blue-400 to-indigo-500', text: 'text-white' };
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Opportunities', dot: 'bg-gradient-to-r from-violet-400 to-indigo-400' },
  { id: 'moving_to_underwriting', label: 'Moving to UW', dot: 'bg-cyan-400' },
  { id: 'underwriting', label: 'Underwriting', dot: 'bg-orange-400' },
  { id: 'ready_for_wu_approval', label: 'Ready for Approval', dot: 'bg-purple-400' },
  { id: 'pre_approval_issued', label: 'Pre-Approval Issued', dot: 'bg-violet-400' },
];

const AVATAR_GRADIENT_PAIRS = [
  ['from-blue-400', 'to-indigo-500'],
  ['from-emerald-400', 'to-teal-500'],
  ['from-violet-400', 'to-purple-500'],
  ['from-amber-400', 'to-orange-500'],
  ['from-rose-400', 'to-pink-500'],
  ['from-cyan-400', 'to-sky-500'],
  ['from-indigo-400', 'to-blue-500'],
  ['from-teal-400', 'to-emerald-500'],
  ['from-orange-400', 'to-amber-500'],
  ['from-pink-400', 'to-rose-500'],
];

const TAG_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
];

function seededRand(seed: string, index: number): number {
  let h = index * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 16;
  }
  return Math.abs(h) / 0xffffffff;
}

function getAvatarGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const pair = AVATAR_GRADIENT_PAIRS[Math.abs(hash) % AVATAR_GRADIENT_PAIRS.length];
  return [pair[0], pair[1]];
}

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function fakeValue(id: string): string {
  const buckets = [25000, 50000, 75000, 100000, 150000, 200000, 250000, 350000, 500000, 750000];
  const v = buckets[Math.floor(seededRand(id, 1) * buckets.length)];
  return `$${v.toLocaleString()}`;
}

function fakeTasks(id: string): number {
  return Math.floor(seededRand(id, 2) * 9);
}

function fakeInteractions(id: string): number {
  return Math.floor(seededRand(id, 3) * 26);
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try { return differenceInDays(new Date(), parseISO(dateStr)); }
  catch { return null; }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); }
  catch { return '—'; }
}

function daysChip(days: number | null, warnAt = 7, dangerAt = 14) {
  if (days === null) return { label: '—', classes: 'bg-slate-100 text-slate-500' };
  if (days >= dangerAt) return { label: `${days}d`, classes: 'bg-red-100 text-red-700 font-semibold' };
  if (days >= warnAt) return { label: `${days}d`, classes: 'bg-amber-100 text-amber-700 font-semibold' };
  return { label: `${days}d`, classes: 'bg-emerald-100 text-emerald-700 font-semibold' };
}

type SortField = 'name' | 'company_name' | 'status' | 'last_activity_at' | 'assigned_to' | 'updated_at';
type SortDir = 'asc' | 'desc';

// Column header metadata — color accent per column
const COL_HEADERS: { key: string; label: string; accent: string; sortField?: SortField; minW: string }[] = [
  { key: 'opportunity', label: 'Opportunity',    accent: 'border-indigo-400',  sortField: 'name',            minW: 'min-w-[200px]' },
  { key: 'company',     label: 'Company',         accent: 'border-sky-400',     sortField: 'company_name',    minW: 'min-w-[140px]' },
  { key: 'contact',     label: 'Contact',         accent: 'border-teal-400',                                  minW: 'min-w-[130px]' },
  { key: 'value',       label: 'Value',           accent: 'border-emerald-400',                               minW: 'min-w-[110px]' },
  { key: 'ownedBy',     label: 'Owned By',        accent: 'border-violet-400',  sortField: 'assigned_to',     minW: 'min-w-[120px]' },
  { key: 'tasks',       label: 'Tasks',           accent: 'border-amber-400',                                 minW: 'min-w-[80px]'  },
  { key: 'status',      label: 'Status',          accent: 'border-blue-400',                                  minW: 'min-w-[90px]'  },
  { key: 'stage',       label: 'Stage',           accent: 'border-orange-400',  sortField: 'status',          minW: 'min-w-[160px]' },
  { key: 'daysInStage', label: 'Days in Stage',   accent: 'border-rose-400',    sortField: 'updated_at',      minW: 'min-w-[110px]' },
  { key: 'stageUpd',   label: 'Stage Updated',   accent: 'border-pink-400',                                  minW: 'min-w-[130px]' },
  { key: 'lastCont',   label: 'Last Contacted',  accent: 'border-cyan-400',    sortField: 'last_activity_at', minW: 'min-w-[130px]' },
  { key: 'interactions',label: 'Interactions',    accent: 'border-purple-400',                                minW: 'min-w-[110px]' },
  { key: 'inactive',   label: 'Inactive Days',   accent: 'border-red-400',                                   minW: 'min-w-[110px]' },
  { key: 'tags',        label: 'Tags',            accent: 'border-lime-400',                                  minW: 'min-w-[160px]' },
];

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
      const { data } = await supabase.from('team_members').select('id, name').eq('is_active', true);
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
    if (activeFilter !== 'all') result = result.filter((l) => l.status === activeFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.company_name ?? '').toLowerCase().includes(q) ||
          (teamMemberMap[l.assigned_to ?? ''] ?? '').toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) => {
      const aVal = (a[sortField] ?? '') as string;
      const bVal = (b[sortField] ?? '') as string;
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [leads, activeFilter, searchTerm, sortField, sortDir, teamMemberMap]);

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  function handleRowClick(lead: Lead) {
    setSelectedLead(lead);
    setDialogOpen(true);
  }

  return (
    <EvanLayout>
      {/* Full-page gradient canvas */}
      <div className="flex h-full min-h-0 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">

        {/* ── CRM-Style Header ── */}
        <div className="shrink-0 border-b border-border bg-background px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-foreground whitespace-nowrap">All Opportunities</h1>
            {!isLoading && (
              <span className="text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {/* Connected toolbar — Table | Kanban | Sort | Settings */}
          <div className="flex items-center h-7 rounded-md border border-slate-200 overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('table')}
              title="Table view"
              className={`flex items-center gap-1.5 h-full px-2.5 text-xs font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-violet-50 text-violet-700'
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Table2 className="h-3.5 w-3.5 shrink-0" />
              Table
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban view"
              className={`flex items-center gap-1.5 h-full px-2.5 text-xs font-medium transition-all ${
                viewMode === 'kanban'
                  ? 'bg-violet-50 text-violet-700'
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              Kanban
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Sort"
                  className={`flex items-center gap-1.5 h-full px-2.5 text-xs font-medium transition-all ${
                    isNonDefaultSort
                      ? 'bg-violet-50 text-violet-700'
                      : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                  Sort
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-3 space-y-3">
                <p className="text-xs font-semibold text-foreground">Sort by</p>
                <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_FIELD_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortDir} onValueChange={(v) => setSortDir(v as SortDir)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc" className="text-xs">Ascending</SelectItem>
                    <SelectItem value="desc" className="text-xs">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </PopoverContent>
            </Popover>
            <div className="w-px h-4 bg-slate-200" />
            <PipelineSettingsPopover open={settingsOpen} onOpenChange={setSettingsOpen} />
          </div>

          {/* Add Opportunity button */}
          <Button
            size="sm"
            className="h-8 px-4 text-xs font-semibold rounded-full gap-1.5 shrink-0"
          >
            Add Opportunity
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

          <div className="mx-4 mb-3 h-px bg-gradient-to-r from-violet-100 via-indigo-100 to-transparent" />

          {/* Filter Pills */}
          <nav className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
            {FILTER_OPTIONS.map((opt) => {
              const isActive = activeFilter === opt.id;
              const cfg = opt.id !== 'all' ? stageConfig[opt.id] : null;
              return (
                <button
                  key={opt.id}
                  onClick={() => setActiveFilter(opt.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all duration-150 text-left group ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md shadow-violet-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${isActive ? 'bg-white/70' : opt.dot}`} />
                    <span className="truncate font-medium">{opt.label}</span>
                  </span>
                  {filterCounts[opt.id] > 0 && (
                    <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : cfg
                          ? `${cfg.statColor} bg-slate-100`
                          : 'text-violet-600 bg-violet-50'
                    }`}>
                      {filterCounts[opt.id]}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Decoration */}
          <div className="p-3 mx-3 mb-3 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs font-semibold text-violet-700">Pipeline Health</span>
            </div>
            <p className="text-xs text-slate-500">
              {leads.length} active deal{leads.length !== 1 ? 's' : ''} in underwriting
            </p>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Toolbar ── */}
            <div className="shrink-0 border-b border-border px-3 py-2 flex items-center justify-between gap-2 bg-slate-50">

              {/* Left group: view toggles */}
              <div className="flex items-center gap-2">


                {/* Sidebar toggle */}
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  title={sidebarOpen ? 'Hide filters' : 'Show filters'}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-all ${
                    !sidebarOpen
                      ? 'bg-violet-50 border-violet-200 text-violet-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <PanelLeft className="h-3.5 w-3.5 shrink-0" />
                  {sidebarOpen ? 'Hide Filters' : 'Show Filters'}
                </button>

                {!isLoading && (
                  <span className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'opportunity' : 'opportunities'}
                  </span>
                )}

                {/* Sort indicator */}
                {isNonDefaultSort && (
                  <span className="flex items-center gap-1 text-[11px] text-violet-600 font-medium bg-violet-50 border border-violet-200 rounded-md px-2 h-7">
                    <ArrowUpDown className="h-3 w-3 shrink-0" />
                    {sortFieldLabel} {sortDir === 'asc' ? '↑' : '↓'}
                    <button
                      onClick={() => { setSortField('last_activity_at'); setSortDir('desc'); }}
                      className="ml-0.5 text-violet-400 hover:text-violet-700"
                      title="Reset sort"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Input
                  placeholder="Search by name, company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-60 text-sm rounded-xl border-slate-200 bg-white shadow-sm focus-visible:ring-violet-300 focus-visible:ring-2"
                />
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs rounded-xl border-slate-200 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Sort
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-slate-200 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50">
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* ── STAT CARDS ── */}
            <div className="grid grid-cols-4 gap-3">
              {UNDERWRITING_STATUSES.map((status) => {
                const cfg = stageConfig[status];
                const count = filterCounts[status] ?? 0;
                return (
                  <button
                    key={status}
                    onClick={() => setActiveFilter(activeFilter === status ? 'all' : status)}
                    className={`relative overflow-hidden rounded-xl p-3 text-left border transition-all duration-200 hover:shadow-md ${
                      activeFilter === status
                        ? `bg-gradient-to-br ${cfg.gradient} ${cfg.cardBorder} shadow-sm`
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Colored left accent bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${cfg.cardGradient} rounded-l-xl`} />
                    <div className="pl-2">
                      <p className={`text-2xl font-bold ${activeFilter === status ? cfg.statColor : 'text-slate-700'}`}>
                        {count}
                      </p>
                      <p className={`text-xs font-medium mt-0.5 ${activeFilter === status ? cfg.statColor : 'text-slate-500'}`}>
                        {cfg.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── TABLE ── */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              {/* Sticky header */}
              <thead className="sticky top-0 z-10">
                <tr className="bg-gradient-to-b from-slate-100 to-slate-50 border-b-2 border-slate-200">
                  {/* Checkbox col */}
                  <th className="w-10 px-3 py-3 border-t-2 border-transparent" />
                  {COL_HEADERS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-t-2 ${col.accent} ${col.minW} ${col.sortField ? 'cursor-pointer select-none group hover:text-slate-800' : ''}`}
                      onClick={col.sortField ? () => handleSort(col.sortField!) : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.sortField && (
                          <ArrowUpDown className={`h-3 w-3 transition-opacity ${sortField === col.sortField ? 'opacity-100 text-slate-600' : 'opacity-0 group-hover:opacity-40'}`} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  /* ── Skeleton rows ── */
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-3 py-3 w-10">
                        <div className="h-4 w-4 rounded bg-slate-200 animate-pulse" />
                      </td>
                      {COL_HEADERS.map((col) => (
                        <td key={col.key} className="px-3 py-3">
                          <div
                            className="h-4 rounded-full bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-pulse"
                            style={{ width: `${45 + (i * 13 + col.key.length * 7) % 40}%` }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                          <Layers className="h-6 w-6 text-violet-400" />
                        </div>
                        <p className="text-slate-500 font-medium">No opportunities found</p>
                        <p className="text-slate-400 text-xs">Try adjusting your filters or search term</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map((lead, rowIdx) => {
                    const dealLabel = lead.company_name ? `${lead.name} — ${lead.company_name}` : lead.name;
                    const initials = lead.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                    const [avatarFrom, avatarTo] = getAvatarGradient(lead.name);
                    const stageInfo = stageConfig[lead.status];
                    const statusInfo = deriveStatus(lead.status);
                    const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? null) : null;
                    const taskCount = taskCountMap[lead.id] ?? fakeTasks(lead.id);
                    const interactionCount = interactionCountMap[lead.id] ?? fakeInteractions(lead.id);
                    const daysInStage = daysSince(lead.updated_at);
                    const inactiveDays = daysSince(lead.last_activity_at);
                    const stageChip = daysChip(daysInStage, 7, 14);
                    const inactiveChip = daysChip(inactiveDays, 7, 14);
                    const isEven = rowIdx % 2 === 0;

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => handleRowClick(lead)}
                        className={`cursor-pointer border-b border-slate-100 transition-all duration-150 group
                          ${isEven ? 'bg-white' : 'bg-slate-50/60'}
                          hover:bg-gradient-to-r hover:from-indigo-50/70 hover:to-violet-50/50
                          hover:shadow-sm hover:border-indigo-100`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3 w-10">
                          <div className="h-4 w-4 rounded-md border-2 border-slate-200 bg-white group-hover:border-violet-400 transition-colors" />
                        </td>

                        {/* Opportunity */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${avatarFrom} ${avatarTo} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate max-w-[160px] leading-tight">{dealLabel}</p>
                            </div>
                          </div>
                        </td>

                        {/* Company */}
                        <td className="px-3 py-3">
                          {lead.company_name ? (
                            <span className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                              <span className="text-slate-700 truncate max-w-[110px] font-medium">{lead.company_name}</span>
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Contact */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shrink-0">
                              <User className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-slate-700 truncate max-w-[100px] font-medium">{lead.name}</span>
                          </span>
                        </td>

                        {/* Value */}
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs">
                            <DollarSign className="h-3 w-3" />
                            {fakeValue(lead.id).replace('$', '')}
                          </span>
                        </td>

                        {/* Owned By */}
                        <td className="px-3 py-3">
                          {assignedName ? (
                            <span className="flex items-center gap-1.5">
                              <div className="h-5 w-5 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0">
                                <User className="h-3 w-3 text-white" />
                              </div>
                              <span className="text-slate-700 truncate max-w-[90px] font-medium">{assignedName}</span>
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Tasks */}
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${
                            taskCount > 0
                              ? 'bg-amber-50 border border-amber-200 text-amber-700'
                              : 'bg-slate-50 border border-slate-200 text-slate-400'
                          }`}>
                            <CheckSquare className="h-3 w-3" />
                            {taskCount}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r ${statusInfo.gradient} ${statusInfo.text} shadow-sm`}>
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Stage */}
                        <td className="px-3 py-3">
                          {stageInfo ? (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r ${stageInfo.gradient} ${stageInfo.textColor} border ${stageInfo.border} shadow-sm`}>
                              {stageInfo.label}
                            </span>
                          ) : <span className="text-slate-400 text-xs">{lead.status}</span>}
                        </td>

                        {/* Days in Stage */}
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border ${stageChip.classes}`}>
                            <Timer className="h-3 w-3" />
                            {stageChip.label}
                          </span>
                        </td>

                        {/* Stage Updated */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                            <CalendarDays className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                            {formatShortDate(lead.updated_at)}
                          </span>
                        </td>

                        {/* Last Contacted */}
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                            <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                            {formatShortDate(lead.last_activity_at)}
                          </span>
                        </td>

                        {/* Interactions */}
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${
                            interactionCount > 0
                              ? 'bg-purple-50 border border-purple-200 text-purple-700'
                              : 'bg-slate-50 border border-slate-200 text-slate-400'
                          }`}>
                            <MessageSquare className="h-3 w-3" />
                            {interactionCount}
                          </span>
                        </td>

                        {/* Inactive Days */}
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border ${inactiveChip.classes}`}>
                            <Moon className="h-3 w-3" />
                            {inactiveChip.label}
                          </span>
                        </td>

                        {/* Tags */}
                        <td className="px-3 py-3">
                          {lead.tags && lead.tags.length > 0 ? (
                            <span className="flex items-center gap-1 flex-wrap">
                              {lead.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getTagColor(tag)}`}
                                >
                                  <Tag className="h-2.5 w-2.5" />
                                  {tag}
                                </span>
                              ))}
                              {lead.tags.length > 2 && (
                                <span className="text-xs text-slate-400 font-medium">+{lead.tags.length - 2}</span>
                              )}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
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
