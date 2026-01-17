import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
  priority: string | null;
  created_at: string;
}

export const EvanTasksWidget = () => {
  const [newTask, setNewTask] = useState('');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['evan-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('*')
        .order('is_completed', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase
        .from('evan_tasks')
        .insert({ title });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks'] });
      setNewTask('');
      toast.success('Task added');
    },
    onError: () => toast.error('Failed to add task'),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from('evan_tasks')
        .update({ is_completed })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['evan-tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('evan_tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks'] });
      toast.success('Task deleted');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      addTask.mutate(newTask.trim());
    }
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-destructive text-destructive-foreground',
    medium: 'bg-yellow-500/20 text-yellow-700',
    low: 'bg-muted text-muted-foreground',
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListTodo className="h-5 w-5 text-primary" />
          Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newTask.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">No tasks yet</div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  task.is_completed ? 'bg-muted/50 opacity-60' : 'bg-card hover:bg-accent/50'
                }`}
              >
                <Checkbox
                  checked={task.is_completed}
                  onCheckedChange={(checked) =>
                    toggleTask.mutate({ id: task.id, is_completed: !!checked })
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${task.is_completed ? 'line-through' : ''}`}>
                    {task.title}
                  </p>
                  {task.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                {task.priority && (
                  <Badge variant="secondary" className={priorityColors[task.priority] || ''}>
                    {task.priority}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteTask.mutate(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
