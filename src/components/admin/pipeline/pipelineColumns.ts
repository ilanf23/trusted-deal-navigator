import {
  Landmark,
  User,
  DollarSign,
  CheckSquare,
  Tag,
  Sparkles,
  Clock,
  CalendarDays,
  MessageSquare,
  Moon,
} from 'lucide-react';
import type { ColumnHeaderDef } from '@/components/admin/columnDragOverlay';

/**
 * Column keys shared across the pipeline-style tables (Underwriting,
 * Potential, LenderManagement). Body cells live in `PipelineTableRow`.
 */
export type PipelineColumnKey =
  | 'company'
  | 'contact'
  | 'value'
  | 'ownedBy'
  | 'tasks'
  | 'status'
  | 'stage'
  | 'daysInStage'
  | 'stageUpdated'
  | 'lastContacted'
  | 'interactions'
  | 'inactiveDays'
  | 'tags';

/** Default left-to-right order. Per-user runtime order persisted via `useColumnOrder`. */
export const PIPELINE_REORDERABLE_COLUMNS: PipelineColumnKey[] = [
  'company',
  'contact',
  'value',
  'ownedBy',
  'tasks',
  'status',
  'stage',
  'daysInStage',
  'stageUpdated',
  'lastContacted',
  'interactions',
  'inactiveDays',
  'tags',
];

export const PIPELINE_COLUMN_HEADERS: Record<PipelineColumnKey, ColumnHeaderDef> = {
  company:       { icon: Landmark,      label: 'Company' },
  contact:       { icon: User,          label: 'Contact' },
  value:         { icon: DollarSign,    label: 'Value' },
  ownedBy:       { icon: User,          label: 'Owner' },
  tasks:         { icon: CheckSquare,   label: 'Tasks' },
  status:        { icon: Tag,           label: 'Status' },
  stage:         { icon: Sparkles,      label: 'Stage' },
  daysInStage:   { icon: Clock,         label: 'Days' },
  stageUpdated:  { icon: CalendarDays,  label: 'Updated' },
  lastContacted: { icon: CalendarDays,  label: 'Contacted' },
  interactions:  { icon: MessageSquare, label: 'Activity' },
  inactiveDays:  { icon: Moon,          label: 'Dormant' },
  tags:          { icon: Tag,           label: 'Tags' },
};
