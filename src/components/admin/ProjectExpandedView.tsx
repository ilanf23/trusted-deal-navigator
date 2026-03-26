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
  Loader2, Trash2, Circle, CircleCheck, Briefcase, MoreHorizontal, Copy, Check,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
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
  assigned_to: string | null;
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

  // ── Queries ──

  const { data: project, isLoading } = useQuery({
    queryKey: ['project-expanded', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_projects')
        .select('*')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data as LeadProject;
    },
    enabled: !!projectId,
  });

  const { data: lead } = useQuery({
    queryKey: ['project-lead', project?.lead_id],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*').eq('id', project!.lead_id).single();
      return data;
    },
    enabled: !!project?.lead_id,
  });

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

  // Activities for this lead
  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', project?.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', project!.lead_id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!project?.lead_id,
  });

  // Tasks for this lead (used in Board tab)
  const { data: tasks = [] } = useQuery({
    queryKey: ['person-tasks', project?.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', project!.lead_id)
        .order('created_at', { ascending: false });
      return (data ?? []) as ProjectTask[];
    },
    enabled: !!project?.lead_id,
  });

  // Contacts for this lead
  const { data: contacts = [] } = useQuery({
    queryKey: ['lead-contacts', project?.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_contacts')
        .select('*')
        .eq('lead_id', project!.lead_id);
      return data ?? [];
    },
    enabled: !!project?.lead_id,
  });

  // Pipeline info for this lead
  const { data: pipelineInfo } = useQuery({
    queryKey: ['lead-pipeline-info', project?.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pipeline_leads')
        .select('pipeline_id, pipelines(name)')
        .eq('lead_id', project!.lead_id)
        .limit(1)
        .single();
      return data as { pipeline_id: string; pipelines: { name: string } | null } | null;
    },
    enabled: !!project?.lead_id,
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
    const { error } = await supabase
      .from('lead_projects')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    if (error) { toast.error('Failed to save'); return; }
    queryClient.invalidateQueries({ queryKey: ['project-expanded', projectId] });
    queryClient.invalidateQueries({ queryKey: ['all-projects'] });
  }, [projectId, queryClient]);

  // ── Log activity ──

  const handleLogActivity = useCallback(async () => {
    if (!project?.lead_id || !noteContent.trim()) return;
    setSavingNote(true);
    await supabase.from('lead_activities').insert({
      lead_id: project.lead_id,
      activity_type: activityTab === 'note' ? 'note' : activityType,
      content: noteContent.trim(),
      title: activityTab === 'note' ? 'Note' : activityType.replace(/_/g, ' '),
      created_by: teamMember?.name ?? null,
    });
    setSavingNote(false);
    setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['lead-activities', project.lead_id] });
    toast.success(activityTab === 'note' ? 'Note saved' : 'Activity logged');
  }, [project?.lead_id, noteContent, activityTab, activityType, teamMember, queryClient]);

  // ── Board: add task ──

  const handleAddBoardTask = useCallback(async (status: string) => {
    if (!project?.lead_id || !newTaskTitle.trim()) return;
    await supabase.from('tasks').insert({
      lead_id: project.lead_id,
      title: newTaskTitle.trim(),
      status: status === 'pending' ? 'todo' : status,
      source: 'lead',
      created_by: teamMember?.name ?? null,
    });
    setNewTaskTitle('');
    setAddingTaskCol(null);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', project.lead_id] });
    toast.success('Task added');
  }, [project?.lead_id, newTaskTitle, teamMember, queryClient]);

  // ── Board: toggle task ──

  const handleToggleTask = useCallback(async (task: ProjectTask) => {
    const isCompleting = !task.completed_at;
    await supabase.from('tasks').update({
      completed_at: isCompleting ? new Date().toISOString() : null,
      is_completed: isCompleting,
      status: isCompleting ? 'done' : 'todo',
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.lead_id] });
  }, [project?.lead_id, queryClient]);

  // ── Board: update task field ──

  const handleUpdateTaskField = useCallback(async (taskId: string, field: string, value: unknown) => {
    await supabase.from('tasks').update({
      [field]: value,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.lead_id] });
    // Keep selected task in sync
    setSelectedBoardTask(prev => prev?.id === taskId ? { ...prev, [field]: value } as ProjectTask : prev);
  }, [project?.lead_id, queryClient]);

  // ── Board task grouping ──

  const boardColumns = useMemo(() => {
    const todo = tasks.filter(t => !t.status || t.status === 'todo' || t.status === 'pending' || t.status === 'to_do');
    const inProgress = tasks.filter(t => t.status === 'in_progress' || t.status === 'working');
    const done = tasks.filter(t => t.status === 'done' || t.status === 'completed');
    return { todo, inProgress, done };
  }, [tasks]);

  const ownerName = project?.owner ? teamMemberMap[project.owner] : null;

  const teamMemberId = teamMember?.id;
  const { data: isFollowing = false } = useQuery({
    queryKey: ['lead-follow', projectId, teamMemberId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_followers').select('id')
        .eq('lead_id', projectId!).eq('team_member_id', teamMemberId!).maybeSingle();
      return !!data;
    },
    enabled: !!projectId && !!teamMemberId,
  });
  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await supabase.from('lead_followers').delete().eq('lead_id', projectId!).eq('team_member_id', teamMemberId!);
      } else {
        await supabase.from('lead_followers').insert({ lead_id: projectId!, team_member_id: teamMemberId! });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-follow', projectId, teamMemberId] });
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
    },
  });

  const handleDeleteProject = useCallback(async () => {
    if (!projectId) return;
    await supabase.from('lead_projects').delete().eq('id', projectId);
    toast.success('Project deleted');
    navigate('/admin/pipeline/projects');
  }, [projectId, navigate]);

  if (isLoading || !project) {
    return (
      <div className="flex flex-col h-full bg-background p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div data-full-bleed className="flex flex-col bg-background h-[calc(100vh-3.5rem)] md:overflow-hidden overflow-y-auto">
      {/* Tabs bar (no header) */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="flex items-center gap-0 px-6">
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
            {/* Toolbar */}
            <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-2 border-b border-border bg-card/50">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5">
                <ArrowUpDown className="h-3 w-3" /> Sort
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5">
                <SlidersHorizontal className="h-3 w-3" /> Filter
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="flex gap-4 h-full min-h-[400px]">
                {[
                  { key: 'pending', label: 'To Do', items: boardColumns.todo },
                  { key: 'in_progress', label: 'In Progress', items: boardColumns.inProgress },
                  { key: 'completed', label: 'Done', items: boardColumns.done, icon: <CircleCheck className="h-4 w-4 text-emerald-500" /> },
                ].map(col => (
                  <div key={col.key} className="flex-1 min-w-[220px] bg-muted/30 rounded-xl flex flex-col">
                    {/* Column header */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        {col.icon}
                        <span className="text-sm font-semibold text-foreground">{col.label}</span>
                        <span className="text-xs text-muted-foreground">({col.items.length})</span>
                      </div>
                      <button
                        onClick={() => { setAddingTaskCol(col.key); setNewTaskTitle(''); }}
                        className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Cards */}
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
                            placeholder="Task name..."
                            className="w-full text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleAddBoardTask(col.key)} disabled={!newTaskTitle.trim()}>Add</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingTaskCol(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                      {col.items.map(task => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedBoardTask(task)}
                          className={`bg-card rounded-lg border p-3 hover:shadow-sm transition-all cursor-pointer ${
                            selectedBoardTask?.id === task.id ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-border'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                            <p className="text-sm text-foreground truncate flex-1">{task.title}</p>
                          </div>
                          {task.assigned_to && teamMemberMap[task.assigned_to] && (
                            <div className="flex items-center justify-end mt-3">
                              <span className="text-[11px] text-muted-foreground">{teamMemberMap[task.assigned_to]}</span>
                              <div className="ml-1.5 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold">
                                {teamMemberMap[task.assigned_to][0]?.toUpperCase()}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {col.items.length === 0 && addingTaskCol !== col.key && (
                        <div className="text-center py-8 text-muted-foreground text-xs">No tasks</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Task detail panel */}
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
                      value={selectedBoardTask.assigned_to ?? ''}
                      onValueChange={(v) => handleUpdateTaskField(selectedBoardTask.id, 'assigned_to', v || null)}
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
                      value={selectedBoardTask.status ?? 'pending'}
                      onValueChange={(v) => handleUpdateTaskField(selectedBoardTask.id, 'status', v)}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Done</SelectItem>
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
                        queryClient.invalidateQueries({ queryKey: ['person-tasks', project?.lead_id] });
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
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

          {/* LEFT: Details */}
          <div className="w-full md:w-[300px] lg:w-[380px] xl:w-[480px] shrink-0 min-w-0 md:border-r border-b md:border-b-0 border-border bg-card overflow-hidden">
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
                  <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <FolderOpen className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 pt-0.5 flex-1">
                    <h2 className="text-xl font-semibold text-foreground truncate leading-tight">{project.name}</h2>
                    {lead && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {[lead.company_name, lead.name].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                        <FolderOpen className="h-3 w-3" /> Project
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Action buttons ── */}
                <div className="flex items-center gap-1">
                  <Button
                    variant={isFollowing ? 'default' : 'outline'}
                    size="sm"
                    className={`h-8 text-sm font-medium gap-1.5 rounded-full px-5 ${isFollowing ? 'bg-blue-600 hover:bg-red-600 text-white' : ''}`}
                    onClick={() => toggleFollowMutation.mutate()}
                    onMouseEnter={() => setFollowHovered(true)}
                    onMouseLeave={() => setFollowHovered(false)}
                  >
                    {isFollowing ? (followHovered ? 'Unfollow' : 'Following') : 'Follow'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                      toast.success('Link copied');
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
          <div className="w-full md:w-[240px] lg:w-[310px] xl:w-[374px] shrink-0 min-w-0 md:border-l border-t md:border-t-0 border-border bg-card overflow-hidden flex flex-col">
            <ScrollArea className="md:flex-1">
              <div className="py-4 px-1 overflow-hidden">
                {/* Files */}
                <RelatedSection icon={<FileText className="h-3.5 w-3.5" />} label="Files" count={0} onAdd={() => {}}>
                  <div className="py-1">
                    <p className="text-xs text-muted-foreground">No files attached</p>
                  </div>
                </RelatedSection>

                {/* People */}
                <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={contacts.length} onAdd={() => {}}>
                  <div className="space-y-3 py-1">
                    {contacts.map((c: any) => (
                      <div key={c.id} className="flex items-start gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0">
                          {c.name?.split(' ').map((n: string) => n[0]?.toUpperCase()).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                          {c.title && <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate">{c.title}</p>}
                          {c.phone && <p className="text-[11px] text-muted-foreground">{c.phone}</p>}
                          {c.email && <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate ml-1">{c.email}</p>}
                        </div>
                      </div>
                    ))}
                    {contacts.length === 0 && <p className="text-xs text-muted-foreground py-1">No people linked</p>}
                  </div>
                </RelatedSection>

                {/* Tasks */}
                <RelatedSection icon={<Circle className="h-3.5 w-3.5" />} label="Tasks" count={tasks.length} onAdd={() => {}}>
                  <div className="space-y-1 py-1">
                    {tasks.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-xs py-1">
                        <button onClick={() => handleToggleTask(t)} className="shrink-0">
                          {t.completed_at ? <CircleCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />}
                        </button>
                        <span className={`truncate ${t.completed_at ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{t.title}</span>
                      </div>
                    ))}
                    {tasks.length === 0 && <p className="text-xs text-muted-foreground py-1">No tasks</p>}
                  </div>
                </RelatedSection>

                {/* Companies */}
                <RelatedSection icon={<Briefcase className="h-3.5 w-3.5" />} label="Companies" count={lead?.company_name ? 1 : 0} onAdd={() => {}}>
                  <div className="py-1">
                    {lead?.company_name ? (
                      <p className="text-xs text-foreground">{lead.company_name}</p>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>Add Company</span>
                      </div>
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
                <RelatedSection icon={<DollarSign className="h-3.5 w-3.5" />} label="Pipeline Records" count={lead ? 1 : 0} onAdd={() => {}}>
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

  const handleSave = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <label className="text-xs text-muted-foreground block mb-1">{label}</label>
        {multiline ? (
          <Textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }} rows={3} className="text-sm resize-none" />
        ) : (
          <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }} className="h-9 text-sm" />
        )}
      </div>
    );
  }

  return (
    <div className="cursor-pointer hover:bg-muted/40 rounded-md -mx-2 px-2 py-1 transition-colors" onClick={() => { setDraft(value); setEditing(true); }}>
      <label className="text-xs text-muted-foreground block mb-0.5">{label}</label>
      <p className="text-sm text-foreground whitespace-pre-wrap">{value || <span className="text-muted-foreground italic">{placeholder || '—'}</span>}</p>
    </div>
  );
}
