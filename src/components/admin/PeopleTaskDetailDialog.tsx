import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
  CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  Circle,
  Trash2,
  Star,
} from 'lucide-react';

// ── Types ──

export interface LeadTask {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  user_id: string | null;
  task_type: string | null;
  created_by: string | null;
  completed_at: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

const activityTypeOptions = [
  { value: 'to_do', label: 'To Do' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'follow_up', label: 'Follow Up' },
] as const;

const priorityOptions = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

const priorityColors: Record<string, string> = {
  critical: '#f43f5e',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#10b981',
  none: '#94a3b8',
};

// ── Helpers ──

function combineDateAndTime(date: Date | undefined, time: string): string | undefined {
  if (!date) return undefined;
  if (!time) return date.toISOString();
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined.toISOString();
}

function extractTimeFromDate(isoString: string | null): string {
  if (!isoString) return '';
  try {
    const date = parseISO(isoString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (hours === 0 && minutes === 0) return '';
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function parseDateOnly(isoString: string | null): Date | undefined {
  if (!isoString) return undefined;
  try {
    return parseISO(isoString);
  } catch {
    return undefined;
  }
}

// ── Component ──

interface PeopleTaskDetailDialogProps {
  task: LeadTask | null;
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  teamMembers: { id: string; name: string }[];
  currentUserName?: string | null;
  initialTitle?: string;
  onSaved: () => void;
}

export const PeopleTaskDetailDialog = ({
  task,
  open,
  onClose,
  leadId,
  leadName,
  teamMembers,
  currentUserName,
  initialTitle,
  onSaved,
}: PeopleTaskDetailDialogProps) => {
  const queryClient = useQueryClient();
  const isEditMode = !!task;

  // Form state
  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState('to_do');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [dueTime, setDueTime] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [priority, setPriority] = useState('none');
  const [description, setDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate form on open
  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      return;
    }
    if (task) {
      setTitle(task.title);
      setActivityType(task.task_type || 'to_do');
      setDueDate(parseDateOnly(task.due_date));
      setDueTime(extractTimeFromDate(task.due_date));
      setAssignedTo(task.user_id || '');
      setPriority(task.priority || 'none');
      setDescription(task.description || '');
    } else {
      setTitle(initialTitle || '');
      setActivityType('to_do');
      setDueDate(undefined);
      setDueTime('');
      setAssignedTo('');
      setPriority('none');
      setDescription('');
    }
  }, [open, task, initialTitle]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['person-tasks'] });
    onSaved();
  }, [queryClient, onSaved]);

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tasks').insert({
        lead_id: leadId,
        title: title.trim(),
        description: description.trim() || null,
        task_type: activityType,
        due_date: combineDateAndTime(dueDate, dueTime) || null,
        user_id: assignedTo || null,
        priority,
        status: 'todo',
        source: 'lead',
        created_by: currentUserName || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Task created');
      invalidate();
      onClose();
    },
    onError: () => toast.error('Failed to create task'),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!task) return;
      const { error } = await supabase
        .from('tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: () => toast.error('Failed to update task'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Task deleted');
      invalidate();
      onClose();
    },
    onError: () => toast.error('Failed to delete task'),
  });

  // ── Edit-mode field save handlers ──

  const saveField = useCallback((field: string, value: unknown) => {
    if (!task) return;
    updateMutation.mutate({ [field]: value });
  }, [task, updateMutation]);

  const handleTitleBlur = useCallback(() => {
    if (task && title.trim() && title.trim() !== task.title) {
      saveField('title', title.trim());
    }
  }, [task, title, saveField]);

  const handleDescriptionBlur = useCallback(() => {
    if (task && (description || '') !== (task.description || '')) {
      saveField('description', description.trim() || null);
    }
  }, [task, description, saveField]);

  const handleActivityTypeChange = useCallback((val: string) => {
    setActivityType(val);
    if (task) saveField('task_type', val);
  }, [task, saveField]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setDueDate(date);
    if (task) {
      const combined = combineDateAndTime(date, dueTime);
      saveField('due_date', combined || null);
    }
  }, [task, dueTime, saveField]);

  const handleTimeChange = useCallback((time: string) => {
    setDueTime(time);
    if (task) {
      const combined = combineDateAndTime(dueDate, time);
      saveField('due_date', combined || null);
    }
  }, [task, dueDate, saveField]);

  const handleAssignedToChange = useCallback((val: string) => {
    const resolved = val === '__none__' ? '' : val;
    setAssignedTo(resolved);
    if (task) saveField('user_id', resolved || null);
  }, [task, saveField]);

  const handlePriorityChange = useCallback((val: string) => {
    setPriority(val);
    if (task) saveField('priority', val);
  }, [task, saveField]);

  const handleToggleComplete = useCallback(() => {
    if (!task) return;
    const isCompleting = !task.completed_at;
    updateMutation.mutate({
      completed_at: isCompleting ? new Date().toISOString() : null,
      is_completed: isCompleting,
      status: isCompleting ? 'done' : 'todo',
    });
  }, [task, updateMutation]);

  const handleCreate = useCallback(() => {
    if (!title.trim()) return;
    createMutation.mutate();
  }, [title, createMutation]);

  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      deleteMutation.mutate();
    } else {
      setConfirmDelete(true);
    }
  }, [confirmDelete, deleteMutation]);

  const handleClose = useCallback(() => {
    setConfirmDelete(false);
    onClose();
  }, [onClose]);

  // ── Render priority indicator ──
  const renderPriorityDots = (p: string) => {
    const levels = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const level = levels[p as keyof typeof levels] ?? 0;
    const color = priorityColors[p] || priorityColors.none;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-1.5 rounded-full transition-all"
            style={{
              height: i <= level ? 10 : 6,
              backgroundColor: i <= level ? color : color + '30',
            }}
          />
        ))}
      </div>
    );
  };

  const assignedMemberName = assignedTo
    ? teamMembers.find((m) => m.id === assignedTo)?.name || ''
    : '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border-muted-foreground/10 z-[100]">
        {/* ── Header ── */}
        <DialogHeader className="pb-4 border-b border-muted-foreground/10 flex-shrink-0">
          {isEditMode ? (
            <div className="flex items-center gap-3">
              <button onClick={handleToggleComplete} className="flex-shrink-0">
                {task!.completed_at ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground hover:text-emerald-500 transition-colors" />
                )}
              </button>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="text-lg font-semibold border-0 bg-transparent focus-visible:ring-0 p-0 h-auto"
              />
            </div>
          ) : (
            <DialogTitle className="text-xl font-semibold">Create Task</DialogTitle>
          )}
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto space-y-5 py-4 px-1">
          {/* Title (create mode only) */}
          {!isEditMode && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task name..."
                className="h-11 rounded-lg text-lg font-medium"
                autoFocus
              />
            </div>
          )}

          {/* Activity Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Activity Type
            </label>
            <Select value={activityType} onValueChange={handleActivityTypeChange}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {activityTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Related To */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Related To
            </label>
            <div className="flex items-center gap-2.5 px-3 py-2 bg-muted/50 rounded-lg">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {leadName.split(' ').map(n => n[0]?.toUpperCase()).join('').slice(0, 2)}
              </div>
              <span className="text-sm font-medium text-foreground">{leadName}</span>
            </div>
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="h-3 w-3" /> Due Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start h-10 rounded-lg font-normal">
                    {dueDate ? format(dueDate, 'M/d/yyyy') : <span className="text-muted-foreground">Select date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl pointer-events-auto z-[200]" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                  {dueDate && (
                    <div className="px-3 pb-3">
                      <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => handleDateSelect(undefined)}>
                        Clear date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Time
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start h-10 rounded-lg font-normal">
                    {dueTime ? dueTime : <span className="text-muted-foreground">Add time</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 rounded-xl pointer-events-auto z-[200]" align="start">
                  <div className="space-y-3">
                    <Input
                      type="time"
                      value={dueTime}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      className="h-10 rounded-lg text-center font-medium"
                    />
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleTimeChange('')}>
                        Clear
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs ml-auto" onClick={() => handleTimeChange('09:00')}>
                        9 AM
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleTimeChange('12:00')}>
                        12 PM
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleTimeChange('17:00')}>
                        5 PM
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3 w-3" /> Owner
            </label>
            <Select value={assignedTo || '__none__'} onValueChange={handleAssignedToChange}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue placeholder="Select owner">
                  {assignedMemberName || <span className="text-muted-foreground">Select owner</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">No owner</span>
                </SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Star className="h-3 w-3" /> Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handlePriorityChange(opt.value)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    priority === opt.value
                      ? 'ring-2 ring-offset-2 ring-offset-background'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  style={priority === opt.value ? {
                    '--tw-ring-color': priorityColors[opt.value],
                    backgroundColor: priorityColors[opt.value] + '15',
                    color: priorityColors[opt.value],
                  } as React.CSSProperties : {}}
                >
                  {renderPriorityDots(opt.value)}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add Description"
              className="min-h-[100px] rounded-lg resize-none"
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-3 pt-4 border-t border-muted-foreground/10">
          {isEditMode ? (
            <>
              <Button
                variant={confirmDelete ? 'destructive' : 'ghost'}
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {confirmDelete ? 'Confirm Delete' : 'Delete'}
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={handleClose} className="rounded-lg">
                Close
              </Button>
            </>
          ) : (
            <>
              <div className="flex-1" />
              <Button variant="outline" onClick={handleClose} className="rounded-lg">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!title.trim() || createMutation.isPending}
                className="rounded-lg"
              >
                Create Task
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
