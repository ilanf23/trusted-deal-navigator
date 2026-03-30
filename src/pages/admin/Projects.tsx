import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import EvanLayout from '@/components/evan/EvanLayout';
import ProjectDetailDialog, { type LeadProject } from '@/components/admin/ProjectDetailDialog';
import ProjectDetailPanel from '@/components/admin/ProjectDetailPanel';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useUndo } from '@/contexts/UndoContext';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Search,
  Briefcase,
  ChevronDown,
  Plus,
  SlidersHorizontal,
  Settings,
  Users,
  Maximize2,
} from 'lucide-react';

type SortField = 'name' | 'owner' | 'people' | 'related' | 'updated_at';
type SortDir = 'asc' | 'desc';

const COLUMN_SORT_OPTIONS: Record<string, { label: string; field: SortField; dir: SortDir }[]> = {
  name: [
    { label: 'Name ascending', field: 'name', dir: 'asc' },
    { label: 'Name descending', field: 'name', dir: 'desc' },
  ],
  owner: [
    { label: 'Owner ascending', field: 'owner', dir: 'asc' },
    { label: 'Owner descending', field: 'owner', dir: 'desc' },
  ],
  people: [
    { label: 'People ascending', field: 'people', dir: 'asc' },
    { label: 'People descending', field: 'people', dir: 'desc' },
  ],
  related: [
    { label: 'Related ascending', field: 'related', dir: 'asc' },
    { label: 'Related descending', field: 'related', dir: 'desc' },
  ],
  modified: [
    { label: 'Modified ascending', field: 'updated_at', dir: 'asc' },
    { label: 'Modified descending', field: 'updated_at', dir: 'desc' },
  ],
};

const stageLabels: Record<string, string> = {
  open: 'Open', closed: 'Closed', on_hold: 'On Hold',
  waiting_on_approval: 'Waiting on Approval',
  closing_checklist_in_process: 'Closing Checklist in Process',
  waiting_on_closing_date: 'Waiting on Closing Date',
  closing_scheduled: 'Closing Scheduled',
  ts_received_brad_to_discuss: "TS's Received/Brad to Discuss",
};

const priorityLabels: Record<string, string> = {
  urgent_to_close: 'Urgent to Close', urgent_to_get_approval: 'Urgent to Get Approval',
  purchase: 'Purchase', refinance: 'Refinance',
};

const Projects = () => {
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();
  const queryClient = useQueryClient();
  const { registerUndo } = useUndo();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedProject, setSelectedProject] = useState<LeadProject | null>(null);
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);

  // Bulk action dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addTagsDialogOpen, setAddTagsDialogOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState('');

  // ── Column resize state (persisted to localStorage) ──
  const DEFAULT_COLUMN_WIDTHS = useMemo(() => ({
    name: 260, owner: 150, people: 180, related: 200, modified: 130,
  }), []);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('projects-column-widths');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
      }
    } catch {}
    return DEFAULT_COLUMN_WIDTHS;
  });

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnId]: newWidth };
      localStorage.setItem('projects-column-widths', JSON.stringify(next));
      return next;
    });
  }, []);

  // Close column sort menu on outside click
  useEffect(() => {
    if (!colMenuOpen) return;
    const handler = () => setColMenuOpen(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [colMenuOpen]);

  // ── Top bar: inject title + search into AdminLayout header ──
  const { setPageTitle, setSearchComponent } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('Projects');
    return () => {
      setPageTitle(null);
      setSearchComponent(null);
    };
  }, []);

  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    );
  }, [searchTerm]);

  // Fetch all projects
  const { data: rawProjects = [], isLoading } = useQuery({
    queryKey: ['all-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadProject[];
    },
  });

  // Fetch lead names for "Related To"
  const leadIds = useMemo(() => [...new Set(rawProjects.map(p => p.lead_id))], [rawProjects]);
  const { data: leadMap = {} } = useQuery({
    queryKey: ['project-lead-names', leadIds],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      const { data } = await supabase
        .from('leads')
        .select('id, name, opportunity_name, company_name')
        .in('id', leadIds);
      const map: Record<string, { name: string; opportunity_name: string | null; company_name: string | null }> = {};
      for (const l of data ?? []) map[l.id] = l;
      return map;
    },
    enabled: leadIds.length > 0,
  });

  // Fetch team members for owner display
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const teamMemberMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of teamMembers) m[t.id] = t.name;
    return m;
  }, [teamMembers]);

  // Fetch project_people links
  const { data: projectPeopleRaw = [] } = useQuery({
    queryKey: ['project-people-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_people')
        .select('project_id, lead_id, role');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch lead names for linked people
  const linkedLeadIds = useMemo(() => [...new Set(projectPeopleRaw.map(pp => pp.lead_id))], [projectPeopleRaw]);
  const { data: linkedLeadMap = {} } = useQuery({
    queryKey: ['linked-lead-names', linkedLeadIds],
    queryFn: async () => {
      if (linkedLeadIds.length === 0) return {};
      const { data } = await supabase
        .from('leads')
        .select('id, name')
        .in('id', linkedLeadIds);
      const map: Record<string, string> = {};
      for (const l of data ?? []) map[l.id] = l.name;
      return map;
    },
    enabled: linkedLeadIds.length > 0,
  });

  // Map: project_id → person names[]
  const projectPeopleMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const pp of projectPeopleRaw) {
      const name = linkedLeadMap[pp.lead_id];
      if (!name) continue;
      if (!m[pp.project_id]) m[pp.project_id] = [];
      m[pp.project_id].push(name);
    }
    return m;
  }, [projectPeopleRaw, linkedLeadMap]);

  // Build display string for "Related To"
  const getRelatedTo = (p: LeadProject) => {
    if (p.related_to) return p.related_to;
    const lead = leadMap[p.lead_id];
    if (!lead) return null;
    const parts = [lead.opportunity_name, lead.company_name, lead.name].filter(Boolean);
    return parts[0] || null;
  };

  // Filter & sort
  const filteredProjects = useMemo(() => {
    let result = [...rawProjects];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (leadMap[p.lead_id]?.name ?? '').toLowerCase().includes(q) ||
        (leadMap[p.lead_id]?.company_name ?? '').toLowerCase().includes(q) ||
        (p.clx_file_name ?? '').toLowerCase().includes(q) ||
        (teamMemberMap[p.owner ?? ''] ?? '').toLowerCase().includes(q) ||
        (getRelatedTo(p) ?? '').toLowerCase().includes(q) ||
        (projectPeopleMap[p.id] ?? []).some(name => name.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let aVal = '';
      let bVal = '';
      switch (sortField) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'owner': aVal = teamMemberMap[a.owner ?? ''] ?? ''; bVal = teamMemberMap[b.owner ?? ''] ?? ''; break;
        case 'people': aVal = (projectPeopleMap[a.id] ?? []).join(', '); bVal = (projectPeopleMap[b.id] ?? []).join(', '); break;
        case 'related': aVal = getRelatedTo(a) ?? ''; bVal = getRelatedTo(b) ?? ''; break;
        case 'updated_at': aVal = a.updated_at; bVal = b.updated_at; break;
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [rawProjects, searchTerm, sortField, sortDir, leadMap, teamMemberMap, projectPeopleMap]);



  const allSelected = filteredProjects.length > 0 && selectedIds.size === filteredProjects.length;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredProjects.map(p => p.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // ── Bulk actions ──

  const bulkDeleteMutation = useMutation({
    mutationFn: async (projectIds: string[]) => {
      // Capture projects before deleting for undo
      const { data: deletedProjects } = await supabase
        .from('lead_projects')
        .select('*')
        .in('id', projectIds);
      const { error } = await supabase.from('lead_projects').delete().in('id', projectIds);
      if (error) throw error;
      return { ids: projectIds, deletedProjects: deletedProjects ?? [] };
    },
    onSuccess: ({ ids, deletedProjects }) => {
      queryClient.invalidateQueries({ queryKey: ['all-projects'] });
      toast.success(`${ids.length} project(s) deleted`);
      clearSelection();
      setDeleteConfirmOpen(false);
      if (selectedProject && ids.includes(selectedProject.id)) setSelectedProject(null);
      if (deletedProjects.length > 0) {
        registerUndo({
          label: `Deleted ${ids.length} project(s)`,
          execute: async () => {
            for (const proj of deletedProjects) {
              const { id, ...rest } = proj;
              await supabase.from('lead_projects').insert({ id, ...rest });
            }
            queryClient.invalidateQueries({ queryKey: ['all-projects'] });
          },
        });
      }
    },
    onError: () => toast.error('Failed to delete projects'),
  });

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const handleBulkAssignOwner = useCallback(async (ownerId: string) => {
    const ids = Array.from(selectedIds);
    // Capture previous owners for undo
    const { data: prevProjects } = await supabase
      .from('lead_projects')
      .select('id, owner')
      .in('id', ids);
    const previousOwners = (prevProjects ?? []).map(p => ({ id: p.id, owner: p.owner }));

    try {
      const results = await Promise.all(
        ids.map(id =>
          supabase.from('lead_projects').update({ owner: ownerId, updated_at: new Date().toISOString() }).eq('id', id)
        )
      );
      const failed = results.filter(r => r.error);
      if (failed.length > 0) {
        toast.error(`Failed to assign ${failed.length} of ${ids.length} project(s)`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['all-projects'] });
      const ownerName = teamMemberMap[ownerId] || 'team member';
      toast.success(`${ids.length} project(s) assigned to ${ownerName}`);
      clearSelection();
      registerUndo({
        label: `Assigned ${ids.length} project(s) to ${ownerName}`,
        execute: async () => {
          for (const prev of previousOwners) {
            await supabase.from('lead_projects').update({ owner: prev.owner }).eq('id', prev.id);
          }
          queryClient.invalidateQueries({ queryKey: ['all-projects'] });
        },
      });
    } catch {
      toast.error('Failed to assign owner');
    }
  }, [selectedIds, teamMemberMap, queryClient, registerUndo]);

  const bulkAddTagsMutation = useMutation({
    mutationFn: async ({ projectIds, tags }: { projectIds: string[]; tags: string[] }) => {
      const { data: currentProjects, error: fetchError } = await supabase
        .from('lead_projects')
        .select('id, tags')
        .in('id', projectIds);
      if (fetchError) throw fetchError;
      // Capture previous tags for undo
      const previousTags = (currentProjects || []).map(p => ({ id: p.id, tags: (p.tags as string[]) || [] }));
      for (const proj of (currentProjects || [])) {
        const existing: string[] = (proj.tags as string[]) || [];
        const merged = Array.from(new Set([...existing, ...tags]));
        const { error } = await supabase.from('lead_projects').update({ tags: merged }).eq('id', proj.id);
        if (error) throw error;
      }
      return { count: projectIds.length, tags, previousTags };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['all-projects'] });
      toast.success(`Added ${result.tags.length} tag(s) to ${result.count} project(s)`);
      clearSelection();
      setAddTagsDialogOpen(false);
      setBulkTagValue('');
      registerUndo({
        label: `Added ${result.tags.length} tag(s) to ${result.count} project(s)`,
        execute: async () => {
          for (const prev of result.previousTags) {
            await supabase.from('lead_projects').update({ tags: prev.tags }).eq('id', prev.id);
          }
          queryClient.invalidateQueries({ queryKey: ['all-projects'] });
        },
      });
    },
    onError: () => toast.error('Failed to add tags'),
  });

  const handleBulkAddTags = () => {
    const tags = bulkTagValue.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length === 0) return;
    bulkAddTagsMutation.mutate({ projectIds: Array.from(selectedIds), tags });
  };

  const handleExportSelected = useCallback(() => {
    const selected = filteredProjects.filter(p => selectedIds.has(p.id));
    const headers = ['Name', 'Owner', 'Status', 'Stage', 'Priority', 'CLX File Name', 'Description', 'Tags', 'Due Date', 'Created', 'Modified'];
    const rows = selected.map(p => [
      p.name,
      p.owner ? teamMemberMap[p.owner] ?? '' : '',
      p.status ?? '',
      p.project_stage ? stageLabels[p.project_stage] ?? p.project_stage : '',
      p.priority ? priorityLabels[p.priority] ?? p.priority : '',
      p.clx_file_name ?? '',
      p.description ?? '',
      (p.tags ?? []).join('; '),
      p.due_date ? format(parseISO(p.due_date), 'M/d/yyyy') : '',
      format(parseISO(p.created_at), 'M/d/yyyy'),
      format(parseISO(p.updated_at), 'M/d/yyyy'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selected.length} project(s)`);
  }, [filteredProjects, selectedIds, teamMemberMap]);

  type ColKey = 'name' | 'owner' | 'people' | 'related' | 'modified';

  const ColHeader = ({
    colKey,
    label,
    children,
    className: extraClassName,
    style: extraStyle,
  }: {
    colKey: ColKey;
    label: string;
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => {
    const width = columnWidths[colKey] ?? 120;
    const sortOptions = COLUMN_SORT_OPTIONS[colKey];
    const isMenuOpen = colMenuOpen === colKey;
    return (
      <th
        className={`px-4 py-1.5 text-left whitespace-nowrap group/col transition-colors hover:z-20 ${extraClassName ?? ''}`}
        style={{ width: `${width}px`, minWidth: 60, maxWidth: 500, backgroundColor: '#eee6f6', border: '1px solid #c8bdd6', ...extraStyle }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d8cce8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eee6f6'; }}
      >
        <ResizableColumnHeader
          columnId={colKey}
          currentWidth={`${width}px`}
          onResize={handleColumnResize}
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground">
            {children}
            {label}
          </span>
          {sortOptions && (
            <div className={`relative ml-auto shrink-0 transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover/col:opacity-100'}`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setColMenuOpen(isMenuOpen ? null : colKey)}
                title="Sort options"
                style={{ color: '#202124', backgroundColor: isMenuOpen ? '#d8cce8' : undefined, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 'bold', lineHeight: 1 }}
                onMouseEnter={(e) => { if (!isMenuOpen) (e.currentTarget as HTMLElement).style.backgroundColor = '#d8cce8'; }}
                onMouseLeave={(e) => { if (!isMenuOpen) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                ⋮
              </button>
              {isMenuOpen && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50, backgroundColor: '#fff', border: '1px solid #e4dced', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 220, padding: '4px 0', overflow: 'hidden' }}>
                  {sortOptions.map((opt) => (
                    <button
                      key={`${opt.field}-${opt.dir}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSortField(opt.field);
                        setSortDir(opt.dir);
                        setColMenuOpen(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f5f0fa] transition-colors"
                    >
                      {opt.dir === 'asc' ? (
                        <span style={{ color: '#3b2778', fontSize: 16 }}>↑</span>
                      ) : (
                        <span style={{ color: '#5f6368', fontSize: 16 }}>↓</span>
                      )}
                      <span style={{ fontSize: 14, color: '#202124' }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </ResizableColumnHeader>
      </th>
    );
  };

  return (
    <EvanLayout>
      <div data-full-bleed className="flex flex-col h-[calc(100vh-3.5rem)] bg-background">
        {/* Filter bar */}
        <div className="shrink-0 border-b border-border bg-card px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Dropdown filter */}
            <button className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 border border-border rounded-md px-3 py-1.5 transition-colors">
              All Projects ({rawProjects.length})
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {/* Add New button */}
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="h-10 px-7 rounded-full bg-[#3b2778] hover:bg-[#2d1d5e] text-white text-sm font-semibold uppercase tracking-wider transition-colors"
            >
              ADD NEW
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <Search className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted transition-colors text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Table + Detail Panel */}
        <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="flex-1">
          {/* ── Bulk Selection Toolbar ── */}
          {selectedIds.size > 0 && (
            <div className="sticky top-0 z-40 px-4 py-2 bg-white dark:bg-background border-b border-border">
              <PipelineBulkToolbar
                selectedCount={selectedIds.size}
                totalCount={filteredProjects.length}
                onClearSelection={clearSelection}
                onExport={handleExportSelected}
                onDeleteBoxes={() => setDeleteConfirmOpen(true)}
                onAssignOwner={handleBulkAssignOwner}
                onAddTags={() => setAddTagsDialogOpen(true)}
                teamMembers={teamMembers}
              />
            </div>
          )}
          {isLoading ? (
            <div className="px-6 py-8 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : (
            <table className="w-full text-sm ml-2" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#eee6f6' }}>
                  <th className="w-12 pl-2 pr-4 py-1.5 text-center sticky top-0 left-0 z-30" style={{ border: '1px solid #c8bdd6', backgroundColor: '#eee6f6' }}>
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                    />
                  </th>
                  <ColHeader colKey="name" label="Name" className="sticky top-0 z-30" style={{ left: 48, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }} />
                  <ColHeader colKey="owner" label="Owned By" className="sticky top-0 z-10" />
                  <ColHeader colKey="people" label="People" className="sticky top-0 z-10" />
                  <ColHeader colKey="related" label="Related To" className="sticky top-0 z-10" />
                  <ColHeader colKey="modified" label="Modified" className="sticky top-0 z-10" />
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => {
                  const ownerName = p.owner ? teamMemberMap[p.owner] : null;
                  const relatedTo = getRelatedTo(p);
                  const isSelected = selectedIds.has(p.id);

                  const isActivePanel = selectedProject?.id === p.id;
                  const stickyBg = isSelected || isActivePanel
                    ? 'bg-[#eee6f6] dark:bg-purple-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-950/40'
                    : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                  return (
                    <tr
                      key={p.id}
                      className={`cursor-pointer transition-colors duration-100 group ${
                        selectedProject?.id === p.id
                          ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40 border-l-[3px] border-l-[#3b2778]'
                          : isSelected
                            ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40 border-l-[3px] border-l-[#3b2778]'
                            : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                      }`}
                      onClick={() => setSelectedProject(p)}
                    >
                      {/* Checkbox */}
                      <td className={`pl-2 pr-4 py-1.5 w-12 text-center sticky left-0 z-[5] transition-colors ${stickyBg}`} style={{ border: '1px solid #c8bdd6' }} onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(p.id)}
                          className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                        />
                      </td>

                      {/* Name (sticky) */}
                      <td className={`px-4 py-1.5 overflow-hidden sticky z-[5] transition-colors ${stickyBg}`} style={{ left: 48, width: columnWidths.name, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="relative flex items-center min-w-0 flex-1">
                            <span className="font-bold text-foreground truncate text-[13px] flex-1 min-w-0">
                              {p.name}
                            </span>
                            <button
                              type="button"
                              title="Open expanded view"
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/projects/expanded-view/${p.id}`); }}
                              className="absolute right-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                            >
                              <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Owned By */}
                      <td className="px-4 py-1.5" style={{ width: columnWidths.owner, border: '1px solid #c8bdd6' }}>
                        <span className="text-[13px] text-foreground truncate block">
                          {ownerName ?? '—'}
                        </span>
                      </td>

                      {/* People */}
                      <td className="px-4 py-1.5" style={{ width: columnWidths.people, border: '1px solid #c8bdd6' }}>
                        {(projectPeopleMap[p.id] ?? []).length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-[13px] text-foreground truncate">
                              {projectPeopleMap[p.id].join(', ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Related To */}
                      <td className="px-4 py-1.5" style={{ width: columnWidths.related, border: '1px solid #c8bdd6' }}>
                        {relatedTo ? (
                          <span className="text-[13px] text-blue-600 dark:text-blue-400 truncate block">
                            {relatedTo}
                          </span>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Modified */}
                      <td className="px-4 py-1.5" style={{ width: columnWidths.modified, border: '1px solid #c8bdd6' }}>
                        <span className="text-[13px] text-muted-foreground">
                          {format(parseISO(p.updated_at), 'M/d/yyyy')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredProjects.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-muted-foreground text-sm" style={{ border: '1px solid #c8bdd6' }}>
                      No projects found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </ScrollArea>

          {/* ── Right Detail Panel (overlay) ── */}
          {selectedProject && (
            <div className="absolute right-0 top-0 z-50 h-full">
              <ProjectDetailPanel
                project={selectedProject}
                teamMemberMap={teamMemberMap}
                teamMembers={teamMembers}
                onClose={() => setSelectedProject(null)}
                onExpand={() => {
                  navigate(`/admin/pipeline/projects/expanded-view/${selectedProject.id}`);
                }}
              />
            </div>
          )}
        </div>

        {/* Create Project Dialog */}
        <ProjectDetailDialog
          project={null}
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          leadId=""
          leadName=""
          teamMembers={teamMembers}
          currentUserName={teamMember?.name ?? null}
          onSaved={() => setCreateDialogOpen(false)}
        />

        {/* ── Bulk Delete Confirmation ── */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} Project{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white">
                {bulkDeleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Bulk Add Tags Dialog ── */}
        <Dialog open={addTagsDialogOpen} onOpenChange={setAddTagsDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Add Tags to {selectedIds.size} Project{selectedIds.size !== 1 ? 's' : ''}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <label htmlFor="bulk-tags" className="text-sm font-medium">Tags (comma-separated)</label>
              <Input
                id="bulk-tags"
                placeholder="e.g. urgent, Q1, follow up"
                value={bulkTagValue}
                onChange={(e) => setBulkTagValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBulkAddTags(); }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddTagsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkAddTags} disabled={bulkAddTagsMutation.isPending || !bulkTagValue.trim()}>
                {bulkAddTagsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Apply Tags
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EvanLayout>
  );
};

export default Projects;
