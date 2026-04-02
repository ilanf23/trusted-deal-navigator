import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskActivity } from '@/components/employee/tasks/types';
import { toast } from 'sonner';
import { useUndo } from '@/contexts/UndoContext';

export const useTasksData = () => {
  const queryClient = useQueryClient();
  const { registerUndo } = useUndo();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['evan-tasks-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, lead:leads(id, name, company_name, email, phone)')
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const addTask = useMutation({
    mutationFn: async (task: Partial<Task>) => {
      const { data, error } = await supabase.from('tasks').insert({
        title: task.title || 'New Task',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        team_member_id: (task as any).team_member_id || '5e2d8710-7a23-4c33-87a2-4ad9ced4e936',
        due_date: task.due_date,
        group_name: task.group_name || 'To Do',
        estimated_hours: task.estimated_hours,
        description: task.description,
        tags: task.tags,
        lead_id: task.lead_id,
        source: task.source || 'manual',
        task_type: task.task_type || 'internal',
      }).select('*, lead:leads(id, name, company_name, email, phone)').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      toast.success('Task added');
      
      // Register undo for task creation
      if (data) {
        registerUndo({
          label: `Created task "${data.title}"`,
          execute: async () => {
            const { error } = await supabase.from('tasks').delete().eq('id', data.id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
          },
        });
      }
    },
    onError: () => toast.error('Failed to add task'),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates, logActivity = true, skipUndo = false }: { id: string; updates: Partial<Task>; logActivity?: boolean; skipUndo?: boolean }) => {
      // Get current task data for undo
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
      
      // Log activity for status changes
      if (logActivity && updates.status) {
        await supabase.from('task_activities').insert({
          task_id: id,
          activity_type: 'status_change',
          old_value: currentTask?.status || '',
          new_value: updates.status,
          created_by: 'System',
        });
      }
      
      return { currentTask, updates, skipUndo };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      queryClient.invalidateQueries({ queryKey: ['evan-task-activities'] });
      
      // Register undo for task update
      if (result?.currentTask && !result.skipUndo) {
        const taskTitle = result.currentTask.title || 'Task';
        const updateKeys = Object.keys(result.updates);
        const label = updateKeys.includes('status') 
          ? `Updated "${taskTitle}" status`
          : `Updated "${taskTitle}"`;
        
        registerUndo({
          label,
          execute: async () => {
            const { error } = await supabase.from('tasks').update({
              status: result.currentTask.status,
              priority: result.currentTask.priority,
              due_date: result.currentTask.due_date,
              team_member_id: result.currentTask.team_member_id,
              description: result.currentTask.description,
              title: result.currentTask.title,
            }).eq('id', result.currentTask.id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
          },
        });
      }
    },
    onError: () => toast.error('Failed to update task'),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      // Get task data before deleting for undo
      const { data: taskToDelete } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      
      return taskToDelete;
    },
    onSuccess: (deletedTask) => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      toast.success('Task deleted');
      
      // Register undo for task deletion
      if (deletedTask) {
        registerUndo({
          label: `Deleted "${deletedTask.title}"`,
          execute: async () => {
            // Restore the deleted task
            const { error } = await supabase.from('tasks').insert({
              id: deletedTask.id,
              title: deletedTask.title,
              status: deletedTask.status,
              priority: deletedTask.priority,
              team_member_id: deletedTask.team_member_id,
              due_date: deletedTask.due_date,
              group_name: deletedTask.group_name,
              estimated_hours: deletedTask.estimated_hours,
              description: deletedTask.description,
              tags: deletedTask.tags,
              lead_id: deletedTask.lead_id,
              source: deletedTask.source,
              is_completed: deletedTask.is_completed,
              task_type: deletedTask.task_type,
            });
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
          },
        });
      }
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const addComment = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      const { data, error } = await supabase.from('task_activities').insert({
        task_id: taskId,
        activity_type: 'comment',
        content,
        created_by: 'System',
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evan-task-activities'] });
      toast.success('Comment added');
      
      // Register undo for comment
      if (data) {
        registerUndo({
          label: 'Added comment',
          execute: async () => {
            const { error } = await supabase.from('task_activities').delete().eq('id', data.id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['evan-task-activities'] });
            toast.success('Comment removed');
          },
        });
      }
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
        .from('task_activities')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TaskActivity[];
    },
    enabled: !!taskId,
  });
};
