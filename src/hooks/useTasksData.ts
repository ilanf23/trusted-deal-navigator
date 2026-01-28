import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskActivity } from '@/components/evan/tasks/types';
import { toast } from 'sonner';

export const useTasksData = () => {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['evan-tasks-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('*, lead:leads(id, name, company_name)')
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const addTask = useMutation({
    mutationFn: async (task: Partial<Task>) => {
      const { data, error } = await supabase.from('evan_tasks').insert({
        title: task.title || 'New Task',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        assignee_name: task.assignee_name || 'Evan',
        due_date: task.due_date,
        group_name: task.group_name || 'To Do',
        estimated_hours: task.estimated_hours,
        description: task.description,
        tags: task.tags,
        lead_id: task.lead_id,
        source: task.source || 'manual',
      }).select('*, lead:leads(id, name, company_name)').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      toast.success('Task added');
    },
    onError: () => toast.error('Failed to add task'),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates, logActivity = true }: { id: string; updates: Partial<Task>; logActivity?: boolean }) => {
      const { error } = await supabase.from('evan_tasks').update(updates).eq('id', id);
      if (error) throw error;
      
      // Log activity for status changes
      if (logActivity && updates.status) {
        await supabase.from('evan_task_activities').insert({
          task_id: id,
          activity_type: 'status_change',
          old_value: '',
          new_value: updates.status,
          created_by: 'Evan',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      queryClient.invalidateQueries({ queryKey: ['evan-task-activities'] });
    },
    onError: () => toast.error('Failed to update task'),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('evan_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      toast.success('Task deleted');
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const addComment = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      const { error } = await supabase.from('evan_task_activities').insert({
        task_id: taskId,
        activity_type: 'comment',
        content,
        created_by: 'Evan',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-task-activities'] });
      toast.success('Comment added');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  return {
    tasks,
    isLoading,
    addTask,
    updateTask,
    deleteTask,
    addComment,
  };
};

export const useTaskActivities = (taskId: string | null) => {
  return useQuery({
    queryKey: ['evan-task-activities', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('evan_task_activities')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TaskActivity[];
    },
    enabled: !!taskId,
  });
};
