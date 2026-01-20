import { useState, useMemo, useEffect } from 'react';
import { useTasksData } from '@/hooks/useTasksData';
import { Task, ViewMode } from './types';
import { TaskTableView } from './TaskTableView';
import { TaskKanbanView } from './TaskKanbanView';
import { TaskTimelineView } from './TaskTimelineView';
import { TaskDetailDialog } from './TaskDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  LayoutGrid, 
  Table, 
  Calendar, 
  GanttChart, 
  Plus, 
  Search,
  Link2,
  Check,
  Loader2
} from 'lucide-react';

const CALLBACK_URL = 'https://trusted-deal-navigator.lovable.app/admin/calendar-callback';

export const TaskWorkspace = () => {
  const { tasks, isLoading, addTask, updateTask, deleteTask, addComment } = useTasksData();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  
  // Google Calendar connection state
  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check calendar connection status for Evan
  useEffect(() => {
    const checkCalendarStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
          body: { action: 'getStatus', teamMemberName: 'evan' }
        });

        if (!error && data) {
          setCalendarStatus(data);
        }
      } catch (err) {
        console.error('Failed to check calendar status:', err);
      }
    };

    checkCalendarStatus();
    
    // Listen for calendar connection updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'calendarConnected') {
        checkCalendarStatus();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const connectCalendar = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'getAuthUrl', redirectUri: CALLBACK_URL, teamMemberName: 'evan' }
      });

      if (error) throw error;
      if (data?.authUrl) {
        // Store team member name for the callback to use
        localStorage.setItem('calendarTeamMember', 'evan');
        window.open(data.authUrl, '_blank', 'width=500,height=600');
      }
    } catch (err) {
      console.error('Failed to start calendar connection:', err);
      toast.error('Failed to connect calendar');
    } finally {
      setIsConnecting(false);
    }
  };

  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    const term = searchTerm.toLowerCase();
    return tasks.filter(task =>
      task.title.toLowerCase().includes(term) ||
      task.description?.toLowerCase().includes(term) ||
      task.assignee_name?.toLowerCase().includes(term)
    );
  }, [tasks, searchTerm]);

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    updateTask.mutate({ id, updates });
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
    <div className="space-y-6">
      {/* Google Calendar Connection Banner */}
      {!calendarStatus?.connected && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/20 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Calendar className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold">Connect Google Calendar</p>
                <p className="text-sm text-muted-foreground">Sync your calendar to view tasks with your events</p>
              </div>
            </div>
            <Button 
              onClick={connectCalendar}
              disabled={isConnecting}
              className="rounded-full px-6"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Connect
            </Button>
          </div>
        </div>
      )}

      {/* Connected Calendar Banner */}
      {calendarStatus?.connected && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Check className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Google Calendar connected</p>
            <p className="text-xs text-muted-foreground">{calendarStatus.email}</p>
          </div>
        </div>
      )}

      {/* Apple-style Toolbar */}
      <div className="flex items-center justify-between gap-4 sticky top-16 z-30 py-4 -mx-1 px-1 backdrop-blur-xl bg-background/80">
        <div className="flex items-center gap-3">
          {/* New Task Button */}
          <Button 
            onClick={() => handleAddTask({})}
            className="h-10 px-5 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-lg shadow-foreground/10 transition-all duration-300 hover:shadow-xl hover:shadow-foreground/20 hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 h-10 pl-10 rounded-full border-muted-foreground/20 bg-muted/50 focus:bg-background transition-colors"
            />
          </div>
        </div>

        {/* View Switcher - Pill Style */}
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-full backdrop-blur-sm">
          {viewOptions.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                viewMode === mode 
                  ? 'bg-background text-foreground shadow-sm' 
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
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">{tasks.filter(t => t.status === 'done').length} Complete</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">{tasks.filter(t => t.status === 'working').length} In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-muted-foreground">{tasks.filter(t => !t.status || t.status === 'todo').length} To Do</span>
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

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdateTask={handleUpdateTask}
        onAddComment={handleAddComment}
      />
    </div>
  );
};
