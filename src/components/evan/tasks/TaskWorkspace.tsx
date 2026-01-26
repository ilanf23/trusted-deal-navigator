import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTasksData } from '@/hooks/useTasksData';
import { Task, ViewMode, TaskSource, sourceConfig } from './types';
import { TaskTableView } from './TaskTableView';
import { TaskKanbanView } from './TaskKanbanView';
import { TaskTimelineView } from './TaskTimelineView';
import { TaskDetailDialog } from './TaskDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  LayoutGrid, 
  Table, 
  GanttChart, 
  Plus, 
  User,
  Mail,
  Users,
  Filter,
} from 'lucide-react';

export const TaskWorkspace = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tasks, isLoading, addTask, updateTask, deleteTask, addComment } = useTasksData();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<TaskSource>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  // Handle URL params for creating new task from Gmail
  useEffect(() => {
    const newTask = searchParams.get('newTask');
    if (newTask === 'true') {
      const title = searchParams.get('title') || '';
      const description = searchParams.get('description') || '';
      const leadId = searchParams.get('leadId') || undefined;
      
      // Create the task with pre-filled data from Gmail
      addTask.mutate({
        title,
        description,
        status: 'todo',
        lead_id: leadId || undefined,
        source: 'gmail',
      });
      
      // Clear URL params
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, addTask]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    
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
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(term) ||
        task.description?.toLowerCase().includes(term) ||
        task.assignee_name?.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [tasks, searchTerm, sourceFilter]);

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
          onClick={() => handleAddTask({})}
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

      {/* Unified Filter Bar - Source Filters (left) + View Switcher (right) */}
      <div className="flex items-center justify-between gap-4 p-1.5 bg-muted/40 rounded-2xl border border-muted-foreground/10">
        {/* Source Filter - Pill Style */}
        <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-full backdrop-blur-sm">
          {sourceFilters.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setSourceFilter(value)}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                sourceFilter === value 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* View Switcher - Pill Style */}
        <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-full backdrop-blur-sm">
          {viewOptions.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
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

      {/* Stats Bar - responsive layout */}
      <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs md:text-sm">
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
