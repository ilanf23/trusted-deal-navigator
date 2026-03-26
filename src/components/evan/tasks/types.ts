export type TaskType = 'call' | 'email' | 'internal';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  estimated_hours: number | null;
  team_member_id: string | null;
  group_name: string | null;
  tags: string[] | null;
  lead_id: string | null;
  source: string | null;
  task_type: TaskType | null;
  lead?: {
    id: string;
    name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export const taskTypeConfig: Record<TaskType, { label: string; icon: string; color: string }> = {
  call: { label: 'Call', icon: 'Phone', color: '#10b981' },
  email: { label: 'Email', icon: 'Mail', color: '#3b82f6' },
  internal: { label: 'Internal', icon: 'User', color: '#64748b' },
};

export type TaskSource = 'all' | 'manual' | 'gmail' | 'nudge' | 'lead';

export const sourceConfig: Record<string, { label: string; icon: string }> = {
  manual: { label: 'Self-Made', icon: 'User' },
  gmail: { label: 'Gmail', icon: 'Mail' },
  nudge: { label: '7-Day Follow Up', icon: 'Bell' },
  lead: { label: 'From Lead', icon: 'Users' },
};

export interface TaskActivity {
  id: string;
  task_id: string;
  activity_type: string;
  content: string | null;
  old_value: string | null;
  new_value: string | null;
  created_by: string | null;
  mentioned_users: string[] | null;
  created_at: string;
}

export interface TaskFile {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export type ViewMode = 'table' | 'kanban' | 'calendar' | 'timeline';

// Apple-inspired muted, elegant status colors
const inProgressConfig = { label: 'In Progress', bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', color: '#3b82f6' };

export const statusConfig: Record<string, { label: string; bg: string; text: string; color: string }> = {
  todo: { label: "To Do", bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', color: '#64748b' },
  working: inProgressConfig,
  in_progress: inProgressConfig, // Alias for database compatibility
  stuck: { label: 'Stuck', bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', color: '#f59e0b' },
  done: { label: 'Complete', bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', color: '#10b981' },
  review: { label: 'Review', bg: 'bg-violet-50 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300', color: '#8b5cf6' },
  blocked: { label: 'Blocked', bg: 'bg-rose-50 dark:bg-rose-950', text: 'text-rose-700 dark:text-rose-300', color: '#f43f5e' },
};

// Statuses for UI pickers (excludes the in_progress alias to prevent duplicates)
export const statusPickerOptions = ['todo', 'working', 'stuck', 'done', 'review', 'blocked'] as const;

export const priorityConfig: Record<string, { label: string; stars: number; color: string }> = {
  critical: { label: 'Critical', stars: 5, color: '#f43f5e' },
  high: { label: 'High', stars: 4, color: '#f97316' },
  medium: { label: 'Medium', stars: 3, color: '#3b82f6' },
  low: { label: 'Low', stars: 2, color: '#10b981' },
  none: { label: 'None', stars: 1, color: '#94a3b8' },
};

export const groupColors: Record<string, string> = {
  'To Do': '#64748b',
  'In Progress': '#3b82f6',
  'Done': '#10b981',
  'Blocked': '#f43f5e',
  'Review': '#8b5cf6',
};
