import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTasksData } from '@/hooks/useTasksData';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Task, ViewMode } from './types';
import { TaskTableView } from './TaskTableView';
import { TaskKanbanView } from './TaskKanbanView';
import { TaskTimelineView } from './TaskTimelineView';
import { TaskDetailDialog } from './TaskDetailDialog';
import { CompletedTasksSection } from './CompletedTasksSection';
import GmailComposeDialog from '@/components/admin/GmailComposeDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useGmail } from '@/hooks/useGmail';
import { appendSignature } from '@/lib/email-signature';
import { toast } from 'sonner';
import { useEmployeeUIState } from '@/contexts/EmployeeUIStateContext';
import {
  LayoutGrid,
  Table,
  GanttChart,
  Plus,
  Filter,
  Clock,
  Lock,
  Globe,
  Pencil,
  X,
} from 'lucide-react';
import type { SavedTaskFilter, TaskFilterCriteria } from './savedFilters/types';
import { applyTaskFilter, mergeCriteria } from './savedFilters/applyTaskFilter';

interface TasksPageState {
  viewMode: ViewMode;
  searchTerm: string;
  selectedTaskId: string | null;
  isNewTaskDialogOpen: boolean;
}

const TASKS_DEFAULTS: TasksPageState = {
  viewMode: 'table',
  searchTerm: '',
  selectedTaskId: null,
  isNewTaskDialogOpen: false,
};

export interface TaskWorkspaceProps {
  /** Optional preset criteria; if omitted the workspace shows all open tasks. */
  activeFilter?: SavedTaskFilter | null;
  /** Render-time additional criteria (e.g. lead-scoped) merged on top of the active filter. */
  scopeCriteria?: TaskFilterCriteria | null;
  /** Number of public filters created by other users (used in the empty-state hint). */
  otherPublicFiltersCount?: number;
  onClearActiveFilter?: () => void;
  onEditActiveFilter?: () => void;
  /** Hide the active-filter banner (used by callers that render their own header). */
  hideFilterBanner?: boolean;
}

export const TaskWorkspace = ({
  activeFilter,
  scopeCriteria,
  onClearActiveFilter,
  onEditActiveFilter,
  hideFilterBanner,
}: TaskWorkspaceProps = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { teamMember } = useTeamMember();
  const { tasks, isLoading, addTask, updateTask, deleteTask, addComment } = useTasksData(teamMember?.id);
  const { sendMessage } = useGmail();
  const { getPageState, setPageState } = useEmployeeUIState();

  const persisted = getPageState('tasks-workspace', TASKS_DEFAULTS);

  const [viewMode, setViewModeLocal] = useState<ViewMode>(persisted.viewMode);
  const [searchTerm, setSearchTermLocal] = useState(persisted.searchTerm);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpenLocal] = useState(persisted.isNewTaskDialogOpen);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const setViewMode = useCallback((v: ViewMode) => { setViewModeLocal(v); setPageState('tasks-workspace', { viewMode: v }); }, [setPageState]);
  const setSearchTerm = useCallback((v: string) => { setSearchTermLocal(v); setPageState('tasks-workspace', { searchTerm: v }); }, [setPageState]);
  const setIsNewTaskDialogOpen = useCallback((v: boolean) => { setIsNewTaskDialogOpenLocal(v); setPageState('tasks-workspace', { isNewTaskDialogOpen: v }); }, [setPageState]);

  useEffect(() => {
    if (persisted.selectedTaskId && tasks.length > 0 && !selectedTask) {
      const found = tasks.find(t => t.id === persisted.selectedTaskId);
      if (found) setSelectedTask(found);
    }
  }, [tasks, persisted.selectedTaskId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetSelectedTask = useCallback((task: Task | null) => {
    setSelectedTask(task);
    setPageState('tasks-workspace', { selectedTaskId: task?.id || null });
  }, [setPageState]);

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeLeadId, setComposeLeadId] = useState<string | null>(null);
  const [composeRecipientName, setComposeRecipientName] = useState('');

  const handledNewTaskRef = useRef(false);
  const handledTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (taskId && tasks.length > 0 && handledTaskIdRef.current !== taskId) {
      const found = tasks.find(t => t.id === taskId);
      if (found) {
        handledTaskIdRef.current = taskId;
        handleSetSelectedTask(found);
        const next = new URLSearchParams(searchParams);
        next.delete('taskId');
        setSearchParams(next, { replace: true });
      }
    }
  }, [searchParams, tasks, handleSetSelectedTask, setSearchParams]);

  useEffect(() => {
    const newTask = searchParams.get('newTask');
    if (newTask === 'true' && !handledNewTaskRef.current) {
      handledNewTaskRef.current = true;
      const title = searchParams.get('title') || '';
      const description = searchParams.get('description') || '';
      const leadId = searchParams.get('leadId') || undefined;

      const next = new URLSearchParams(searchParams);
      next.delete('newTask');
      next.delete('title');
      next.delete('description');
      next.delete('leadId');
      setSearchParams(next, { replace: true });

      addTask.mutate({
        title,
        description,
        status: 'todo',
        lead_id: leadId || undefined,
        source: 'gmail',
      });
    } else if (!newTask) {
      handledNewTaskRef.current = false;
    }
  }, [searchParams, setSearchParams, addTask]);

  const [fadingTasks, setFadingTasks] = useState<Set<string>>(new Set());
  const [hiddenTasks, setHiddenTasks] = useState<Set<string>>(new Set());

  // Merge active filter criteria + live search + optional scope criteria.
  const mergedCriteria = useMemo<TaskFilterCriteria>(() => {
    const base = activeFilter?.criteria ?? {};
    const withSearch = searchTerm ? { ...base, search: searchTerm } : base;
    return mergeCriteria(withSearch, scopeCriteria ?? null);
  }, [activeFilter, searchTerm, scopeCriteria]);

  const filteredTasks = useMemo(() => {
    const visible = applyTaskFilter(tasks, mergedCriteria, { currentUserId: teamMember?.id });
    const result = visible.filter(t => !hiddenTasks.has(t.id));
    return [...result].sort((a, b) => {
      const aCompleted = a.is_completed || a.status === 'done';
      const bCompleted = b.is_completed || b.status === 'done';
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [tasks, mergedCriteria, teamMember?.id, hiddenTasks]);

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    const enhancedUpdates = { ...updates };
    if (updates.status === 'done' && updates.is_completed === undefined) enhancedUpdates.is_completed = true;
    if (updates.is_completed === true && updates.status === undefined) enhancedUpdates.status = 'done';
    if (updates.status && updates.status !== 'done' && updates.is_completed === undefined) enhancedUpdates.is_completed = false;
    if (updates.is_completed === false && updates.status === undefined) enhancedUpdates.status = 'todo';

    updateTask.mutate({ id, updates: enhancedUpdates });

    if (enhancedUpdates.is_completed === true || enhancedUpdates.status === 'done') {
      setFadingTasks(prev => new Set(prev).add(id));
      setTimeout(() => {
        setFadingTasks(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setHiddenTasks(prev => new Set(prev).add(id));
      }, 1500);
    }

    if (enhancedUpdates.is_completed === false || (enhancedUpdates.status && enhancedUpdates.status !== 'done')) {
      setHiddenTasks(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setFadingTasks(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteTask = (id: string) => deleteTask.mutate(id);
  const handleAddTask = (task: Partial<Task>) => addTask.mutate(task);
  const handleAddComment = (taskId: string, content: string) => addComment.mutate({ taskId, content });

  const handleComposeEmail = async (leadId: string | null, template?: string) => {
    if (!leadId) {
      setComposeOpen(true);
      return;
    }
    try {
      const { data: lead, error } = await supabase
        .from('potential')
        .select('id, name, email, company_name')
        .eq('id', leadId)
        .single();
      if (error || !lead) {
        toast.error('Contact not found');
        return;
      }
      if (!lead.email) {
        toast.error('Contact has no email address');
        return;
      }
      setComposeLeadId(lead.id);
      setComposeTo(lead.email);
      setComposeRecipientName(lead.name);
      const response = await supabase.functions.invoke('generate-lead-email', {
        body: { leadId: lead.id, emailType: template || 'follow_up' },
      });
      if (response.error) throw response.error;
      const { subject, body } = response.data;
      setComposeSubject(subject || `Following up - ${lead.company_name || lead.name}`);
      setComposeBody(appendSignature(body || ''));
      setComposeOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to generate email: ' + message);
    }
  };

  const handleSendEmail = async () => {
    setComposeSending(true);
    try {
      const success = await sendMessage(composeTo, composeSubject, composeBody);
      if (success) {
        if (composeLeadId) {
          await supabase
            .from('potential')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', composeLeadId);
        }
        setComposeOpen(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        setComposeLeadId(null);
        setComposeRecipientName('');
        toast.success('Email sent successfully');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to send email: ' + message);
    } finally {
      setComposeSending(false);
    }
  };

  const toggleTaskSelection = (id: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const viewOptions = [
    { mode: 'table' as ViewMode, icon: Table, label: 'List' },
    { mode: 'kanban' as ViewMode, icon: LayoutGrid, label: 'Board' },
    { mode: 'timeline' as ViewMode, icon: GanttChart, label: 'Timeline' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-muted-foreground/20 border-t-foreground animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">

      {/* Active filter banner */}
      {!hideFilterBanner && activeFilter && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#eee6f6] dark:bg-purple-950/30 border border-[#d8c8eb] dark:border-purple-900/40">
          <Filter className="h-4 w-4 text-[#3b2778] dark:text-purple-400" />
          <span className="text-sm font-semibold text-[#3b2778] dark:text-purple-300">
            {activeFilter.name}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5f6368] dark:text-muted-foreground">
            {activeFilter.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {activeFilter.visibility}
          </span>
          {activeFilter.description && (
            <span className="text-xs text-muted-foreground truncate">{activeFilter.description}</span>
          )}
          <span className="ml-auto flex items-center gap-1">
            {onEditActiveFilter && (
              <button
                onClick={onEditActiveFilter}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-[#3b2778] dark:text-purple-300 hover:bg-white/60 dark:hover:bg-purple-900/40 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
            {onClearActiveFilter && (
              <button
                onClick={onClearActiveFilter}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-[#5f6368] dark:text-muted-foreground hover:bg-white/60 dark:hover:bg-purple-900/40 transition-colors"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </span>
        </div>
      )}

      {/* Top Row - New Task + Search + View switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 md:py-4">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsNewTaskDialogOpen(true)}
            className="h-9 md:h-10 px-3 md:px-5 flex-shrink-0 font-medium text-sm md:text-base rounded-full bg-[#3b2778] text-white hover:bg-[#2f1f61] focus-visible:ring-[#3b2778]"
          >
            <Plus className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">Add</span>
          </Button>

          <div className="relative flex-1 max-w-xs">
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 md:h-10 pl-3 md:pl-4 rounded-full border-muted-foreground/20 bg-muted/50 focus:bg-background transition-colors text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 dark:bg-slate-800/60 rounded-full backdrop-blur-sm">
          {viewOptions.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                viewMode === mode
                  ? 'bg-white dark:bg-slate-700 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-6 text-xs md:text-sm">
        <div className="flex flex-wrap items-center gap-3 md:gap-6">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">{tasks.filter(t => t.status === 'done').length} Complete</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">{tasks.filter(t => t.status === 'working' || t.status === 'in_progress').length} In Progress</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-slate-400" />
            <span className="text-muted-foreground">{tasks.filter(t => !t.status || t.status === 'todo').length} To Do</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-full">
          <Clock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span className="text-rose-700 dark:text-rose-300 font-medium">
            {(() => {
              const incompleteTasks = tasks.filter(t => t.status !== 'done');
              const totalMinutes = incompleteTasks.reduce((sum, task) => {
                const hours = task.estimated_hours ?? 0.25;
                return sum + (hours * 60);
              }, 0);
              const hours = Math.floor(totalMinutes / 60);
              const mins = Math.round(totalMinutes % 60);
              if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
              return `${mins}m`;
            })()}
          </span>
          <span className="text-rose-600/70 dark:text-rose-400/70 text-xs">est.</span>
        </div>
      </div>

      <div className="min-h-[500px]">
        {viewMode === 'table' && (
          <>
            <TaskTableView
              tasks={filteredTasks}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onAddTask={handleAddTask}
              onOpenDetail={handleSetSelectedTask}
              selectedTasks={selectedTasks}
              onToggleSelect={toggleTaskSelection}
              fadingTasks={fadingTasks}
              onComposeEmail={handleComposeEmail}
            />

            <CompletedTasksSection
              tasks={tasks}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onOpenDetail={handleSetSelectedTask}
            />
          </>
        )}

        {viewMode === 'kanban' && (
          <TaskKanbanView
            tasks={filteredTasks}
            onUpdateTask={handleUpdateTask}
            onAddTask={handleAddTask}
            onOpenDetail={handleSetSelectedTask}
          />
        )}

        {viewMode === 'timeline' && (
          <TaskTimelineView
            tasks={filteredTasks}
            onOpenDetail={handleSetSelectedTask}
          />
        )}
      </div>

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => handleSetSelectedTask(null)}
        onUpdateTask={handleUpdateTask}
        onAddComment={handleAddComment}
        onComposeEmail={handleComposeEmail}
      />

      <TaskDetailDialog
        task={null}
        open={isNewTaskDialogOpen}
        onClose={() => setIsNewTaskDialogOpen(false)}
        onUpdateTask={handleUpdateTask}
        onAddComment={handleAddComment}
        onCreateTask={(task) => {
          handleAddTask(task);
          setIsNewTaskDialogOpen(false);
        }}
        isNewTask
      />

      <GmailComposeDialog
        isOpen={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setComposeTo('');
          setComposeSubject('');
          setComposeBody('');
          setComposeLeadId(null);
          setComposeRecipientName('');
        }}
        to={composeTo}
        onToChange={setComposeTo}
        subject={composeSubject}
        onSubjectChange={setComposeSubject}
        body={composeBody}
        onBodyChange={setComposeBody}
        onSend={handleSendEmail}
        sending={composeSending}
        recipientName={composeRecipientName}
      />
    </div>
  );
};
