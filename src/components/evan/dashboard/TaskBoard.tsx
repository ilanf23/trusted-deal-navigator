import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ChevronDown, Star, Trash2, MessageSquare, Search, Filter, SlidersHorizontal, EyeOff, ArrowUpDown, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, isToday, isTomorrow, parseISO, isSameDay } from 'date-fns';
import { useUndo } from '@/contexts/UndoContext';

interface Task {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  estimated_hours: number | null;
  assignee_name: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; hoverBg: string; border: string }> = {
  working: { label: 'Working on it', bg: 'bg-[#ff158a]', text: 'text-white', hoverBg: 'hover:bg-[#e01379]', border: '#ff158a' },
  stuck: { label: 'Stuck', bg: 'bg-[#e2445c]', text: 'text-white', hoverBg: 'hover:bg-[#ce3048]', border: '#e2445c' },
  done: { label: 'Done', bg: 'bg-[#00c875]', text: 'text-white', hoverBg: 'hover:bg-[#00b066]', border: '#00c875' },
  todo: { label: "Haven't started yet", bg: 'bg-[#579bfc]', text: 'text-white', hoverBg: 'hover:bg-[#4589e6]', border: '#579bfc' },
  reschedule: { label: 'Reschedule', bg: 'bg-[#7f8c8d]', text: 'text-white', hoverBg: 'hover:bg-[#6c7a7b]', border: '#7f8c8d' },
  blank: { label: '', bg: 'bg-[#c4c4c4]', text: 'text-white', hoverBg: 'hover:bg-[#b0b0b0]', border: '#c4c4c4' },
};

const getStatusBorderColor = (status: string | null): string => {
  const config = statusConfig[status || 'blank'];
  return config ? `border-l-[${config.border}]` : 'border-l-[#c4c4c4]';
};

const getStatusBorderStyle = (status: string | null): React.CSSProperties => {
  const config = statusConfig[status || 'blank'];
  return { borderLeftColor: config?.border || '#c4c4c4' };
};

export const TaskBoard = () => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({
    today: true,
    tomorrow: true,
  });
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { registerUndo } = useUndo();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['evan-tasks-board'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('*')
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const addTask = useMutation({
    mutationFn: async ({ title, dueDate }: { title: string; dueDate: string }) => {
      const { error } = await supabase.from('evan_tasks').insert({
        title,
        due_date: dueDate,
        status: 'todo',
        priority: '3',
        assignee_name: 'Evan',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-board'] });
      setNewTaskTitle('');
      setAddingToDay(null);
      toast.success('Task added');
    },
    onError: () => toast.error('Failed to add task'),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { error } = await supabase.from('evan_tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['evan-tasks-board'] }),
    onError: () => toast.error('Failed to update task'),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      // Get task data before deleting (for undo)
      const { data: taskToDelete } = await supabase
        .from('evan_tasks')
        .select('*')
        .eq('id', id)
        .single();
      
      const { error } = await supabase.from('evan_tasks').delete().eq('id', id);
      if (error) throw error;
      
      return taskToDelete;
    },
    onSuccess: (deletedTask) => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-board'] });
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      toast.success('Task deleted');
      
      // Register undo for task deletion
      if (deletedTask) {
        registerUndo({
          label: `Deleted "${deletedTask.title}"`,
          execute: async () => {
            const { error } = await supabase.from('evan_tasks').insert({
              id: deletedTask.id,
              title: deletedTask.title,
              status: deletedTask.status,
              priority: deletedTask.priority,
              assignee_name: deletedTask.assignee_name,
              due_date: deletedTask.due_date,
              description: deletedTask.description,
              is_completed: deletedTask.is_completed,
            });
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['evan-tasks-board'] });
            queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
            toast.success('Task restored');
          },
        });
      }
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const handleAddTask = (dayKey: string, dueDate: Date) => {
    if (!newTaskTitle.trim()) return;
    addTask.mutate({ title: newTaskTitle.trim(), dueDate: dueDate.toISOString() });
  };

  const renderPriorityStars = (priority: string | null, interactive: boolean = false, taskId?: string) => {
    const numPriority = parseInt(priority || '3', 10);
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 cursor-pointer transition-colors ${
              star <= numPriority ? 'fill-[#ffcb00] text-[#ffcb00]' : 'text-muted-foreground/20 hover:text-[#ffcb00]/50'
            }`}
            onClick={interactive && taskId ? () => updateTask.mutate({ id: taskId, updates: { priority: star.toString() } }) : undefined}
          />
        ))}
      </div>
    );
  };

  const today = new Date();
  const days = [
    { date: today, label: isToday(today) ? 'Today' : format(today, 'EEEE'), key: 'today' },
    { date: addDays(today, 1), label: 'Tomorrow', key: 'tomorrow' },
    { date: addDays(today, 2), label: format(addDays(today, 2), 'EEEE'), key: format(addDays(today, 2), 'yyyy-MM-dd') },
    { date: addDays(today, 3), label: format(addDays(today, 3), 'EEEE'), key: format(addDays(today, 3), 'yyyy-MM-dd') },
    { date: addDays(today, 4), label: format(addDays(today, 4), 'EEEE'), key: format(addDays(today, 4), 'yyyy-MM-dd') },
  ];

  const getTasksForDay = (date: Date) => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, date);
    });
  };

  const getUnscheduledTasks = () => {
    return tasks.filter((task) => !task.due_date);
  };

  const calculateDaySummary = (dayTasks: Task[]) => {
    const totalHours = dayTasks.reduce((sum, task) => sum + (task.estimated_hours || 0), 0);
    const priorities = dayTasks.map((task) => parseInt(task.priority || '3', 10));
    const avgPriority = priorities.length > 0 ? priorities.reduce((a, b) => a + b, 0) / priorities.length : 0;
    return { totalHours, avgPriority, count: dayTasks.length };
  };

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-none bg-transparent">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  const StatusDropdown = ({ task }: { task: Task }) => (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className={`w-full h-8 px-3 rounded text-xs font-medium ${statusConfig[task.status || 'todo']?.bg} ${statusConfig[task.status || 'todo']?.text} ${statusConfig[task.status || 'todo']?.hoverBg} transition-colors`}
        >
          {statusConfig[task.status || 'todo']?.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-1">
          {Object.entries(statusConfig).filter(([key]) => key !== 'blank').map(([key, config]) => (
            <button
              key={key}
              onClick={() => updateTask.mutate({ id: task.id, updates: { status: key, is_completed: key === 'done' } })}
              className={`w-full h-8 px-3 rounded text-xs font-medium ${config.bg} ${config.text} ${config.hoverBg} transition-colors`}
            >
              {config.label}
            </button>
          ))}
          <button
            onClick={() => updateTask.mutate({ id: task.id, updates: { status: 'blank', is_completed: false } })}
            className="w-full h-8 px-3 rounded text-xs font-medium bg-[#c4c4c4] text-white hover:bg-[#b0b0b0] transition-colors"
          >
            Clear
          </button>
          <div className="border-t my-1" />
          <button className="w-full h-8 px-3 rounded text-xs font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2">
            <span className="text-xs">✏️</span> Edit Labels
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" className="bg-[#0073ea] hover:bg-[#0060c7] text-white rounded-md h-8 px-3 gap-1">
          <Plus className="h-4 w-4" />
          New Item
        </Button>
        <div className="flex items-center gap-1 border-l pl-2 ml-1">
          <Button variant="ghost" size="sm" className="h-8 px-3 text-sm gap-2">
            <Search className="h-4 w-4" />
            Search
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3 text-sm gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3 text-sm gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Sort
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3 text-sm gap-2">
            <EyeOff className="h-4 w-4" />
            Hide
          </Button>
        </div>
      </div>

      {/* Task Board */}
      <Card className="border rounded-lg overflow-hidden">
        <CardContent className="p-0">
          {/* Day Groups */}
          {days.map(({ date, label, key }) => {
            const dayTasks = getTasksForDay(date);
            const summary = calculateDaySummary(dayTasks);
            const isExpanded = expandedDays[key] !== false;

            return (
              <div key={key} className="border-b last:border-b-0">
                <Collapsible open={isExpanded} onOpenChange={() => toggleDay(key)}>
                  {/* Day Header */}
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                      <span className="font-semibold text-[#0073ea] text-sm">{label}</span>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    {/* Column Headers */}
                    <div className="grid grid-cols-[40px_40px_1fr_32px_100px_140px_140px_80px_100px_40px] gap-0 border-y bg-muted/20">
                      <div className="p-2"></div>
                      <div className="p-2"></div>
                      <div className="p-2 text-xs font-medium text-muted-foreground">Item</div>
                      <div className="p-2"></div>
                      <div className="p-2 text-xs font-medium text-muted-foreground text-center">Person</div>
                      <div className="p-2 text-xs font-medium text-muted-foreground text-center">Status</div>
                      <div className="p-2 text-xs font-medium text-muted-foreground text-center">End Date</div>
                      <div className="p-2 text-xs font-medium text-muted-foreground text-center">Hours</div>
                      <div className="p-2 text-xs font-medium text-muted-foreground text-center">Priority</div>
                      <div className="p-2 text-xs font-medium text-muted-foreground text-center">
                        <Plus className="h-4 w-4 mx-auto text-muted-foreground/50" />
                      </div>
                    </div>

                    {/* Tasks */}
                    {dayTasks.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-muted-foreground italic text-center">
                        No tasks scheduled for this day
                      </div>
                    ) : (
                      dayTasks.map((task) => (
                        <div
                          key={task.id}
                          className="grid grid-cols-[40px_40px_1fr_32px_100px_140px_140px_80px_100px_40px] gap-0 border-b border-border/50 items-center hover:bg-muted/20 transition-colors group border-l-[3px]"
                          style={getStatusBorderStyle(task.status)}
                        >
                          {/* Checkbox */}
                          <div className="p-2 flex justify-center">
                            <Checkbox 
                              checked={selectedTasks.has(task.id)}
                              onCheckedChange={() => toggleTaskSelection(task.id)}
                              className="h-4 w-4"
                            />
                          </div>

                          {/* Color indicator */}
                          <div className="p-2"></div>

                          {/* Item Title */}
                          <div className="p-2 flex items-center gap-2">
                            <Input
                              value={task.title}
                              onChange={(e) => updateTask.mutate({ id: task.id, updates: { title: e.target.value } })}
                              className="h-7 border-0 bg-transparent p-0 focus-visible:ring-0 text-sm font-normal flex-1"
                            />
                            <ExternalLink className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>

                          {/* Message Icon */}
                          <div className="p-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <MessageSquare className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground cursor-pointer" />
                          </div>

                          {/* Person */}
                          <div className="p-2 flex justify-center">
                            <Avatar className="h-7 w-7 border-2 border-white shadow-sm">
                              <AvatarFallback className="text-[10px] bg-gradient-to-br from-pink-400 to-pink-600 text-white font-medium">
                                {(task.assignee_name || 'E').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          {/* Status */}
                          <div className="p-2">
                            <StatusDropdown task={task} />
                          </div>

                          {/* End Date */}
                          <div className="p-2 text-center">
                            <span className="text-xs text-muted-foreground">
                              {task.due_date ? format(parseISO(task.due_date), 'd MMM, h:mm a') : '-'}
                            </span>
                          </div>

                          {/* Hours */}
                          <div className="p-2 flex justify-center">
                            <Input
                              type="number"
                              step="0.25"
                              min="0"
                              value={task.estimated_hours || ''}
                              onChange={(e) => updateTask.mutate({ id: task.id, updates: { estimated_hours: parseFloat(e.target.value) || null } })}
                              className="h-7 w-14 text-xs text-center border-0 bg-transparent p-0 focus-visible:ring-0"
                              placeholder="-"
                            />
                          </div>

                          {/* Priority */}
                          <div className="p-2 flex justify-center">
                            {renderPriorityStars(task.priority, true, task.id)}
                          </div>

                          {/* Delete */}
                          <div className="p-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteTask.mutate(task.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Add Item Row */}
                    {addingToDay === key ? (
                      <div className="grid grid-cols-[40px_40px_1fr_32px_100px_140px_140px_80px_100px_40px] gap-0 border-b border-border/50 items-center border-l-[3px] border-l-muted">
                        <div className="p-2"></div>
                        <div className="p-2"></div>
                        <div className="p-2">
                          <Input
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Enter task name..."
                            className="h-7 text-sm border-0 bg-transparent focus-visible:ring-0"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddTask(key, date);
                              if (e.key === 'Escape') {
                                setAddingToDay(null);
                                setNewTaskTitle('');
                              }
                            }}
                          />
                        </div>
                        <div className="col-span-6"></div>
                        <div className="p-2">
                          <Button size="icon" className="h-6 w-6" onClick={() => handleAddTask(key, date)}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingToDay(key)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors w-full border-l-[3px] border-l-transparent"
                      >
                        <Plus className="h-4 w-4" />
                        Add Item
                      </button>
                    )}

                    {/* Summary Row */}
                    {dayTasks.length > 0 && (
                      <div className="grid grid-cols-[40px_40px_1fr_32px_100px_140px_140px_80px_100px_40px] gap-0 bg-muted/30 items-center border-l-[3px] border-l-transparent">
                        <div className="p-2"></div>
                        <div className="p-2"></div>
                        <div className="p-2"></div>
                        <div className="p-2"></div>
                        <div className="p-2"></div>
                        <div className="p-2">
                          {/* Status Progress Bar */}
                          <div className="flex h-5 rounded overflow-hidden">
                            {Object.entries(statusConfig).map(([status, config]) => {
                              const count = dayTasks.filter((t) => t.status === status).length;
                              if (count === 0) return null;
                              const percentage = (count / dayTasks.length) * 100;
                              return (
                                <div 
                                  key={status} 
                                  className={config.bg} 
                                  style={{ width: `${percentage}%` }}
                                  title={`${config.label}: ${count}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                        <div className="p-2"></div>
                        <div className="p-2 text-center">
                          <div className="text-xs font-medium">{summary.totalHours}</div>
                          <div className="text-[10px] text-muted-foreground">sum</div>
                        </div>
                        <div className="p-2 text-center">
                          <div className="text-xs font-medium">{summary.avgPriority.toFixed(1)} / 5</div>
                        </div>
                        <div className="p-2"></div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}

          {/* Unscheduled Tasks */}
          {getUnscheduledTasks().length > 0 && (
            <div className="border-b last:border-b-0">
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-muted-foreground text-sm">Unscheduled</span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {getUnscheduledTasks().length}
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {/* Column Headers */}
                  <div className="grid grid-cols-[40px_40px_1fr_32px_100px_140px_140px_80px_100px_40px] gap-0 border-y bg-muted/20">
                    <div className="p-2"></div>
                    <div className="p-2"></div>
                    <div className="p-2 text-xs font-medium text-muted-foreground">Item</div>
                    <div className="p-2"></div>
                    <div className="p-2 text-xs font-medium text-muted-foreground text-center">Person</div>
                    <div className="p-2 text-xs font-medium text-muted-foreground text-center">Status</div>
                    <div className="p-2 text-xs font-medium text-muted-foreground text-center">End Date</div>
                    <div className="p-2 text-xs font-medium text-muted-foreground text-center">Hours</div>
                    <div className="p-2 text-xs font-medium text-muted-foreground text-center">Priority</div>
                    <div className="p-2"></div>
                  </div>

                  {getUnscheduledTasks().map((task) => (
                    <div
                      key={task.id}
                      className="grid grid-cols-[40px_40px_1fr_32px_100px_140px_140px_80px_100px_40px] gap-0 border-b border-border/50 items-center hover:bg-muted/20 transition-colors group border-l-[3px]"
                      style={getStatusBorderStyle(task.status)}
                    >
                      <div className="p-2 flex justify-center">
                        <Checkbox 
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={() => toggleTaskSelection(task.id)}
                          className="h-4 w-4"
                        />
                      </div>
                      <div className="p-2"></div>
                      <div className="p-2 flex items-center gap-2">
                        <Input
                          value={task.title}
                          onChange={(e) => updateTask.mutate({ id: task.id, updates: { title: e.target.value } })}
                          className="h-7 border-0 bg-transparent p-0 focus-visible:ring-0 text-sm font-normal flex-1"
                        />
                        <ExternalLink className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageSquare className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground cursor-pointer" />
                      </div>
                      <div className="p-2 flex justify-center">
                        <Avatar className="h-7 w-7 border-2 border-white shadow-sm">
                          <AvatarFallback className="text-[10px] bg-gradient-to-br from-pink-400 to-pink-600 text-white font-medium">
                            {(task.assignee_name || 'E').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="p-2">
                        <StatusDropdown task={task} />
                      </div>
                      <div className="p-2 text-center">
                        <span className="text-xs text-muted-foreground">-</span>
                      </div>
                      <div className="p-2 flex justify-center">
                        <Input
                          type="number"
                          step="0.25"
                          min="0"
                          value={task.estimated_hours || ''}
                          onChange={(e) => updateTask.mutate({ id: task.id, updates: { estimated_hours: parseFloat(e.target.value) || null } })}
                          className="h-7 w-14 text-xs text-center border-0 bg-transparent p-0 focus-visible:ring-0"
                          placeholder="-"
                        />
                      </div>
                      <div className="p-2 flex justify-center">
                        {renderPriorityStars(task.priority, true, task.id)}
                      </div>
                      <div className="p-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteTask.mutate(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
