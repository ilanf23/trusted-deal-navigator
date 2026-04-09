import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  X, ChevronDown, ChevronRight, ChevronLeft, Plus, ArrowUpDown, SlidersHorizontal,
  Users, FolderOpen, CalendarDays, Clock, User, Lock, FileText, DollarSign,
  Loader2, Trash2, Circle, CircleCheck, Briefcase, MoreHorizontal, Copy, Check, Download,
  CalendarPlus, LayoutDashboard,
} from 'lucide-react';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { sanitizeFileName } from '@/lib/utils';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { useUndo } from '@/contexts/UndoContext';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { parseISO, format, differenceInDays } from 'date-fns';
import type { LeadProject } from './ProjectDetailDialog';

// ── Types ──

interface ProjectTask {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  team_member_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Constants ──

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

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
];

const stageOptions = Object.entries(stageLabels).map(([value, label]) => ({ value, label }));
const priorityOptions = [{ value: 'none', label: '—' }, ...Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))];

interface LeadFile {
  id: string;
  entity_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string | null): string {
  if (!fileType) return '📄';
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType === 'application/pdf') return '📕';
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return '📊';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('zip') || fileType.includes('compressed')) return '📦';
  return '📄';
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'M/d/yyyy'); } catch { return '—'; }
}

// ── Related Section ──

function RelatedSection({ icon, label, count, onAdd, children }: {
  icon: React.ReactNode; label: string; count: number; onAdd?: () => void; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div role="button" className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-4 rounded-lg transition-colors cursor-pointer" onClick={() => setOpen(!open)}>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">{icon} {label} <span className="text-muted-foreground font-normal">({count})</span></span>
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {onAdd && (
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground ml-auto" onClick={(e) => { e.stopPropagation(); onAdd(); }}>
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// ── Component ──

export default function ProjectExpandedView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();
  const { registerUndo } = useUndo();
  const { setSearchComponent } = useAdminTopBar();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    );
    return () => setSearchComponent(null);
  }, [searchTerm]);

  const [activeTab, setActiveTab] = useState<'overview' | 'board'>('overview');
  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');
  const [activityType, setActivityType] = useState('to_do');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [followHovered, setFollowHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  // Board task state
  const [addingTaskCol, setAddingTaskCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedBoardTask, setSelectedBoardTask] = useState<ProjectTask | null>(null);

  // Related sidebar inline-add state

  const [addingTask, setAddingTask] = useState(false);
  const [newSidebarTaskTitle, setNewSidebarTaskTitle] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  const [addingCompany, setAddingCompany] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);

  // ── Queries ──

  const { data: project, isLoading } = useQuery({
    queryKey: ['project-expanded', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_projects')
        .select('*')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data as LeadProject;
    },
    enabled: !!projectId,
  });

  const { data: lead } = useQuery({
    queryKey: ['project-lead', project?.entity_id],
    queryFn: async () => {
      const { data } = await supabase.from('potential').select('*').eq('id', project!.entity_id).single();
      return data;
    },
    enabled: !!project?.entity_id,
  });

  const { data: teamMembers = [] } = useAssignableUsers();
  const teamMemberMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of teamMembers) m[t.id] = t.name;
    return m;
  }, [teamMembers]);

  // Activities for this lead
  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', project?.entity_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('entity_id', project!.entity_id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!project?.entity_id,
  });

  // Tasks for this lead (used in Board tab)
  const { data: tasks = [] } = useQuery({
    queryKey: ['person-tasks', project?.entity_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', project!.entity_id)
        .order('created_at', { ascending: false });
      return (data ?? []) as ProjectTask[];
    },
    enabled: !!project?.entity_id,
  });

  // Contacts for this lead (legacy)
  const { data: contacts = [] } = useQuery({
    queryKey: ['lead-contacts', project?.entity_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_contacts')
        .select('*')
        .eq('entity_id', project!.entity_id)
        .eq('entity_type', 'potential');
      return data ?? [];
    },
    enabled: !!project?.entity_id,
  });

  // Linked people (project_people junction)
  const { data: projectPeople = [] } = useQuery({
    queryKey: ['project-people', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_people')
        .select('id, lead_id, role')
        .eq('project_id', projectId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });

  const ppLeadIds = useMemo(() => projectPeople.map(pp => pp.lead_id), [projectPeople]);
  const { data: ppLeadMap = {} } = useQuery({
    queryKey: ['pp-lead-names', ppLeadIds],
    queryFn: async () => {
      if (ppLeadIds.length === 0) return {};
      const { data } = await supabase.from('potential').select('id, name, company_name, email, phone').in('id', ppLeadIds);
      const m: Record<string, { name: string; company_name: string | null; email: string | null; phone: string | null }> = {};
      for (const l of data ?? []) m[l.id] = l;
      return m;
    },
    enabled: ppLeadIds.length > 0,
  });

  // All leads for people picker
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const { data: allLeadsForPicker = [] } = useQuery({
    queryKey: ['all-leads-picker-expanded'],
    queryFn: async () => {
      const { data } = await supabase.from('potential').select('id, name, company_name').order('name').limit(200);
      return (data ?? []) as { id: string; name: string; company_name: string | null }[];
    },
    enabled: showPeoplePicker,
  });

  const filteredPickerLeads = useMemo(() => {
    const existing = new Set(ppLeadIds);
    let list = allLeadsForPicker.filter(l => !existing.has(l.id));
    if (peopleSearch.trim()) {
      const q = peopleSearch.toLowerCase();
      list = list.filter(l => l.name.toLowerCase().includes(q) || (l.company_name ?? '').toLowerCase().includes(q));
    }
    return list.slice(0, 10);
  }, [allLeadsForPicker, ppLeadIds, peopleSearch]);

  // Company search-to-link — queries master `companies` + distinct company_names from `potential` and `people`
  const { data: companiesSearchResults = [] } = useQuery<Array<{
    id: string;
    company_name: string;
    website: string | null;
    source: 'companies' | 'derived';
  }>>({
    queryKey: ['project-companies-search', companySearchQuery],
    queryFn: async () => {
      const q = companySearchQuery.trim();
      if (!q) return [];
      const [companiesRes, potentialRes, peopleRes] = await Promise.all([
        supabase
          .from('companies')
          .select('id, company_name, website')
          .ilike('company_name', `%${q}%`)
          .order('company_name', { ascending: true })
          .limit(20),
        supabase
          .from('potential')
          .select('id, company_name')
          .ilike('company_name', `%${q}%`)
          .not('company_name', 'is', null)
          .limit(20),
        supabase
          .from('people')
          .select('id, company_name')
          .ilike('company_name', `%${q}%`)
          .not('company_name', 'is', null)
          .limit(20),
      ]);
      const merged = new Map<string, {
        id: string;
        company_name: string;
        website: string | null;
        source: 'companies' | 'derived';
      }>();
      (companiesRes.data || []).forEach((c) => {
        const key = (c.company_name || '').toLowerCase();
        if (key) merged.set(key, { ...c, source: 'companies' });
      });
      (potentialRes.data || []).forEach((row) => {
        const name = (row.company_name || '').trim();
        const key = name.toLowerCase();
        if (!name || !key) return;
        if (!merged.has(key)) {
          merged.set(key, { id: `pot:${row.id}`, company_name: name, website: null, source: 'derived' });
        }
      });
      (peopleRes.data || []).forEach((row) => {
        const name = (row.company_name || '').trim();
        const key = name.toLowerCase();
        if (!name || !key) return;
        if (!merged.has(key)) {
          merged.set(key, { id: `ppl:${row.id}`, company_name: name, website: null, source: 'derived' });
        }
      });
      return Array.from(merged.values()).sort((a, b) =>
        a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' })
      );
    },
    enabled: addingCompany && companySearchQuery.trim().length > 0,
  });

  // Files for this lead
  const { data: leadFiles = [] } = useQuery({
    queryKey: ['project-lead-files', project?.entity_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_files')
        .select('id, file_name, file_url, file_type, file_size, uploaded_by, created_at')
        .eq('entity_id', project!.entity_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadFile[];
    },
    enabled: !!project?.entity_id,
  });

  // Pipeline info for this lead
  const { data: pipelineInfo } = useQuery({
    queryKey: ['lead-pipeline-info', project?.entity_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('potential')
        .select('pipeline_id, pipelines:pipeline_id(name)')
        .eq('id', project!.entity_id)
        .single();
      return data as { pipeline_id: string; pipelines: { name: string } | null } | null;
    },
    enabled: !!project?.entity_id,
  });

  // ── Stats ──

  const stats = useMemo(() => {
    const now = new Date();
    const interactionCount = activities.length;
    let lastContactedDate: Date | null = null;
    if (activities.length > 0) lastContactedDate = new Date(activities[0].created_at);
    const inactiveDays = lastContactedDate ? differenceInDays(now, lastContactedDate) : null;
    const wonStatuses = ['funded', 'closed_won', 'won'];
    const lostStatuses = ['lost', 'closed_lost', 'dead'];
    const leadStatus = (lead?.status ?? '').toLowerCase();
    const isWon = wonStatuses.includes(leadStatus);
    const isResolved = isWon || lostStatuses.includes(leadStatus);
    const winRate = isResolved ? (isWon ? 100 : 0) : 0;
    const totalWon = isWon && lead?.loan_amount ? lead.loan_amount : 0;
    return { interactionCount, lastContactedDate, inactiveDays, winRate, totalWon };
  }, [activities, lead]);

  // ── Field save ──

  const saveField = useCallback(async (field: string, value: unknown) => {
    if (!projectId) return;
    // Capture previous value before update
    const { data: prev } = await supabase.from('entity_projects').select(field).eq('id', projectId).single();
    const previousValue = prev ? (prev as Record<string, unknown>)[field] : null;
    const { error } = await supabase
      .from('entity_projects')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    if (error) { toast.error('Failed to save'); return; }
    registerUndo({
      label: `Updated ${field}`,
      execute: async () => {
        const { error: e } = await supabase.from('entity_projects').update({ [field]: previousValue, updated_at: new Date().toISOString() }).eq('id', projectId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['project-expanded', projectId] });
        queryClient.invalidateQueries({ queryKey: ['all-projects'] });
      },
    });
    queryClient.invalidateQueries({ queryKey: ['project-expanded', projectId] });
    queryClient.invalidateQueries({ queryKey: ['all-projects'] });
  }, [projectId, queryClient, registerUndo]);

  // ── Log activity ──

  const handleLogActivity = useCallback(async () => {
    if (!project?.entity_id || !noteContent.trim()) return;
    setSavingNote(true);
    await supabase.from('activities').insert({
      entity_id: project.entity_id,
      entity_type: 'potential',
      activity_type: activityTab === 'note' ? 'note' : activityType,
      content: noteContent.trim(),
      title: activityTab === 'note' ? 'Note' : activityType.replace(/_/g, ' '),
      created_by: teamMember?.name ?? null,
    });
    setSavingNote(false);
    setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['lead-activities', project.entity_id] });
    toast.success(activityTab === 'note' ? 'Note saved' : 'Activity logged');
  }, [project?.entity_id, noteContent, activityTab, activityType, teamMember, queryClient]);

  // ── Board: add task ──

  const handleAddBoardTask = useCallback(async (status: string) => {
    if (!project?.entity_id || !newTaskTitle.trim()) return;
    const { data: created, error } = await supabase.from('tasks').insert({
      lead_id: project.entity_id,
      title: newTaskTitle.trim(),
      status: status,
      source: 'lead',
      created_by: teamMember?.name ?? null,
    }).select('id').single();
    if (error) { toast.error('Failed to add task'); return; }
    setNewTaskTitle('');
    setAddingTaskCol(null);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', project.entity_id] });
    toast.success('Task added');
    if (created) {
      registerUndo({
        label: `Created task "${newTaskTitle.trim()}"`,
        execute: async () => {
          const { error: e } = await supabase.from('tasks').delete().eq('id', created.id);
          if (e) throw e;
          queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.entity_id] });
        },
      });
    }
  }, [project?.entity_id, newTaskTitle, teamMember, queryClient, registerUndo]);

  // ── Board: toggle task ──

  const handleToggleTask = useCallback(async (task: ProjectTask) => {
    const isCompleting = !task.completed_at;
    const prevCompletedAt = task.completed_at;
    const prevStatus = task.status;
    const { error } = await supabase.from('tasks').update({
      completed_at: isCompleting ? new Date().toISOString() : null,
      is_completed: isCompleting,
      status: isCompleting ? 'done' : 'todo',
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    if (error) { toast.error('Failed to update task'); return; }
    registerUndo({
      label: isCompleting ? `Completed "${task.title}"` : `Reopened "${task.title}"`,
      execute: async () => {
        const { error: e } = await supabase.from('tasks').update({
          completed_at: prevCompletedAt,
          is_completed: !!prevCompletedAt,
          status: prevStatus || 'todo',
          updated_at: new Date().toISOString(),
        }).eq('id', task.id);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.entity_id] });
      },
    });
    queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.entity_id] });
  }, [project?.entity_id, queryClient, registerUndo]);

  // ── Board: update task field ──

  const handleUpdateTaskField = useCallback(async (taskId: string, field: string, value: unknown) => {
    // Capture previous value for undo
    const { data: prev } = await supabase.from('tasks').select(field).eq('id', taskId).single();
    const previousValue = prev ? (prev as Record<string, unknown>)[field] : null;
    const { error } = await supabase.from('tasks').update({
      [field]: value,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId);
    if (error) { toast.error('Failed to update task'); return; }
    queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.entity_id] });
    // Keep selected task in sync
    setSelectedBoardTask(prev => prev?.id === taskId ? { ...prev, [field]: value } as ProjectTask : prev);
    registerUndo({
      label: `Updated task ${field}`,
      execute: async () => {
        const { error: e } = await supabase.from('tasks').update({ [field]: previousValue, updated_at: new Date().toISOString() }).eq('id', taskId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.entity_id] });
      },
    });
  }, [project?.entity_id, queryClient, registerUndo]);

  // ── Board task grouping ──

  const boardColumns = useMemo(() => {
    const todo = tasks.filter(t => !t.status || t.status === 'todo' || t.status === 'pending' || t.status === 'to_do');
    const inProgress = tasks.filter(t => t.status === 'in_progress' || t.status === 'working');
    const done = tasks.filter(t => t.status === 'done' || t.status === 'completed');
    return { todo, inProgress, done };
  }, [tasks]);

  const ownerName = project?.owner ? teamMemberMap[project.owner] : null;

  const teamMemberId = teamMember?.id;
  const leadId = project?.entity_id;
  const { data: isFollowing = false } = useQuery({
    queryKey: ['lead-follow', leadId, teamMemberId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_followers').select('id')
        .eq('entity_id', leadId!).eq('team_member_id', teamMemberId!).maybeSingle();
      return !!data;
    },
    enabled: !!leadId && !!teamMemberId,
  });
  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await supabase.from('entity_followers').delete().eq('entity_id', leadId!).eq('team_member_id', teamMemberId!);
      } else {
        await supabase.from('entity_followers').insert({ entity_id: leadId!, entity_type: 'potential', team_member_id: teamMemberId! });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-follow', leadId, teamMemberId] });
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
    },
  });

  const handleDeleteProject = useCallback(async () => {
    if (!projectId) return;
    // Capture full project record before deleting
    const { data: projectData } = await supabase.from('entity_projects').select('*').eq('id', projectId).single();
    const { error } = await supabase.from('entity_projects').delete().eq('id', projectId);
    if (error) { toast.error('Failed to delete project'); return; }
    if (projectData) {
      registerUndo({
        label: `Deleted project "${projectData.name}"`,
        execute: async () => {
          const { error: e } = await supabase.from('entity_projects').insert(projectData);
          if (e) throw e;
          queryClient.invalidateQueries({ queryKey: ['all-projects'] });
        },
      });
    }
    toast.success('Project deleted');
    navigate('/admin/pipeline/projects');
  }, [projectId, navigate, registerUndo, queryClient]);

  // ── Add person (project_people) ──
  const handleAddPerson = useCallback(async (leadId: string) => {
    if (!projectId) return;
    const { error } = await supabase.from('project_people').insert({ project_id: projectId, lead_id: leadId });
    if (error) { toast.error('Failed to link person'); return; }
    toast.success('Person linked');
    setShowPeoplePicker(false);
    setPeopleSearch('');
    queryClient.invalidateQueries({ queryKey: ['project-people', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-people-all'] });
  }, [projectId, queryClient]);

  // ── Remove person (project_people) ──
  const handleRemovePerson = useCallback(async (linkId: string) => {
    const { error } = await supabase.from('project_people').delete().eq('id', linkId);
    if (error) { toast.error('Failed to remove'); return; }
    toast.success('Person removed');
    queryClient.invalidateQueries({ queryKey: ['project-people', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-people-all'] });
  }, [projectId, queryClient]);

  // ── Save task (Related sidebar) ──
  const handleSaveSidebarTask = useCallback(async () => {
    if (!project?.entity_id || !newSidebarTaskTitle.trim()) return;
    setSavingTask(true);
    const { data: created, error } = await supabase.from('tasks').insert({
      lead_id: project.entity_id,
      title: newSidebarTaskTitle.trim(),
      status: 'todo',
      source: 'lead',
      created_by: teamMember?.name ?? null,
    }).select('id').single();
    setSavingTask(false);
    if (error) { toast.error('Failed to create task'); return; }
    toast.success('Task created');
    setNewSidebarTaskTitle(''); setAddingTask(false);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', project.entity_id] });
    if (created) {
      registerUndo({
        label: `Created task "${newSidebarTaskTitle.trim()}"`,
        execute: async () => {
          const { error: e } = await supabase.from('tasks').delete().eq('id', created.id);
          if (e) throw e;
          queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.entity_id] });
        },
      });
    }
  }, [project?.entity_id, newSidebarTaskTitle, teamMember, queryClient, registerUndo]);

  // ── Link company (Related sidebar) — used by search result clicks & Enter ──
  const handleLinkCompany = useCallback(async (companyName: string) => {
    if (!project?.entity_id || !companyName.trim()) return;
    setSavingCompany(true);
    const { error } = await supabase.from('potential').update({ company_name: companyName.trim() }).eq('id', project.entity_id);
    setSavingCompany(false);
    if (error) { toast.error('Failed to update company'); return; }
    toast.success('Company linked');
    setCompanySearchQuery('');
    setAddingCompany(false);
    queryClient.invalidateQueries({ queryKey: ['project-lead', project.entity_id] });
  }, [project?.entity_id, queryClient]);

  // ── Remove company (Related sidebar) ──
  const handleRemoveCompany = useCallback(async () => {
    if (!project?.entity_id) return;
    setSavingCompany(true);
    const { error } = await supabase.from('potential').update({ company_name: null }).eq('id', project.entity_id);
    setSavingCompany(false);
    if (error) { toast.error('Failed to remove company'); return; }
    toast.success('Company removed');
    queryClient.invalidateQueries({ queryKey: ['project-lead', project.entity_id] });
  }, [project?.entity_id, queryClient]);

  // ── File upload ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project?.entity_id) return;
    e.target.value = '';

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) { toast.error('You must be logged in to upload files.'); return; }

    setUploadingFile(true);
    const filePath = `${project.entity_id}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('lead-files')
      .upload(filePath, file, { contentType: file.type || 'application/octet-stream', upsert: true });

    if (uploadError) {
      setUploadingFile(false);
      toast.error(`Upload failed: ${uploadError.message || 'Storage error'}`);
      return;
    }

    const { error: dbError } = await supabase.from('entity_files').insert({
      entity_id: project.entity_id,
      entity_type: 'potential',
      file_name: file.name,
      file_url: filePath,
      file_type: file.type || null,
      file_size: file.size,
    });
    setUploadingFile(false);
    if (dbError) {
      await supabase.storage.from('lead-files').remove([filePath]);
      toast.error('Failed to save file record');
      return;
    }
    toast.success('File uploaded');
    queryClient.invalidateQueries({ queryKey: ['project-lead-files', project.entity_id] });
  }, [project?.entity_id, queryClient]);

  // ── File drop handler ──
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    // Reuse the upload handler by creating a synthetic event
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileInputRef.current) {
      fileInputRef.current.files = dt.files;
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, []);

  // ── File delete ──
  const handleDeleteFile = useCallback(async (file: LeadFile) => {
    await supabase.storage.from('lead-files').remove([file.file_url]);
    const { error } = await supabase.from('entity_files').delete().eq('id', file.id);
    if (error) { toast.error('Failed to delete file'); return; }
    toast.success('File deleted');
    queryClient.invalidateQueries({ queryKey: ['project-lead-files', project?.entity_id] });
    // No undo for file deletes — storage object is already removed and cannot be restored
  }, [project?.entity_id, queryClient]);

  // ── File download (signed URL) ──
  const handleDownloadFile = useCallback(async (file: LeadFile) => {
    const { data, error } = await supabase.storage.from('lead-files').createSignedUrl(file.file_url, 60);
    if (error || !data?.signedUrl) { toast.error('Failed to generate download link'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = file.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  if (isLoading || !project) {
    return (
      <div className="flex flex-col h-full bg-background p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div data-full-bleed className="project-expanded-view system-font flex flex-col bg-background h-[calc(100vh-3.5rem)] md:overflow-hidden overflow-y-auto">
      <style>{`
        .project-expanded-view,
        .project-expanded-view *:not(svg):not(svg *) {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        }
      `}</style>
      {/* Project name header */}
      <div className="shrink-0 px-6 pt-4 pb-2 bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground truncate">{project.name}</h1>
          {ownerName && (
            <span className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground uppercase" title={ownerName}>
              {ownerName.charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs bar with actions */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-0">
            {(['board', 'overview'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-semibold capitalize relative transition-colors ${
                  activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'board' ? 'Board' : 'Overview'}
                {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
              </button>
            ))}
          </div>
          {activeTab === 'board' && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5">
                <ArrowUpDown className="h-3 w-3" /> Sort
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5">
                <SlidersHorizontal className="h-3 w-3" /> Filter
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5">
                <CalendarPlus className="h-3 w-3" /> Create Template
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5">
                <LayoutDashboard className="h-3 w-3" /> Edit Layout
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this project? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setShowDeleteConfirm(false); handleDeleteProject(); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BOARD TAB ── */}
      {activeTab === 'board' && (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Board columns */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            <div className="flex-1 overflow-auto bg-muted pl-4">
              <div className="flex h-full min-h-[400px] divide-x divide-border">
                {[
                  { key: 'todo', label: 'To Do', items: boardColumns.todo },
                  { key: 'in_progress', label: 'In Progress', items: boardColumns.inProgress },
                  { key: 'done', label: 'Done', items: boardColumns.done, icon: <CircleCheck className="h-4 w-4 text-emerald-500" /> },
                ].map(col => (
                  <div key={col.key} className="flex-1 min-w-[220px] flex flex-col">
                    {/* Column header */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        {col.icon}
                        <span className="text-sm font-semibold text-foreground">{col.label}</span>
                        <span className="text-xs text-muted-foreground">({col.items.length})</span>
                      </div>
                      <button
                        onClick={() => { setAddingTaskCol(col.key); setNewTaskTitle(''); }}
                        className="flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
                      >
                        <Plus className="h-5 w-5" strokeWidth={2} />
                      </button>
                    </div>

                    {/* Tickets */}
                    <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto">
                      {addingTaskCol === col.key && (
                        <div className="bg-card rounded-lg border border-border p-3">
                          <input
                            autoFocus
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newTaskTitle.trim()) handleAddBoardTask(col.key);
                              if (e.key === 'Escape') setAddingTaskCol(null);
                            }}
                            placeholder="Ticket name..."
                            className="w-full text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleAddBoardTask(col.key)} disabled={!newTaskTitle.trim()}>Add</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingTaskCol(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                      {col.items.map(ticket => (
                        <div
                          key={ticket.id}
                          onClick={() => setSelectedBoardTask(ticket)}
                          className={`bg-card rounded-lg border p-3 hover:shadow-sm transition-all cursor-pointer ${
                            selectedBoardTask?.id === ticket.id ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-border'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                            <p className="text-sm text-foreground truncate flex-1">{ticket.title}</p>
                          </div>
                          {ticket.team_member_id && teamMemberMap[ticket.team_member_id] && (
                            <div className="flex items-center justify-end mt-3">
                              <span className="text-[11px] text-muted-foreground">{teamMemberMap[ticket.team_member_id]}</span>
                              <div className="ml-1.5 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold">
                                {teamMemberMap[ticket.team_member_id][0]?.toUpperCase()}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {col.items.length === 0 && addingTaskCol !== col.key && (
                        <div className="text-center py-8 text-muted-foreground text-xs">No tickets</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ticket detail panel */}
          {selectedBoardTask && (
            <div className="w-[360px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="px-5 py-4 space-y-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground leading-tight flex-1">{selectedBoardTask.title}</h3>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedBoardTask(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Title</label>
                    <Input
                      defaultValue={selectedBoardTask.title}
                      className="h-9 text-sm"
                      onBlur={(e) => {
                        if (e.target.value.trim() !== selectedBoardTask.title) {
                          handleUpdateTaskField(selectedBoardTask.id, 'title', e.target.value.trim());
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Description</label>
                    <Textarea
                      defaultValue={selectedBoardTask.description ?? ''}
                      placeholder="Add description..."
                      rows={4}
                      className="text-sm resize-none"
                      onBlur={(e) => {
                        const val = e.target.value.trim() || null;
                        if (val !== (selectedBoardTask.description ?? '')) {
                          handleUpdateTaskField(selectedBoardTask.id, 'description', val);
                        }
                      }}
                    />
                  </div>

                  {/* Assigned To */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Assigned To</label>
                    <Select
                      value={selectedBoardTask.team_member_id ?? ''}
                      onValueChange={(v) => handleUpdateTaskField(selectedBoardTask.id, 'team_member_id', v || null)}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Status</label>
                    <Select
                      value={selectedBoardTask.status ?? 'todo'}
                      onValueChange={(v) => handleUpdateTaskField(selectedBoardTask.id, 'status', v)}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Priority</label>
                    <Select
                      value={selectedBoardTask.priority ?? ''}
                      onValueChange={(v) => handleUpdateTaskField(selectedBoardTask.id, 'priority', v || null)}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Due Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 text-sm text-foreground hover:bg-muted/40 rounded-md px-2 py-1 -mx-2 transition-colors w-full text-left">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {selectedBoardTask.due_date ? format(parseISO(selectedBoardTask.due_date), 'M/d/yyyy') : <span className="text-muted-foreground italic">Set due date</span>}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedBoardTask.due_date ? parseISO(selectedBoardTask.due_date) : undefined}
                          onSelect={(date) => handleUpdateTaskField(selectedBoardTask.id, 'due_date', date ? date.toISOString() : null)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Created */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Created</label>
                    <p className="text-sm text-muted-foreground">{format(parseISO(selectedBoardTask.created_at), 'M/d/yyyy h:mm a')}</p>
                  </div>

                  {/* Delete task */}
                  <div className="pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:text-destructive gap-1.5"
                      onClick={async () => {
                        await supabase.from('tasks').delete().eq('id', selectedBoardTask.id);
                        queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.entity_id] });
                        setSelectedBoardTask(null);
                        toast.success('Task deleted');
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete Task
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden">

          {/* LEFT: Details */}
          <div className="w-full md:w-[255px] lg:w-[323px] xl:w-[408px] shrink-0 min-w-0 md:border-r border-b md:border-b-0 border-border bg-card overflow-hidden">
            <ScrollArea className="md:h-full">
              <div className="px-4 md:pl-6 md:pr-4 lg:pl-8 lg:pr-5 xl:pl-11 xl:pr-6 py-6 space-y-6">

                {/* ── Back Arrow ── */}
                <button onClick={() => navigate(-1)} className="flex items-center text-muted-foreground hover:text-foreground transition-colors -ml-2 py-1">
                  <svg width="32" height="16" viewBox="0 0 32 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="30" y1="8" x2="2" y2="8" />
                    <polyline points="8,2 2,8 8,14" />
                  </svg>
                </button>

                {/* ── Project Header Card ── */}
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-white">
                      {project.name.split(' ').map(n => n[0]?.toUpperCase()).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div className="min-w-0 pt-0.5 flex-1">
                    <h2 className="text-xl font-semibold text-foreground truncate leading-tight">{project.name}</h2>
                    {lead && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {[lead.company_name, lead.name].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground bg-muted/50">
                        <Briefcase className="h-3 w-3" /> Project
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Fields ── */}
                <div className="space-y-5">
                  {/* Name */}
                  <FieldRow label="Name *" value={project.name} onSave={(v) => saveField('name', v)} />

                  {/* Template */}
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">Template <Lock className="h-3 w-3" /></label>
                    <p className="text-sm text-muted-foreground italic">No Selection</p>
                  </div>

                  {/* CLX File Name */}
                  <FieldRow label="CLX - File Name" value={project.clx_file_name ?? ''} onSave={(v) => saveField('clx_file_name', v || null)} />

                  {/* Waiting On */}
                  <FieldRow label="Waiting On:" value={project.waiting_on ?? ''} onSave={(v) => saveField('waiting_on', v || null)} placeholder="Add Waiting On:" />

                  {/* Owner */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Owner</label>
                    <Select value={project.owner ?? ''} onValueChange={(v) => saveField('owner', v || null)}>
                      <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Status</label>
                    <Select value={project.status ?? 'open'} onValueChange={(v) => saveField('status', v)}>
                      <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Project Stage */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Project Stage</label>
                    <Select value={project.project_stage ?? 'open'} onValueChange={(v) => saveField('project_stage', v)}>
                      <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {stageOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Priority</label>
                    <Select value={project.priority ?? 'none'} onValueChange={(v) => saveField('priority', v === 'none' ? null : v)}>
                      <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Due Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 text-sm text-foreground hover:bg-muted/40 rounded-md px-2 py-1 -mx-2 transition-colors w-full text-left">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {project.due_date ? format(parseISO(project.due_date), 'M/d/yyyy') : <span className="text-muted-foreground italic">Set due date</span>}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={project.due_date ? parseISO(project.due_date) : undefined}
                          onSelect={(date) => saveField('due_date', date ? date.toISOString() : null)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Created */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Created</label>
                    <p className="text-sm text-foreground">{format(parseISO(project.created_at), 'M/d/yyyy')}</p>
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Visibility</label>
                    <p className="text-sm text-foreground">{project.visibility || 'Everyone'}</p>
                  </div>

                  {/* Description */}
                  <FieldRow label="Description" value={project.description ?? ''} onSave={(v) => saveField('description', v || null)} multiline placeholder="Add description..." />

                  {/* Tags */}
                  <FieldRow label="Tags" value={(project.tags ?? []).join(', ')} onSave={(v) => saveField('tags', v ? v.split(',').map(t => t.trim()).filter(Boolean) : [])} placeholder="Add Tag" />

                  {/* Bank Relationships */}
                  <FieldRow label="Bank Relationships" value={project.bank_relationships ?? ''} onSave={(v) => saveField('bank_relationships', v || null)} placeholder="Add Bank Relationships" />
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* CENTER: Activity */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f5f0fa] dark:bg-purple-950/20">
            <ScrollArea className="md:flex-1">
              <div className="px-3 md:px-4 lg:px-6 pt-5">
                {/* Stats row — floating card */}
                <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card mb-5">
                  <div className="flex flex-col items-center justify-center py-3 px-2">
                    <span className="text-lg font-bold text-foreground">{stats.interactionCount || '--'}</span>
                    <span className="text-[11px] text-muted-foreground">Interactions</span>
                  </div>
                  <div className="flex flex-col items-center justify-center py-3 px-2">
                    <span className="text-lg font-bold text-foreground">
                      {stats.lastContactedDate ? format(stats.lastContactedDate, 'M/d/yyyy') : '--'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Last Contacted</span>
                  </div>
                  <div className="flex flex-col items-center justify-center py-3 px-2">
                    <span className="text-lg font-bold text-foreground">{stats.inactiveDays ?? '--'}</span>
                    <span className="text-[11px] text-muted-foreground">Inactive Days</span>
                  </div>
                </div>

                {/* Activity tabs + form — floating card */}
                <div className="rounded-lg border border-border bg-card overflow-hidden mb-5">
                  <div className="flex items-stretch">
                    {(['log', 'note'] as const).map(tab => (
                      <button
                        key={tab}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                          activityTab === tab ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setActivityTab(tab)}
                      >
                        {tab === 'log' ? 'Log Activity' : 'Create Note'}
                        {activityTab === tab && <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-700 dark:bg-blue-500" />}
                      </button>
                    ))}
                  </div>

                  {/* Activity input */}
                  <div className="p-5">
              {activityTab === 'log' && (
                <div className="mb-3">
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to_do">To Do</SelectItem>
                      <SelectItem value="phone_call">Phone Call</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Click here to add a note"
                rows={3}
                className="resize-none text-sm"
              />
              {noteContent.trim() && (
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={handleLogActivity} disabled={savingNote}>
                    {savingNote && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    {activityTab === 'note' ? 'Save Note' : 'Log Activity'}
                  </Button>
                </div>
              )}
                  </div>
                </div>

                {/* Activity timeline */}
                <div className="space-y-3 pb-5">
                {activities.length > 0 ? (
                  activities.map(act => (
                    <div key={act.id} className="rounded-lg bg-card border border-border p-4 hover:border-blue-100 dark:hover:border-blue-900 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold">
                          {(act.created_by?.[0] ?? '?').toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-foreground">{act.created_by ?? 'System'}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {format(parseISO(act.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      {act.title && <p className="text-xs font-semibold text-foreground mb-1">{act.title}</p>}
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{act.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground text-sm">No activity recorded yet</div>
                )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT: Related */}
          <div className="w-full md:w-[240px] lg:w-[310px] xl:w-[374px] md:shrink-0 md:min-w-[220px] min-w-0 md:border-l border-t md:border-t-0 border-border bg-card overflow-hidden flex flex-col">
            <ScrollArea className="md:flex-1">
              <div className="py-4 px-3 overflow-hidden">
                {/* Files */}
                <RelatedSection icon={<FileText className="h-3.5 w-3.5" />} label="Files" count={leadFiles.length} onAdd={() => fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                  <div
                    className={`space-y-1.5 py-1 rounded-lg transition-colors ${draggingFile ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-400 ring-dashed' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }}
                    onDragEnter={(e) => { e.preventDefault(); setDraggingFile(true); }}
                    onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingFile(false); }}
                    onDrop={handleFileDrop}
                  >
                    {draggingFile && (
                      <div className="flex items-center justify-center py-4 text-xs text-blue-600 dark:text-blue-400 font-medium">
                        Drop file here to upload
                      </div>
                    )}
                    {!draggingFile && (
                      <>
                        {leadFiles.map((f) => (
                          <div key={f.id} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-muted/40 transition-colors group">
                            <span className="text-sm shrink-0">{getFileIcon(f.file_type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{f.file_name}</p>
                              <p className="text-[10px] text-muted-foreground">{formatFileSize(f.file_size)} · {formatShortDate(f.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); handleDownloadFile(f); }} className="p-1 rounded hover:bg-muted" title="Download">
                                <Download className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </button>
                              <button onClick={() => handleDeleteFile(f)} className="p-1 rounded hover:bg-muted" title="Delete">
                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {uploadingFile && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                            <Loader2 className="h-3 w-3 animate-spin text-orange-500" /> Uploading...
                          </div>
                        )}
                        {leadFiles.length === 0 && !uploadingFile && (
                          <p className="text-xs text-muted-foreground">No files attached — drag & drop or click to upload</p>
                        )}
                        <button onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1">
                          + Upload file...
                        </button>
                      </>
                    )}
                  </div>
                </RelatedSection>

                {/* People */}
                <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={projectPeople.length} onAdd={() => setShowPeoplePicker(!showPeoplePicker)}>
                  <div className="space-y-3 py-1">
                    {/* People picker */}
                    {showPeoplePicker && (
                      <div className="space-y-1.5">
                        <input
                          autoFocus
                          value={peopleSearch}
                          onChange={(e) => setPeopleSearch(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Escape') { setShowPeoplePicker(false); setPeopleSearch(''); } }}
                          placeholder="Search people..."
                          className="w-full text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                        />
                        <div className="max-h-[140px] overflow-y-auto space-y-0.5">
                          {filteredPickerLeads.map(l => (
                            <button
                              key={l.id}
                              onClick={() => handleAddPerson(l.id)}
                              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                            >
                              <User className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-foreground truncate">{l.name}</span>
                              {l.company_name && <span className="text-[10px] text-muted-foreground truncate">· {l.company_name}</span>}
                            </button>
                          ))}
                          {filteredPickerLeads.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">No results</p>}
                        </div>
                      </div>
                    )}

                    {/* Linked people list */}
                    {projectPeople.map(pp => {
                      const info = ppLeadMap[pp.lead_id];
                      return (
                        <div key={pp.id} className="flex items-start gap-2.5 group">
                          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0">
                            {info?.name?.split(' ').map((n: string) => n[0]?.toUpperCase()).join('').slice(0, 2) ?? '??'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">{info?.name ?? '...'}</p>
                            {pp.role && <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate capitalize">{pp.role}</p>}
                            {info?.company_name && <p className="text-[11px] text-muted-foreground truncate">{info.company_name}</p>}
                            {info?.email && <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate">{info.email}</p>}
                          </div>
                          <button
                            onClick={() => handleRemovePerson(pp.id)}
                            className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                            title="Remove person"
                          >
                            <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                          </button>
                        </div>
                      );
                    })}
                    {projectPeople.length === 0 && !showPeoplePicker && <p className="text-xs text-muted-foreground py-1">No people linked</p>}
                    {!showPeoplePicker && (
                      <button onClick={() => setShowPeoplePicker(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1">
                        + Add person...
                      </button>
                    )}
                  </div>
                </RelatedSection>

                {/* Tasks */}
                <RelatedSection icon={<Circle className="h-3.5 w-3.5" />} label="Tasks" count={tasks.length} onAdd={() => setAddingTask(true)}>
                  <div className="space-y-1 py-1">
                    {tasks.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-xs py-1">
                        <button onClick={() => handleToggleTask(t)} className="shrink-0">
                          {t.completed_at ? <CircleCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />}
                        </button>
                        <span className={`truncate ${t.completed_at ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{t.title}</span>
                      </div>
                    ))}
                    {addingTask ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          autoFocus
                          value={newSidebarTaskTitle}
                          onChange={(e) => setNewSidebarTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newSidebarTaskTitle.trim()) handleSaveSidebarTask();
                            if (e.key === 'Escape') { setAddingTask(false); setNewSidebarTaskTitle(''); }
                          }}
                          placeholder="Task title..."
                          disabled={savingTask}
                          className="flex-1 text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                        />
                        {savingTask && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
                      </div>
                    ) : (
                      <button onClick={() => setAddingTask(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1">
                        + Add task...
                      </button>
                    )}
                    {tasks.length === 0 && !addingTask && <p className="text-xs text-muted-foreground py-1">No tasks</p>}
                    {tasks.length > 5 && (
                      <button
                        onClick={() => setActiveTab('board')}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 flex items-center gap-1"
                      >
                        View all {tasks.length} tasks in Board
                      </button>
                    )}
                  </div>
                </RelatedSection>

                {/* Companies */}
                <RelatedSection icon={<Briefcase className="h-3.5 w-3.5" />} label="Companies" count={lead?.company_name ? 1 : 0} onAdd={() => setAddingCompany(true)}>
                  <div className="space-y-2 py-1">
                    {lead?.company_name && (
                      <div className="text-xs text-foreground flex items-center gap-2 group">
                        <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0">
                          {lead.company_name[0]?.toUpperCase()}
                        </div>
                        <span className="flex-1 truncate">{lead.company_name}</span>
                        <button
                          onClick={handleRemoveCompany}
                          disabled={savingCompany}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 disabled:opacity-50"
                          title="Remove company"
                        >
                          {savingCompany ? (
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                          ) : (
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                          )}
                        </button>
                      </div>
                    )}
                    {!lead?.company_name && !addingCompany && <p className="text-xs text-muted-foreground">No companies</p>}
                    {addingCompany ? (
                      <div className="relative mt-1">
                        <input
                          autoFocus
                          value={companySearchQuery}
                          onChange={(e) => setCompanySearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const q = companySearchQuery.trim();
                              if (!q) return;
                              const first = companiesSearchResults[0];
                              if (first) {
                                handleLinkCompany(first.company_name);
                              } else {
                                handleLinkCompany(q);
                              }
                            }
                            if (e.key === 'Escape') { setAddingCompany(false); setCompanySearchQuery(''); }
                          }}
                          placeholder="Search companies..."
                          disabled={savingCompany}
                          className="w-full text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                        />
                        {savingCompany && <Loader2 className="h-3 w-3 animate-spin text-blue-500 mt-1" />}
                        {companySearchQuery.trim().length > 0 && companiesSearchResults.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {companiesSearchResults.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => handleLinkCompany(c.company_name)}
                                className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-muted/60 transition-colors"
                              >
                                <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0">
                                  {c.company_name[0]?.toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-medium text-foreground">{c.company_name}</span>
                                  {c.website && <p className="text-[10px] text-muted-foreground truncate">{c.website}</p>}
                                </div>
                                <span className="text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">
                                  {c.source === 'companies' ? 'Company' : 'Lead'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {companySearchQuery.trim().length > 0 && companiesSearchResults.length === 0 && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg px-2 py-2">
                            <p className="text-xs text-muted-foreground mb-1">No matching companies</p>
                            <button
                              onClick={() => handleLinkCompany(companySearchQuery.trim())}
                              className="w-full text-left text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            >
                              + Use "{companySearchQuery.trim()}" as company
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button onClick={() => setAddingCompany(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1">
                        + {lead?.company_name ? 'Change' : 'Add'} company...
                      </button>
                    )}
                  </div>
                </RelatedSection>

                {/* Financial Summary */}
                <div className="px-4 py-4 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Won</p>
                      <p className="text-lg font-bold text-foreground">${stats.totalWon.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="text-lg font-bold text-foreground">{stats.winRate}%</p>
                    </div>
                  </div>

                  {/* Pipeline value bar */}
                  {lead?.loan_amount && lead.loan_amount > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 mb-1">
                        ${lead.loan_amount >= 1000 ? `${(lead.loan_amount / 1000).toFixed(1)}K` : lead.loan_amount.toLocaleString()}
                      </p>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: '100%' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Pipeline Records */}
                <RelatedSection icon={<DollarSign className="h-3.5 w-3.5" />} label="Pipeline Records" count={lead ? 1 : 0}>
                  <div className="py-1">
                    {lead ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                            <DollarSign className="h-3.5 w-3.5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-foreground truncate">{lead.opportunity_name || lead.name}</p>
                              {lead.loan_amount && (
                                <span className="text-xs font-semibold text-foreground shrink-0">
                                  ${lead.loan_amount >= 1000 ? `${(lead.loan_amount / 1000).toFixed(1)}K` : lead.loan_amount.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">{pipelineInfo?.pipelines?.name ?? 'Pipeline'}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-full capitalize">
                                {lead.status ?? 'open'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No pipeline records</p>
                    )}
                  </div>
                </RelatedSection>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline editable field ──

function FieldRow({ label, value, onSave, multiline, placeholder }: {
  label: string; value: string; onSave: (v: string) => void; multiline?: boolean; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && fieldRef.current) {
      fieldRef.current.focus({ preventScroll: true });
    }
  }, [editing]);

  const handleSave = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="min-w-0">
        <label className="text-xs text-muted-foreground block mb-1">{label}</label>
        {multiline ? (
          <Textarea ref={fieldRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }} rows={3} className="text-sm resize-none focus-visible:ring-offset-0" />
        ) : (
          <Input ref={fieldRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }} className="h-9 text-sm focus-visible:ring-offset-0" />
        )}
      </div>
    );
  }

  return (
    <div className="cursor-pointer hover:bg-muted/40 rounded-md -mx-2 px-2 py-1 transition-colors min-w-0" onClick={() => { setDraft(value); setEditing(true); }}>
      <label className="text-xs text-muted-foreground block mb-0.5">{label}</label>
      <p className={`text-sm text-foreground ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>{value || <span className="text-muted-foreground italic">{placeholder || '—'}</span>}</p>
    </div>
  );
}
