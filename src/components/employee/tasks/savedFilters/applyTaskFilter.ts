import type { Task } from '../types';
import type { TaskFilterCriteria, DateRangeCriterion } from './types';

const startOfDay = (d: Date) => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
};

const endOfDay = (d: Date) => {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
};

const matchesDueDate = (taskDue: string | null, range: DateRangeCriterion): boolean => {
  if (range.preset === 'no_date') return !taskDue;
  if (!taskDue) return false;
  const due = new Date(taskDue);
  if (Number.isNaN(due.getTime())) return false;

  const today = startOfDay(new Date());
  const tomorrow = startOfDay(new Date(today.getTime() + 24 * 60 * 60 * 1000));

  if (range.preset === 'today') {
    return due >= today && due <= endOfDay(today);
  }
  if (range.preset === 'tomorrow') {
    return due >= tomorrow && due <= endOfDay(tomorrow);
  }
  if (range.preset === 'this_week') {
    const dayOfWeek = today.getDay();
    const weekStart = startOfDay(new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000));
    const weekEnd = endOfDay(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000));
    return due >= weekStart && due <= weekEnd;
  }
  if (range.preset === 'overdue') {
    return due < today;
  }

  if (range.from) {
    const from = startOfDay(new Date(range.from));
    if (Number.isNaN(from.getTime()) || due < from) return false;
  }
  if (range.to) {
    const to = endOfDay(new Date(range.to));
    if (Number.isNaN(to.getTime()) || due > to) return false;
  }
  return true;
};

const matchesCreatedRange = (createdAt: string, range: DateRangeCriterion): boolean => {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  if (range.from) {
    const from = startOfDay(new Date(range.from));
    if (created < from) return false;
  }
  if (range.to) {
    const to = endOfDay(new Date(range.to));
    if (created > to) return false;
  }
  return true;
};

const arrayHas = (arr: string[] | undefined | null, value: string | null | undefined) => {
  if (!arr || arr.length === 0) return true;
  if (value == null) return false;
  return arr.includes(value);
};

const matchesStatus = (taskStatus: string | null, statuses: string[]) => {
  const effective = taskStatus || 'todo';
  if (statuses.includes('working') && effective === 'in_progress') return true;
  if (statuses.includes('in_progress') && effective === 'working') return true;
  return statuses.includes(effective);
};

const matchesSource = (taskSource: string | null, sources: string[]) => {
  const effective = taskSource || 'manual';
  if (sources.includes('gmail')) {
    if (effective === 'gmail' || effective === 'nudge') return true;
  }
  return sources.includes(effective);
};

export interface ApplyContext {
  /** users.id of the current viewer — required when criteria.assignedToMe is true */
  currentUserId?: string | null;
}

export const applyTaskFilter = (
  tasks: Task[],
  criteria: TaskFilterCriteria | null | undefined,
  ctx: ApplyContext = {},
): Task[] => {
  const c = criteria ?? {};

  let result = tasks;

  if (!c.includeCompleted) {
    result = result.filter(t => !t.is_completed && t.status !== 'done');
  }

  if (c.search && c.search.trim()) {
    const term = c.search.trim().toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(term) ||
      (t.description?.toLowerCase().includes(term) ?? false),
    );
  }

  if (c.status && c.status.length > 0) {
    result = result.filter(t => matchesStatus(t.status, c.status as string[]));
  }

  if (c.priority && c.priority.length > 0) {
    const wanted = c.priority;
    result = result.filter(t => wanted.includes(t.priority || 'none'));
  }

  if (c.source && c.source.length > 0) {
    result = result.filter(t => matchesSource(t.source, c.source as string[]));
  }

  if (c.taskType && c.taskType.length > 0) {
    result = result.filter(t => arrayHas(c.taskType, t.task_type));
  }

  if (c.assignedToMe) {
    if (!ctx.currentUserId) return [];
    result = result.filter(t => t.user_id === ctx.currentUserId);
  }

  if (c.assignedUserIds && c.assignedUserIds.length > 0) {
    const wanted = c.assignedUserIds;
    result = result.filter(t => t.user_id != null && wanted.includes(t.user_id));
  }

  if (c.leadIds && c.leadIds.length > 0) {
    const wanted = c.leadIds;
    result = result.filter(t => t.lead_id != null && wanted.includes(t.lead_id));
  }

  if (c.tags && c.tags.length > 0) {
    const wanted = c.tags;
    result = result.filter(t => {
      if (!t.tags || t.tags.length === 0) return false;
      return wanted.some(tag => t.tags!.includes(tag));
    });
  }

  if (c.groupName && c.groupName.length > 0) {
    const wanted = c.groupName;
    result = result.filter(t => t.group_name != null && wanted.includes(t.group_name));
  }

  if (c.dueDateRange) {
    result = result.filter(t => matchesDueDate(t.due_date, c.dueDateRange!));
  }

  if (c.createdRange) {
    result = result.filter(t => matchesCreatedRange(t.created_at, c.createdRange!));
  }

  if (c.estimatedHoursRange) {
    const { min, max } = c.estimatedHoursRange;
    result = result.filter(t => {
      const v = t.estimated_hours;
      if (v == null) return min == null && max == null;
      if (min != null && v < min) return false;
      if (max != null && v > max) return false;
      return true;
    });
  }

  return result;
};

/** Combine a saved baseline criteria with an override (e.g. live search box). Override wins. */
export const mergeCriteria = (
  base: TaskFilterCriteria | null | undefined,
  override: TaskFilterCriteria | null | undefined,
): TaskFilterCriteria => {
  return { ...(base ?? {}), ...(override ?? {}) };
};

/** Strip undefined / empty-array values so we save a tight criteria object. */
export const cleanCriteria = (c: TaskFilterCriteria): TaskFilterCriteria => {
  const out: TaskFilterCriteria = {};
  const set = <K extends keyof TaskFilterCriteria>(k: K, v: TaskFilterCriteria[K] | undefined) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v) && v.length === 0) return;
    if (typeof v === 'string' && v.trim() === '') return;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const empty = Object.values(v as Record<string, unknown>).every(x => x === undefined || x === null || x === '');
      if (empty) return;
    }
    (out as Record<string, unknown>)[k] = v;
  };
  set('search', c.search);
  set('status', c.status);
  set('priority', c.priority);
  set('source', c.source);
  set('taskType', c.taskType);
  set('assignedUserIds', c.assignedUserIds);
  if (c.assignedToMe) out.assignedToMe = true;
  set('leadIds', c.leadIds);
  set('tags', c.tags);
  set('groupName', c.groupName);
  set('dueDateRange', c.dueDateRange ?? undefined);
  set('createdRange', c.createdRange ?? undefined);
  set('estimatedHoursRange', c.estimatedHoursRange ?? undefined);
  if (c.includeCompleted) out.includeCompleted = true;
  return out;
};

/** Heuristic — true if a criteria object would actually narrow the task list. */
export const hasAnyCriterion = (c: TaskFilterCriteria | null | undefined): boolean => {
  if (!c) return false;
  return Object.values(cleanCriteria(c)).length > 0;
};
