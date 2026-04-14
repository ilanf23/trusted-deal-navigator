import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Pencil, Trash2, Phone, Video, Users, Clock, CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Appointment, TaskItem } from '@/hooks/useCalendarData';

const EVENT_TYPE_META: Record<string, { label: string; icon: typeof Phone }> = {
  call: { label: 'Phone Call', icon: Phone },
  video: { label: 'Video Call', icon: Video },
  meeting: { label: 'In-Person Meeting', icon: Users },
  imported: { label: 'Imported Event', icon: RefreshCw },
};

export interface EventDetailData {
  type: 'appointment' | 'task';
  appointment?: Appointment;
  task?: TaskItem;
  position: { top: number; left: number };
}

interface EventDetailPopoverProps {
  data: EventDetailData;
  onEdit: (appointment: Appointment) => void;
  onDelete: (appointmentId: string) => void;
  onClose: () => void;
}

export function EventDetailPopover({ data, onEdit, onDelete, onClose }: EventDetailPopoverProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const popoverWidth = 320;
  const popoverHeight = 280;
  const padding = 12;
  const clampedLeft = Math.max(padding, Math.min(data.position.left, window.innerWidth - popoverWidth - padding));
  const clampedTop = Math.max(padding, Math.min(data.position.top, window.innerHeight - popoverHeight - padding));

  if (data.type === 'task' && data.task) {
    return renderTaskDetail(data.task, { top: clampedTop, left: clampedLeft }, containerRef, onClose);
  }

  if (data.type === 'appointment' && data.appointment) {
    return renderAppointmentDetail(
      data.appointment,
      { top: clampedTop, left: clampedLeft },
      containerRef,
      onEdit,
      onDelete,
      confirmDelete,
      setConfirmDelete,
      onClose
    );
  }

  return null;
}

function renderAppointmentDetail(
  apt: Appointment,
  position: { top: number; left: number },
  containerRef: React.RefObject<HTMLDivElement | null>,
  onEdit: (appointment: Appointment) => void,
  onDelete: (appointmentId: string) => void,
  confirmDelete: boolean,
  setConfirmDelete: (v: boolean) => void,
  onClose: () => void
) {
  const start = new Date(apt.start_time);
  const end = apt.end_time ? new Date(apt.end_time) : null;
  const typeMeta = EVENT_TYPE_META[apt.appointment_type ?? ''] ?? { label: 'Event', icon: Clock };
  const TypeIcon = typeMeta.icon;

  const isSynced = !!apt.google_event_id;
  const isReadOnly = apt.appointment_type === 'imported';

  const timeLabel = end
    ? `${format(start, 'EEE, MMM d · h:mm a')} – ${format(end, 'h:mm a')}`
    : format(start, 'EEE, MMM d · h:mm a');

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-[320px] bg-popover border border-border rounded-lg shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-start justify-between px-4 pt-3 pb-1">
        <h3 className="text-sm font-semibold leading-tight pr-2 line-clamp-2">{apt.title}</h3>
        <div className="flex items-center gap-0.5 shrink-0">
          {!isReadOnly && (
            <>
              <button
                onClick={() => onEdit(apt)}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-destructive/10 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 space-y-2.5">
        <p className="text-xs text-muted-foreground">{timeLabel}</p>

        <div className="flex items-center gap-2">
          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{typeMeta.label}</span>
        </div>

        {apt.description && (
          <p className="text-xs text-foreground/80 whitespace-pre-wrap line-clamp-3">{apt.description}</p>
        )}

        {isSynced && (
          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3 text-green-600" />
            <span className="text-[11px] text-green-600 font-medium">Synced to Google Calendar</span>
          </div>
        )}

        {!isSynced && apt.appointment_type !== 'imported' && (
          <div className="flex items-center gap-1.5">
            <CloudOff className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground/60">Not synced</span>
          </div>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <span className="text-xs text-destructive">Delete this event?</span>
            <div className="ml-auto flex gap-1.5">
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => {
                  onDelete(apt.id);
                  onClose();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderTaskDetail(
  task: TaskItem,
  position: { top: number; left: number },
  containerRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void
) {
  const dueDate = new Date(task.due_date);
  const hasTime = task.due_date.includes('T') && !task.due_date.endsWith('T00:00:00');

  const dateLabel = hasTime
    ? format(dueDate, 'EEE, MMM d · h:mm a')
    : format(dueDate, 'EEEE, MMMM d');

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-[300px] bg-popover border border-border rounded-lg shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-start justify-between px-4 pt-3 pb-1">
        <h3 className="text-sm font-semibold leading-tight pr-2 line-clamp-2">{task.title}</h3>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-accent transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="px-4 pb-3 space-y-2">
        <p className="text-xs text-muted-foreground">{dateLabel}</p>

        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${task.is_completed ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
          <span className="text-xs text-muted-foreground">
            {task.is_completed ? 'Completed' : task.status ?? 'To-Do'}
          </span>
          {task.priority && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {task.priority}
            </span>
          )}
        </div>

        {task.lead && (
          <p className="text-xs text-muted-foreground">
            {task.lead.name}
            {task.lead.company_name ? ` · ${task.lead.company_name}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
