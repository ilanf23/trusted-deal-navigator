import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ChevronDown, Star, Trash2, ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, isToday, isTomorrow, parseISO, isSameDay } from 'date-fns';

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

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  todo: { label: 'To Do', bg: 'bg-slate-100', text: 'text-slate-600' },
  working: { label: 'Working on it', bg: 'bg-amber-400', text: 'text-white' },
  done: { label: 'Done', bg: 'bg-emerald-500', text: 'text-white' },
  reschedule: { label: 'Reschedule', bg: 'bg-pink-400', text: 'text-white' },
  stuck: { label: 'Stuck', bg: 'bg-red-500', text: 'text-white' },
};

export const TaskBoard = () => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({
    today: true,
    tomorrow: true,
  });
  const queryClient = useQueryClient();

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
      const { error } = await supabase.from('evan_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-board'] });
      toast.success('Task deleted');
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const handleAddTask = (dayKey: string, dueDate: Date) => {
    if (!newTaskTitle.trim()) return;
    addTask.mutate({ title: newTaskTitle.trim(), dueDate: dueDate.toISOString() });
  };

  const renderPriorityStars = (priority: string | null) => {
    const numPriority = parseInt(priority || '3', 10);
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= numPriority ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  const getDayLabel = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE');
  };

  const getDayKey = (date: Date): string => {
    if (isToday(date)) return 'today';
    if (isTomorrow(date)) return 'tomorrow';
    return format(date, 'yyyy-MM-dd');
  };

  // Group tasks by day
  const today = new Date();
  const days = [
    { date: today, label: 'Today', key: 'today' },
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListTodo className="h-5 w-5 text-muted-foreground" />
          Task Board
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {/* Header Row */}
          <div className="grid grid-cols-[1fr_80px_100px_120px_60px_80px_40px] gap-2 px-4 py-2 bg-muted/30 border-b text-xs font-medium text-muted-foreground min-w-[700px]">
            <div>Item</div>
            <div>Person</div>
            <div>Status</div>
            <div>End Date</div>
            <div>Hours</div>
            <div>Priority</div>
            <div></div>
          </div>

          {/* Day Groups */}
          {days.map(({ date, label, key }) => {
            const dayTasks = getTasksForDay(date);
            const summary = calculateDaySummary(dayTasks);
            const isExpanded = expandedDays[key] !== false;

            return (
              <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleDay(key)}>
                {/* Day Header */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/10 border-b cursor-pointer hover:bg-muted/20 transition-colors min-w-[700px]">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    <span className="font-semibold text-primary">{label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {dayTasks.length} tasks
                    </Badge>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {/* Tasks */}
                  {dayTasks.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground italic min-w-[700px]">
                      No tasks scheduled
                    </div>
                  ) : (
                    dayTasks.map((task) => (
                      <div
                        key={task.id}
                        className="grid grid-cols-[1fr_80px_100px_120px_60px_80px_40px] gap-2 px-4 py-2 border-b border-border/50 items-center hover:bg-muted/30 transition-colors min-w-[700px]"
                      >
                        {/* Item */}
                        <div className="flex items-center gap-2">
                          <Input
                            value={task.title}
                            onChange={(e) => updateTask.mutate({ id: task.id, updates: { title: e.target.value } })}
                            className="h-8 border-0 bg-transparent p-0 focus-visible:ring-0 text-sm"
                          />
                        </div>

                        {/* Person */}
                        <div className="flex justify-center">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {(task.assignee_name || 'E').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        {/* Status */}
                        <div>
                          <Select
                            value={task.status || 'todo'}
                            onValueChange={(value) => updateTask.mutate({ id: task.id, updates: { status: value, is_completed: value === 'done' } })}
                          >
                            <SelectTrigger className={`h-7 text-xs border-0 ${statusConfig[task.status || 'todo']?.bg} ${statusConfig[task.status || 'todo']?.text}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key} className="text-xs">
                                  {config.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* End Date */}
                        <div className="text-xs text-muted-foreground">
                          {task.due_date ? format(parseISO(task.due_date), 'd MMM, h:mm a') : '-'}
                        </div>

                        {/* Hours */}
                        <div>
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
                        <div className="flex justify-center">
                          <Select
                            value={task.priority || '3'}
                            onValueChange={(value) => updateTask.mutate({ id: task.id, updates: { priority: value } })}
                          >
                            <SelectTrigger className="h-7 w-auto border-0 bg-transparent p-0 focus-visible:ring-0">
                              {renderPriorityStars(task.priority)}
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map((p) => (
                                <SelectItem key={p} value={p.toString()}>
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`h-3 w-3 ${star <= p ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                                      />
                                    ))}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Delete */}
                        <div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
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
                    <div className="grid grid-cols-[1fr_80px_100px_120px_60px_80px_40px] gap-2 px-4 py-2 border-b border-border/50 items-center min-w-[700px]">
                      <Input
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Enter task name..."
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTask(key, date);
                          if (e.key === 'Escape') {
                            setAddingToDay(null);
                            setNewTaskTitle('');
                          }
                        }}
                      />
                      <div className="col-span-5"></div>
                      <div className="flex gap-1">
                        <Button size="icon" className="h-7 w-7" onClick={() => handleAddTask(key, date)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingToDay(key)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors w-full min-w-[700px]"
                    >
                      <Plus className="h-4 w-4" />
                      Add Item
                    </button>
                  )}

                  {/* Summary Row */}
                  {dayTasks.length > 0 && (
                    <div className="grid grid-cols-[1fr_80px_100px_120px_60px_80px_40px] gap-2 px-4 py-2 bg-muted/20 border-b items-center min-w-[700px]">
                      <div></div>
                      <div></div>
                      <div className="flex gap-1">
                        {Object.entries(statusConfig).map(([status, config]) => {
                          const count = dayTasks.filter((t) => t.status === status).length;
                          if (count === 0) return null;
                          return (
                            <div key={status} className={`h-2 rounded-full ${config.bg}`} style={{ width: `${(count / dayTasks.length) * 60}px` }} />
                          );
                        })}
                      </div>
                      <div></div>
                      <div className="text-xs font-medium text-muted-foreground text-center">
                        {summary.totalHours > 0 ? `${summary.totalHours}h` : '-'}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground text-center">
                        {summary.avgPriority > 0 ? `${summary.avgPriority.toFixed(1)}/5` : '-'}
                      </div>
                      <div></div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Unscheduled Tasks */}
          {getUnscheduledTasks().length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/10 border-b cursor-pointer hover:bg-muted/20 transition-colors min-w-[700px]">
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-muted-foreground">Unscheduled</span>
                  <Badge variant="secondary" className="text-xs">
                    {getUnscheduledTasks().length} tasks
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {getUnscheduledTasks().map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[1fr_80px_100px_120px_60px_80px_40px] gap-2 px-4 py-2 border-b border-border/50 items-center hover:bg-muted/30 transition-colors min-w-[700px]"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={task.title}
                        onChange={(e) => updateTask.mutate({ id: task.id, updates: { title: e.target.value } })}
                        className="h-8 border-0 bg-transparent p-0 focus-visible:ring-0 text-sm"
                      />
                    </div>
                    <div className="flex justify-center">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(task.assignee_name || 'E').charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div>
                      <Select
                        value={task.status || 'todo'}
                        onValueChange={(value) => updateTask.mutate({ id: task.id, updates: { status: value, is_completed: value === 'done' } })}
                      >
                        <SelectTrigger className={`h-7 text-xs border-0 ${statusConfig[task.status || 'todo']?.bg} ${statusConfig[task.status || 'todo']?.text}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key} className="text-xs">
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-muted-foreground">Not set</div>
                    <div>
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
                    <div className="flex justify-center">
                      <Select
                        value={task.priority || '3'}
                        onValueChange={(value) => updateTask.mutate({ id: task.id, updates: { priority: value } })}
                      >
                        <SelectTrigger className="h-7 w-auto border-0 bg-transparent p-0 focus-visible:ring-0">
                          {renderPriorityStars(task.priority)}
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((p) => (
                            <SelectItem key={p} value={p.toString()}>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-3 w-3 ${star <= p ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                                  />
                                ))}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteTask.mutate(task.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
