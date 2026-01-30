import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTasksData } from '@/hooks/useTasksData';
import { Task, ViewMode, TaskSource, sourceConfig, statusConfig, priorityConfig, statusPickerOptions } from './types';
import { TaskTableView } from './TaskTableView';
import { TaskKanbanView } from './TaskKanbanView';
import { TaskTimelineView } from './TaskTimelineView';
import { TaskDetailDialog } from './TaskDetailDialog';
import GmailComposeDialog from '@/components/admin/GmailComposeDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useGmail } from '@/hooks/useGmail';
import { appendSignature } from '@/lib/email-signature';
import { toast } from 'sonner';
import { 
  LayoutGrid, 
  Table, 
  GanttChart, 
  Plus, 
  User,
  Mail,
  Users,
  Filter,
  Clock,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export const TaskWorkspace = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tasks, isLoading, addTask, updateTask, deleteTask, addComment } = useTasksData();
  const { sendMessage } = useGmail();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<TaskSource>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  
  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeLeadId, setComposeLeadId] = useState<string | null>(null);
  const [composeRecipientName, setComposeRecipientName] = useState('');
  
  // Track if we've already handled the URL params to prevent loops
  const handledNewTaskRef = useRef(false);
  // Handle URL params for creating new task from Gmail
  useEffect(() => {
    const newTask = searchParams.get('newTask');
    if (newTask === 'true' && !handledNewTaskRef.current) {
      handledNewTaskRef.current = true;
      const title = searchParams.get('title') || '';
      const description = searchParams.get('description') || '';
      const leadId = searchParams.get('leadId') || undefined;
      
      // Clear URL params first to prevent re-triggering
      setSearchParams({});
      
      // Create the task with pre-filled data from Gmail
      addTask.mutate({
        title,
        description,
        status: 'todo',
        lead_id: leadId || undefined,
        source: 'gmail',
      });
    } else if (!newTask) {
      // Reset the flag when there's no newTask param
      handledNewTaskRef.current = false;
    }
  }, [searchParams, setSearchParams, addTask]);

  // Track recently completed tasks for fade-out animation
  const [fadingTasks, setFadingTasks] = useState<Set<string>>(new Set());
  const [hiddenTasks, setHiddenTasks] = useState<Set<string>>(new Set());

  const filteredTasks = useMemo(() => {
    let result = tasks;
    
    // Filter out hidden (completed) tasks
    result = result.filter(task => !hiddenTasks.has(task.id));
    
    // Filter by source (gmail includes nudge/follow-up tasks and tasks with follow-up keywords)
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'gmail') {
        const followUpKeywords = ['follow up', 'follow-up', 'followup', 'nudge', 'reminder'];
        result = result.filter(task => {
          const titleLower = task.title.toLowerCase();
          const isFollowUp = followUpKeywords.some(kw => titleLower.includes(kw));
          return task.source === 'gmail' || task.source === 'nudge' || isFollowUp;
        });
      } else {
        result = result.filter(task => task.source === sourceFilter);
      }
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(task => {
        const taskStatus = task.status || 'todo';
        // Handle in_progress/working alias
        if (statusFilter === 'working') {
          return taskStatus === 'working' || taskStatus === 'in_progress';
        }
        return taskStatus === statusFilter;
      });
    }
    
    // Filter by priority
    if (priorityFilter !== 'all') {
      result = result.filter(task => {
        const taskPriority = task.priority || 'none';
        return taskPriority === priorityFilter;
      });
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(term) ||
        task.description?.toLowerCase().includes(term) ||
        task.assignee_name?.toLowerCase().includes(term)
      );
    }
    
    // Sort: completed tasks go to the bottom, then by due date
    result = [...result].sort((a, b) => {
      // Completed tasks go to the bottom
      const aCompleted = a.is_completed || a.status === 'done';
      const bCompleted = b.is_completed || b.status === 'done';
      
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      
      // Within same completion state, sort by due date (nulls at bottom)
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    
    return result;
  }, [tasks, searchTerm, sourceFilter, statusFilter, priorityFilter, hiddenTasks]);

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    // Auto-sync is_completed with status
    const enhancedUpdates = { ...updates };
    
    // If status is being set to 'done', also mark is_completed = true
    if (updates.status === 'done' && updates.is_completed === undefined) {
      enhancedUpdates.is_completed = true;
    }
    
    // If is_completed is being set to true, also set status to 'done'
    if (updates.is_completed === true && updates.status === undefined) {
      enhancedUpdates.status = 'done';
    }
    
    // If status is being changed FROM 'done' to something else, unmark is_completed
    if (updates.status && updates.status !== 'done' && updates.is_completed === undefined) {
      enhancedUpdates.is_completed = false;
    }
    
    // If is_completed is being set to false, reset status to 'todo' if it was 'done'
    if (updates.is_completed === false && updates.status === undefined) {
      // Check current task status - we'll default to 'todo' when uncompleting
      enhancedUpdates.status = 'todo';
    }
    
    updateTask.mutate({ id, updates: enhancedUpdates });
    
    // If task is being completed, trigger fade-out and hide after delay
    if (enhancedUpdates.is_completed === true || enhancedUpdates.status === 'done') {
      setFadingTasks(prev => new Set(prev).add(id));
      
      // After fade animation (1.5s), hide the task
      setTimeout(() => {
        setFadingTasks(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setHiddenTasks(prev => new Set(prev).add(id));
      }, 1500);
    }
    
    // If task is being uncompleted, make sure it's visible again
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

  const handleDeleteTask = (id: string) => {
    deleteTask.mutate(id);
  };

  const handleAddTask = (task: Partial<Task>) => {
    addTask.mutate(task);
  };

  const handleAddComment = (taskId: string, content: string) => {
    addComment.mutate({ taskId, content });
  };

  // Handle compose email from task detail dialog
  const handleComposeEmail = async (leadId: string | null, template?: string) => {
    if (!leadId) {
      // Just open empty compose if no lead
      setComposeOpen(true);
      return;
    }

    try {
      // Fetch lead details
      const { data: lead, error } = await supabase
        .from('leads')
        .select('id, name, email, company_name')
        .eq('id', leadId)
        .single();

      if (error || !lead) {
        toast.error('Could not load lead details');
        return;
      }

      if (!lead.email) {
        toast.error('Lead has no email address');
        return;
      }

      // Set recipient info
      setComposeLeadId(lead.id);
      setComposeTo(lead.email);
      setComposeRecipientName(lead.name);

      // Generate email content based on template
      const response = await supabase.functions.invoke('generate-lead-email', {
        body: {
          leadId: lead.id,
          emailType: template || 'follow_up',
        },
      });

      if (response.error) throw response.error;

      const { subject, body } = response.data;
      setComposeSubject(subject || `Following up - ${lead.company_name || lead.name}`);
      setComposeBody(appendSignature(body || ''));
      setComposeOpen(true);
    } catch (error: any) {
      toast.error('Failed to generate email: ' + error.message);
    }
  };

  // Handle sending the email
  const handleSendEmail = async () => {
    setComposeSending(true);
    try {
      const success = await sendMessage(composeTo, composeSubject, composeBody);
      
      if (success) {
        // Update lead's last_activity_at
        if (composeLeadId) {
          await supabase
            .from('leads')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', composeLeadId);
        }
        
        setComposeOpen(false);
        
        // Reset compose state
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        setComposeLeadId(null);
        setComposeRecipientName('');
        
        toast.success('Email sent successfully');
      }
    } catch (error: any) {
      toast.error('Failed to send email: ' + error.message);
    } finally {
      setComposeSending(false);
    }
  };

  const toggleTaskSelection = (id: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const viewOptions = [
    { mode: 'table' as ViewMode, icon: Table, label: 'List' },
    { mode: 'kanban' as ViewMode, icon: LayoutGrid, label: 'Board' },
    { mode: 'timeline' as ViewMode, icon: GanttChart, label: 'Timeline' },
  ];

  const sourceFilters: { value: TaskSource; label: string; icon: React.ElementType }[] = [
    { value: 'all', label: 'All', icon: Filter },
    { value: 'manual', label: 'Self-Made', icon: User },
    { value: 'gmail', label: 'Gmail', icon: Mail },
    { value: 'lead', label: 'From Lead', icon: Users },
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

      {/* Top Row - New Task + Search */}
      <div className="flex items-center gap-3 sticky top-14 md:top-16 z-30 py-3 md:py-4 -mx-1 px-1 backdrop-blur-xl bg-background/80">
        <Button 
          onClick={() => setIsNewTaskDialogOpen(true)}
          className="h-9 md:h-10 px-3 md:px-5 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-lg shadow-foreground/10 transition-all duration-300 hover:shadow-xl hover:shadow-foreground/20 hover:scale-[1.02] text-sm md:text-base"
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

      {/* Unified Filter Bar - Source Filters (left) + Status/Priority + View Switcher (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-muted/40 rounded-2xl border border-muted-foreground/10">
        {/* Left side - Source Filter + Additional Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Source Filter - Pill Style */}
          <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 dark:bg-slate-800/60 rounded-full backdrop-blur-sm">
            {sourceFilters.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSourceFilter(value)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  sourceFilter === value 
                    ? 'bg-white dark:bg-slate-700 text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          
          {/* Status Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={statusFilter !== 'all' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={`h-9 gap-1.5 rounded-full ${statusFilter !== 'all' ? 'bg-background shadow-sm' : ''}`}
              >
                {statusFilter !== 'all' && (
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: statusConfig[statusFilter]?.color || '#64748b' }} 
                  />
                )}
                <span className="text-sm">
                  {statusFilter === 'all' ? 'Status' : statusConfig[statusFilter]?.label || statusFilter}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <span>All Statuses</span>
                </div>
                {statusFilter === 'all' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {statusPickerOptions.map(status => {
                const config = statusConfig[status];
                return (
                  <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                      <span>{config.label}</span>
                    </div>
                    {statusFilter === status && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Priority Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={priorityFilter !== 'all' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={`h-9 gap-1.5 rounded-full ${priorityFilter !== 'all' ? 'bg-background shadow-sm' : ''}`}
              >
                {priorityFilter !== 'all' && (
                  <AlertCircle 
                    className="h-3.5 w-3.5" 
                    style={{ color: priorityConfig[priorityFilter]?.color || '#94a3b8' }} 
                  />
                )}
                <span className="text-sm">
                  {priorityFilter === 'all' ? 'Priority' : priorityConfig[priorityFilter]?.label || priorityFilter}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Filter by Priority</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPriorityFilter('all')}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <span>All Priorities</span>
                </div>
                {priorityFilter === 'all' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {Object.entries(priorityConfig).map(([priority, config]) => (
                <DropdownMenuItem key={priority} onClick={() => setPriorityFilter(priority)}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" style={{ color: config.color }} />
                    <span>{config.label}</span>
                  </div>
                  {priorityFilter === priority && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Clear Filters Button - only show when filters are active */}
          {(statusFilter !== 'all' || priorityFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 rounded-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* View Switcher - Pill Style */}
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

      {/* Stats Bar - responsive layout */}
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
        
        {/* Time Estimate - Top Right */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-full">
          <Clock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span className="text-rose-700 dark:text-rose-300 font-medium">
            {(() => {
              const incompleteTasks = tasks.filter(t => t.status !== 'done');
              const totalMinutes = incompleteTasks.reduce((sum, task) => {
                // Use estimated_hours if available, otherwise default to 15 minutes (0.25 hours)
                const hours = task.estimated_hours ?? 0.25;
                return sum + (hours * 60);
              }, 0);
              const hours = Math.floor(totalMinutes / 60);
              const mins = Math.round(totalMinutes % 60);
              if (hours > 0) {
                return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
              }
              return `${mins}m`;
            })()}
          </span>
          <span className="text-rose-600/70 dark:text-rose-400/70 text-xs">est.</span>
        </div>
      </div>

      {/* View Content */}
      <div className="min-h-[500px]">
        {viewMode === 'table' && (
          <TaskTableView
            tasks={filteredTasks}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onAddTask={handleAddTask}
            onOpenDetail={setSelectedTask}
            selectedTasks={selectedTasks}
            onToggleSelect={toggleTaskSelection}
            fadingTasks={fadingTasks}
            onComposeEmail={handleComposeEmail}
          />
        )}

        {viewMode === 'kanban' && (
          <TaskKanbanView
            tasks={filteredTasks}
            onUpdateTask={handleUpdateTask}
            onAddTask={handleAddTask}
            onOpenDetail={setSelectedTask}
          />
        )}


        {viewMode === 'timeline' && (
          <TaskTimelineView
            tasks={filteredTasks}
            onOpenDetail={setSelectedTask}
          />
        )}
      </div>

      {/* Task Detail Dialog - for viewing/editing existing tasks */}
      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdateTask={handleUpdateTask}
        onAddComment={handleAddComment}
        onComposeEmail={handleComposeEmail}
      />

      {/* New Task Dialog - for creating new tasks */}
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

      {/* Gmail Compose Dialog */}
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
