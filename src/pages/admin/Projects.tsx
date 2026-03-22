import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import EvanLayout from '@/components/evan/EvanLayout';
import ProjectDetailDialog, { type LeadProject } from '@/components/admin/ProjectDetailDialog';
import { useTeamMember } from '@/hooks/useTeamMember';
import { format, parseISO } from 'date-fns';
import {
  Search,
  FolderClosed,
  ArrowUpDown,
  ChevronDown,
  Plus,
  SlidersHorizontal,
  Settings,
} from 'lucide-react';

type SortField = 'name' | 'owner' | 'related' | 'updated_at';

const Projects = () => {
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedProject, setSelectedProject] = useState<LeadProject | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch all projects
  const { data: rawProjects = [], isLoading } = useQuery({
    queryKey: ['all-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_projects' as any)
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
        (getRelatedTo(p) ?? '').toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let aVal = '';
      let bVal = '';
      switch (sortField) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'owner': aVal = teamMemberMap[a.owner ?? ''] ?? ''; bVal = teamMemberMap[b.owner ?? ''] ?? ''; break;
        case 'related': aVal = getRelatedTo(a) ?? ''; bVal = getRelatedTo(b) ?? ''; break;
        case 'updated_at': aVal = a.updated_at; bVal = b.updated_at; break;
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [rawProjects, searchTerm, sortField, sortDir, leadMap, teamMemberMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

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

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
    </button>
  );

  return (
    <EvanLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Top bar with search */}
        <div className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground shrink-0">Projects</h1>
          <div className="flex-1 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, domain or phone number"
                className="pl-9 h-9 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="shrink-0 border-b border-border bg-card px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Dropdown filter */}
            <button className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 border border-border rounded-md px-3 py-1.5 transition-colors">
              All Projects ({rawProjects.length})
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {/* Add New button */}
            <Button
              size="sm"
              className="h-8 text-xs font-semibold"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              ADD NEW
            </Button>
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

        {/* Table */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="px-6 py-8 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="w-12 px-4 py-3">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      className="h-4 w-4"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">
                    <SortHeader field="name" label="Name" />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">
                    <SortHeader field="owner" label="Owned By" />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">
                    <SortHeader field="related" label="Related To" />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">
                    <SortHeader field="updated_at" label="Modified" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => {
                  const ownerName = p.owner ? teamMemberMap[p.owner] : null;
                  const relatedTo = getRelatedTo(p);
                  const isSelected = selectedIds.has(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border hover:bg-muted/40 transition-colors cursor-pointer ${isSelected ? 'bg-muted/30' : ''}`}
                      onClick={() => navigate(`/admin/pipeline/projects/expanded-view/${p.id}`)}
                    >
                      {/* Checkbox */}
                      <td className="w-12 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(p.id)}
                          className="h-4 w-4"
                        />
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <FolderClosed className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium text-foreground truncate max-w-[320px] text-[13px]">
                            {p.name}
                          </span>
                        </div>
                      </td>

                      {/* Owned By */}
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-foreground">
                          {ownerName ?? '—'}
                        </span>
                      </td>

                      {/* Related To */}
                      <td className="px-4 py-3">
                        {relatedTo ? (
                          <span className="text-[13px] text-blue-600 dark:text-blue-400 truncate block max-w-[200px]">
                            {relatedTo}
                          </span>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Modified */}
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-muted-foreground">
                          {format(parseISO(p.updated_at), 'M/d/yyyy')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredProjects.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-muted-foreground text-sm">
                      No projects found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </ScrollArea>

        {/* Edit Project Dialog */}
        <ProjectDetailDialog
          project={selectedProject}
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setSelectedProject(null); }}
          leadId={selectedProject?.lead_id ?? ''}
          leadName={selectedProject ? (leadMap[selectedProject.lead_id]?.name ?? '') : ''}
          teamMembers={teamMembers}
          currentUserName={teamMember?.name ?? null}
          onSaved={() => {}}
        />

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
      </div>
    </EvanLayout>
  );
};

export default Projects;
