import type { Task } from '../types';

export type FilterVisibility = 'public' | 'private';

export type DueDatePreset = 'today' | 'tomorrow' | 'this_week' | 'overdue' | 'no_date';

export interface DateRangeCriterion {
  preset?: DueDatePreset;
  from?: string;
  to?: string;
}

export interface NumberRangeCriterion {
  min?: number;
  max?: number;
}

export interface TaskFilterCriteria {
  search?: string;
  status?: string[];
  priority?: string[];
  source?: string[];
  taskType?: string[];
  assignedUserIds?: string[];
  assignedToMe?: boolean;
  leadIds?: string[];
  tags?: string[];
  groupName?: string[];
  dueDateRange?: DateRangeCriterion | null;
  createdRange?: DateRangeCriterion | null;
  estimatedHoursRange?: NumberRangeCriterion | null;
  includeCompleted?: boolean;
}

export interface SavedTaskFilter {
  id: string;
  name: string;
  description: string | null;
  visibility: FilterVisibility;
  criteria: TaskFilterCriteria;
  createdBy: string | null;
  createdByName?: string | null;
  position: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SavedTaskFilterInput {
  name: string;
  description?: string | null;
  visibility: FilterVisibility;
  criteria: TaskFilterCriteria;
}

export type FilteredTaskWithLead = Task;
