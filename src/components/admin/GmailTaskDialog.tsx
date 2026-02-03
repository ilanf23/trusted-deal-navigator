import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { BorrowerSearchSelect } from '@/components/evan/tasks/BorrowerSearchSelect';
import { statusConfig, statusPickerOptions, TaskType, taskTypeConfig } from '@/components/evan/tasks/types';
import { format } from 'date-fns';
import { 
  CalendarIcon, 
  User, 
  Clock,
  Building2,
  Star,
  Phone,
  Mail
} from 'lucide-react';
import { toast } from 'sonner';

interface GmailTaskDialogProps {
  open: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialDescription?: string;
  initialLeadId?: string | null;
}

const priorityOptions = [
  { value: 'critical', label: 'Critical', stars: 5, color: '#f43f5e' },
  { value: 'high', label: 'High', stars: 4, color: '#f97316' },
  { value: 'medium', label: 'Medium', stars: 3, color: '#3b82f6' },
  { value: 'low', label: 'Low', stars: 2, color: '#10b981' },
  { value: 'none', label: 'None', stars: 1, color: '#94a3b8' },
];

export const GmailTaskDialog = ({
  open,
  onClose,
  initialTitle = '',
  initialDescription = '',
  initialLeadId = null,
}: GmailTaskDialogProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState<string | null>(null);
  const [assignee, setAssignee] = useState('Evan');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [leadId, setLeadId] = useState<string | null>(initialLeadId);
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<TaskType>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens with new values
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription(initialDescription);
      setLeadId(initialLeadId);
      setStatus('todo');
      setPriority(null);
      setAssignee('Evan');
      setDueDate(undefined);
      setEstimatedHours(null);
      setGroupName(null);
      setTaskType('email');
    }
  }, [open, initialTitle, initialDescription, initialLeadId]);

  // Fetch leads for the customer dropdown
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, company_name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing groups for suggestions
  const { data: existingGroups = [] } = useQuery({
    queryKey: ['task-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('group_name')
        .not('group_name', 'is', null);
      if (error) throw error;
      const uniqueGroups = [...new Set(data.map(t => t.group_name).filter(Boolean))];
      return uniqueGroups as string[];
    },
  });

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority(null);
    setAssignee('Evan');
    setDueDate(undefined);
    setLeadId(null);
    setEstimatedHours(null);
    setGroupName(null);
    setTaskType('email');
    onClose();
  };

  const handleCreate = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('evan_tasks').insert({
        title: title.trim(),
        description: description || null,
        status,
        priority,
        assignee_name: assignee || null,
        due_date: dueDate?.toISOString() || null,
        lead_id: leadId || null,
        estimated_hours: estimatedHours,
        group_name: groupName,
        source: 'gmail',
        is_completed: status === 'done',
        task_type: taskType,
      });

      if (error) throw error;

      toast.success('Task created successfully');
      handleClose();
    } catch (error: any) {
      toast.error('Failed to create task: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl border-muted-foreground/10">
        <DialogHeader className="pb-4 border-b border-muted-foreground/10">
          <DialogTitle className="text-xl font-semibold">Create Task from Email</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-4">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Task Name *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="h-11 rounded-lg text-lg font-medium"
              autoFocus
            />
          </div>

          {/* Description / Notes */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Notes / Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or description..."
              className="min-h-[100px] rounded-lg resize-none"
            />
          </div>

          {/* Two column layout for compact fields */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </label>
              <div className="flex flex-wrap gap-1.5">
                {statusPickerOptions.map((key) => {
                  const config = statusConfig[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setStatus(key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                        status === key 
                          ? `${config.bg} ${config.text} ring-2 ring-offset-1 ring-offset-background`
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                      style={status === key ? { '--tw-ring-color': config.color } as React.CSSProperties : {}}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Star className="h-3 w-3" /> Priority
              </label>
              <div className="flex flex-wrap gap-1.5">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(priority === opt.value ? null : opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                      priority === opt.value 
                        ? 'ring-2 ring-offset-1 ring-offset-background'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                    style={priority === opt.value ? { 
                      '--tw-ring-color': opt.color,
                      backgroundColor: opt.color + '20',
                      color: opt.color
                    } as React.CSSProperties : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Assignee
            </label>
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 ring-2 ring-background">
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-medium">
                  {(assignee || 'E').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="max-w-[180px] h-9 rounded-lg"
                placeholder="Assignee name"
              />
            </div>
          </div>

          {/* Related Customer */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> Related Borrower
            </label>
            <BorrowerSearchSelect
              leads={leads}
              value={leadId}
              onValueChange={setLeadId}
              placeholder="Search borrowers..."
            />
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Task Type
            </label>
            <div className="flex flex-wrap gap-2">
              {(['call', 'email', 'internal'] as TaskType[]).map((type) => {
                const config = taskTypeConfig[type];
                const IconComponent = type === 'call' ? Phone : type === 'email' ? Mail : User;
                return (
                  <button
                    key={type}
                    onClick={() => setTaskType(type)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      taskType === type 
                        ? 'ring-2 ring-offset-1 ring-offset-background'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                    style={taskType === type ? { 
                      '--tw-ring-color': config.color,
                      backgroundColor: config.color + '20',
                      color: config.color
                    } as React.CSSProperties : {}}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    {config.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {taskType === 'call' && 'Creates a shortcut to call the borrower'}
              {taskType === 'email' && 'Creates a shortcut to email the borrower'}
              {taskType === 'internal' && 'Internal task with no client communication'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Due Date */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" /> Due Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start h-9 rounded-lg font-normal w-full">
                    {dueDate ? format(dueDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Estimated Hours */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> Estimated Hours
              </label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={estimatedHours || ''}
                onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || null)}
                className="h-9 rounded-lg"
                placeholder="Hours"
              />
            </div>
          </div>

          {/* Group */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Group (optional)
            </label>
            <Input
              value={groupName || ''}
              onChange={(e) => setGroupName(e.target.value || null)}
              className="h-9 rounded-lg"
              placeholder="e.g., Follow-ups, Q1 Tasks..."
              list="group-suggestions"
            />
            {existingGroups.length > 0 && (
              <datalist id="group-suggestions">
                {existingGroups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-muted-foreground/10">
          <Button variant="outline" onClick={handleClose} className="rounded-lg">
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!title.trim() || isSubmitting}
            className="rounded-lg"
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
