export interface Task {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  estimated_hours: number | null;
  assignee_name: string | null;
  group_name: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

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

export const statusConfig: Record<string, { label: string; bg: string; text: string; color: string }> = {
  todo: { label: "To Do", bg: 'bg-[#579bfc]', text: 'text-white', color: '#579bfc' },
  working: { label: 'Working on it', bg: 'bg-[#ff158a]', text: 'text-white', color: '#ff158a' },
  stuck: { label: 'Stuck', bg: 'bg-[#e2445c]', text: 'text-white', color: '#e2445c' },
  done: { label: 'Done', bg: 'bg-[#00c875]', text: 'text-white', color: '#00c875' },
  review: { label: 'In Review', bg: 'bg-[#fdab3d]', text: 'text-white', color: '#fdab3d' },
  blocked: { label: 'Blocked', bg: 'bg-[#7f5347]', text: 'text-white', color: '#7f5347' },
};

export const priorityConfig: Record<string, { label: string; stars: number; color: string }> = {
  critical: { label: 'Critical', stars: 5, color: '#e2445c' },
  high: { label: 'High', stars: 4, color: '#fdab3d' },
  medium: { label: 'Medium', stars: 3, color: '#579bfc' },
  low: { label: 'Low', stars: 2, color: '#00c875' },
  none: { label: 'None', stars: 1, color: '#c4c4c4' },
};

export const groupColors: Record<string, string> = {
  'To Do': '#579bfc',
  'In Progress': '#ff158a',
  'Done': '#00c875',
  'Blocked': '#e2445c',
  'Review': '#fdab3d',
};
