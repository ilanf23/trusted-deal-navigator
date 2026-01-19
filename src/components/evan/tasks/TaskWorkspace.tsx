import { useState, useMemo } from 'react';
import { useTasksData } from '@/hooks/useTasksData';
import { Task, ViewMode } from './types';
import { TaskTableView } from './TaskTableView';
import { TaskKanbanView } from './TaskKanbanView';
import { TaskCalendarView } from './TaskCalendarView';
import { TaskTimelineView } from './TaskTimelineView';
import { TaskDetailDialog } from './TaskDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  LayoutGrid, 
  Table, 
  Calendar, 
  GanttChart, 
  Plus, 
  Search, 
  Filter,
  SlidersHorizontal,
  Zap
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const TaskWorkspace = () => {
  const { tasks, isLoading, addTask, updateTask, deleteTask, addComment } = useTasksData();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

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
    { mode: 'table' as ViewMode, icon: Table, label: 'Table' },
    { mode: 'kanban' as ViewMode, icon: LayoutGrid, label: 'Kanban' },
    { mode: 'calendar' as ViewMode, icon: Calendar, label: 'Calendar' },
    { mode: 'timeline' as ViewMode, icon: GanttChart, label: 'Timeline' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-4 sticky top-16 z-30 bg-background py-2">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <Button 
            onClick={() => handleAddTask({})}
            className="bg-[#0073ea] hover:bg-[#0060c7] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Automate
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>When status changes → Notify</DropdownMenuItem>
              <DropdownMenuItem>When done → Archive</DropdownMenuItem>
              <DropdownMenuItem>When due date passes → Alert</DropdownMenuItem>
              <DropdownMenuItem className="text-primary">+ Create automation</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg flex-shrink-0 min-w-max whitespace-nowrap">
          {viewOptions.map(({ mode, icon: Icon, label }) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(mode)}
              className={viewMode === mode ? 'whitespace-nowrap' : 'text-muted-foreground whitespace-nowrap'}
            >
              <Icon className="h-4 w-4 mr-1" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* View Content */}
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

      {viewMode === 'calendar' && (
        <TaskCalendarView
          tasks={filteredTasks}
          onOpenDetail={setSelectedTask}
          onAddTask={handleAddTask}
        />
      )}

      {viewMode === 'timeline' && (
        <TaskTimelineView
          tasks={filteredTasks}
          onOpenDetail={setSelectedTask}
        />
      )}

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
