import { useState, useEffect } from 'react';
import { useEvanUIState } from '@/contexts/EvanUIStateContext';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Task, TaskActivity, TaskType, statusConfig, statusPickerOptions, priorityConfig, taskTypeConfig } from './types';
import { useTaskActivities } from '@/hooks/useTasksData';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BorrowerSearchSelect } from './BorrowerSearchSelect';
import { format, parseISO } from 'date-fns';
import { 
  MessageSquare, 
  Clock, 
  Send, 
  CalendarIcon, 
  User, 
  History,
  CheckCircle2,
  Circle,
  Building2,
  Star,
  Mail,
  Users,
  FileText,
  ExternalLink,
  Phone
} from 'lucide-react';

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onAddComment: (taskId: string, content: string) => void;
  onCreateTask?: (task: Partial<Task>) => void;
  isNewTask?: boolean;
  onComposeEmail?: (leadId: string | null, template?: string) => void;
}

export const TaskDetailDialog = ({
  task,
  open,
  onClose,
  onUpdateTask,
  onAddComment,
  onCreateTask,
  isNewTask = false,
  onComposeEmail,
}: TaskDetailDialogProps) => {
  const navigate = useNavigate();
  const { getPageState, setPageState } = useEvanUIState();
  const [newComment, setNewComment] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  
  // New task form state - restore from persisted context
  const persistedForm = getPageState('newTaskForm', {
    title: '', description: '', status: 'todo', assignee: 'Evan',
    dueDate: undefined as string | undefined, dueTime: '', leadId: null as string | null,
    hours: null as number | null, priority: 'medium', taskType: 'internal' as TaskType,
  });

  const [newTaskTitle, setNewTaskTitle] = useState(isNewTask ? persistedForm.title : '');
  const [newTaskDescription, setNewTaskDescription] = useState(isNewTask ? persistedForm.description : '');
  const [newTaskStatus, setNewTaskStatus] = useState(isNewTask ? persistedForm.status : 'todo');
  const [newTaskAssignee, setNewTaskAssignee] = useState(isNewTask ? persistedForm.assignee : 'Evan');
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(isNewTask && persistedForm.dueDate ? new Date(persistedForm.dueDate) : undefined);
  const [newTaskDueTime, setNewTaskDueTime] = useState<string>(isNewTask ? persistedForm.dueTime : '');
  const [newTaskLeadId, setNewTaskLeadId] = useState<string | null>(isNewTask ? persistedForm.leadId : null);
  const [newTaskHours, setNewTaskHours] = useState<number | null>(isNewTask ? persistedForm.hours : null);
  const [newTaskPriority, setNewTaskPriority] = useState<string>(isNewTask ? persistedForm.priority : 'medium');
  const [newTaskType, setNewTaskType] = useState<TaskType>(isNewTask ? persistedForm.taskType : 'internal');

  // Persist new task form state on every change
  useEffect(() => {
    if (isNewTask && open) {
      setPageState('newTaskForm', {
        title: newTaskTitle, description: newTaskDescription, status: newTaskStatus,
        assignee: newTaskAssignee, dueDate: newTaskDueDate?.toISOString(), dueTime: newTaskDueTime,
        leadId: newTaskLeadId, hours: newTaskHours, priority: newTaskPriority, taskType: newTaskType,
      });
    }
  }, [isNewTask, open, newTaskTitle, newTaskDescription, newTaskStatus, newTaskAssignee, newTaskDueDate, newTaskDueTime, newTaskLeadId, newTaskHours, newTaskPriority, newTaskType, setPageState]);
  
  const { data: activities = [] } = useTaskActivities(task?.id || null);
  
  const priorityOptions = ['none', 'low', 'medium', 'high', 'critical'] as const;

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

  // Reset new task form when dialog closes
  const handleClose = () => {
    if (isNewTask) {
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskStatus('todo');
      setNewTaskAssignee('Evan');
      setNewTaskDueDate(undefined);
      setNewTaskDueTime('');
      setNewTaskLeadId(null);
      setNewTaskHours(null);
      setNewTaskPriority('medium');
      setNewTaskType('internal');
    }
    onClose();
  };

  // Combine date and time into ISO string
  const combineDateAndTime = (date: Date | undefined, time: string): string | undefined => {
    if (!date) return undefined;
    if (!time) return date.toISOString();
    
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  // Extract time from ISO string
  const extractTimeFromDate = (isoString: string | null): string => {
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
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    
    onCreateTask?.({
      title: newTaskTitle,
      description: newTaskDescription || undefined,
      status: newTaskStatus,
      team_member_id: '5e2d8710-7a23-4c33-87a2-4ad9ced4e936',
      due_date: combineDateAndTime(newTaskDueDate, newTaskDueTime),
      lead_id: newTaskLeadId || undefined,
      estimated_hours: newTaskHours || undefined,
      priority: newTaskPriority,
      source: 'manual',
      task_type: newTaskType,
    });
    
    // Clear persisted new task form
    setPageState('newTaskForm', {
      title: '', description: '', status: 'todo', assignee: 'Evan',
      dueDate: undefined, dueTime: '', leadId: null, hours: null, priority: 'medium', taskType: 'internal',
    });
  };
  
  // Priority bar renderer (matches list view)
  const renderPriorityIndicator = (priority: string) => {
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`w-1.5 rounded-full transition-all ${
              level <= Math.ceil(config.stars / 2) 
                ? 'h-3 bg-current opacity-100' 
                : 'h-2 bg-current opacity-20'
            }`}
            style={{ color: config.color }}
          />
        ))}
      </div>
    );
  };

  // Determine where to navigate based on task source and context
  const getNavigationInfo = (taskData: Task): { 
    path: string; 
    label: string; 
    icon: React.ReactNode;
    action?: 'compose' | 'view';
    template?: string;
  } | null => {
    const source = taskData.source?.toLowerCase() || '';
    const title = taskData.title?.toLowerCase() || '';
    const hasLead = taskData.lead_id || taskData.lead;
    
    // Closing docs / prepare closing - opens email with closing template
    if (title.includes('closing') || title.includes('prepare closing')) {
      return { 
        path: hasLead 
          ? `/admin/gmail?compose=true&leadId=${taskData.lead_id}&template=closing`
          : '/admin/gmail?compose=true&template=closing',
        label: 'Draft Closing Email', 
        icon: <FileText className="h-4 w-4" />,
        action: 'compose',
        template: 'closing'
      };
    }
    
    if (source === 'nudge' || title.includes('follow up') || title.includes('follow-up')) {
      return { 
        path: hasLead 
          ? `/admin/gmail?compose=true&leadId=${taskData.lead_id}&template=follow_up`
          : '/admin/gmail?compose=true&template=follow_up',
        label: 'Draft Follow-up Email', 
        icon: <Mail className="h-4 w-4" />,
        action: 'compose',
        template: 'follow_up'
      };
    }
    
    if (source === 'gmail' || title.includes('email') || title.includes('send')) {
      return { 
        path: hasLead 
          ? `/admin/gmail?compose=true&leadId=${taskData.lead_id}`
          : '/admin/gmail?compose=true',
        label: 'Compose Email', 
        icon: <Mail className="h-4 w-4" />,
        action: 'compose'
      };
    }
    
    if (source === 'lead' || hasLead) {
      return { 
        path: `/admin/pipeline?lead=${taskData.lead_id}&tab=lenders`, 
        label: 'View in CRM', 
        icon: <Users className="h-4 w-4" />,
        action: 'view'
      };
    }
    
    if (title.includes('document') || title.includes('doc') || title.includes('file')) {
      return { 
        path: '/admin/pipeline', 
        label: 'Go to Pipeline', 
        icon: <FileText className="h-4 w-4" />,
        action: 'view'
      };
    }
    
    // Default - no navigation available
    return null;
  };

  const handleNavigate = (navInfo: { path: string; action?: 'compose' | 'view'; template?: string }) => {
    // If it's a compose action and we have the callback, use it to open compose dialog inline
    if (navInfo.action === 'compose' && onComposeEmail) {
      // Close the task dialog first so the compose dialog is visible
      onClose();
      // Small delay to ensure dialog closes before opening compose
      setTimeout(() => {
        onComposeEmail(task?.lead_id || null, navInfo.template);
      }, 100);
    } else {
      // Otherwise navigate normally
      navigate(navInfo.path);
    }
  };

  // For existing task view
  if (!isNewTask && !task) return null;

  const handleSaveTitle = () => {
    if (editedTitle && editedTitle !== task!.title) {
      onUpdateTask(task!.id, { title: editedTitle });
    }
  };

  const handleSaveDescription = () => {
    if (editedDescription !== task!.description) {
      onUpdateTask(task!.id, { description: editedDescription });
    }
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      onAddComment(task!.id, newComment.trim());
      setNewComment('');
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      onUpdateTask(task!.id, { due_date: null });
      return;
    }
    // Preserve existing time if there was one
    const existingTime = extractTimeFromDate(task!.due_date);
    if (existingTime) {
      const [hours, minutes] = existingTime.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
    }
    onUpdateTask(task!.id, { due_date: date.toISOString() });
  };

  const handleTimeChange = (time: string) => {
    if (!task!.due_date) return;
    
    const existingDate = parseISO(task!.due_date);
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      existingDate.setHours(hours, minutes, 0, 0);
    } else {
      existingDate.setHours(0, 0, 0, 0);
    }
    onUpdateTask(task!.id, { due_date: existingDate.toISOString() });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare className="h-4 w-4" />;
      case 'status_change': return <History className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // New Task Creation View
  if (isNewTask) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border-muted-foreground/10 z-[100]">
          <DialogHeader className="pb-4 border-b border-muted-foreground/10 flex-shrink-0">
            <DialogTitle className="text-xl font-semibold">Create New Task</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4 px-1">
            {/* Title */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Task Name *
              </label>
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title..."
                className="h-11 rounded-lg text-lg font-medium"
                autoFocus
              />
            </div>

            {/* Status */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusPickerOptions.map((key) => {
                  const config = statusConfig[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setNewTaskStatus(key)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        newTaskStatus === key 
                          ? `${config.bg} ${config.text} ring-2 ring-offset-2 ring-offset-background`
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                      style={newTaskStatus === key ? { '--tw-ring-color': config.color } as React.CSSProperties : {}}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Assignee
              </label>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 ring-2 ring-background">
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-medium">
                    {(newTaskAssignee || 'E').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Input
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="max-w-[200px] h-9 rounded-lg"
                  placeholder="Assignee name"
                />
              </div>
            </div>

            {/* Related Customer */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" /> Related Borrower
              </label>
              <BorrowerSearchSelect
                leads={leads}
                value={newTaskLeadId}
                onValueChange={setNewTaskLeadId}
                placeholder="Search borrowers..."
              />
            </div>

            {/* Task Type */}
            <div className="space-y-3">
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
                      onClick={() => setNewTaskType(type)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        newTaskType === type 
                          ? 'ring-2 ring-offset-2 ring-offset-background'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                      style={newTaskType === type ? { 
                        '--tw-ring-color': config.color,
                        backgroundColor: config.color + '20',
                        color: config.color
                      } as React.CSSProperties : {}}
                    >
                      <IconComponent className="h-4 w-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {newTaskType === 'call' && 'Creates a shortcut to call the borrower'}
                {newTaskType === 'email' && 'Creates a shortcut to email the borrower'}
                {newTaskType === 'internal' && 'Internal task with no client communication'}
              </p>
            </div>

            {/* Due Date & Time */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" /> Due Date
              </label>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start h-9 rounded-lg font-normal">
                      {newTaskDueDate ? format(newTaskDueDate, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl pointer-events-auto z-[200]" align="start">
                    <Calendar
                      mode="single"
                      selected={newTaskDueDate}
                      onSelect={setNewTaskDueDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                
                {/* Optional Time */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="justify-start h-9 rounded-lg font-normal min-w-[130px]"
                    >
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      {newTaskDueTime ? newTaskDueTime : <span className="text-muted-foreground">Add time</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 rounded-xl pointer-events-auto z-[200]" align="start">
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Enter Time</p>
                      <Input
                        type="time"
                        value={newTaskDueTime}
                        onChange={(e) => setNewTaskDueTime(e.target.value)}
                        className="h-10 rounded-lg text-center font-medium"
                      />
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => setNewTaskDueTime('')}
                        >
                          Clear
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs ml-auto"
                          onClick={() => setNewTaskDueTime('09:00')}
                        >
                          9 AM
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => setNewTaskDueTime('12:00')}
                        >
                          12 PM
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => setNewTaskDueTime('17:00')}
                        >
                          5 PM
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {newTaskDueTime && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setNewTaskDueTime('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Time is optional — leave blank for date-only due dates
              </p>
            </div>

            {/* Priority */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Star className="h-3.5 w-3.5" /> Priority
              </label>
              <div className="flex flex-wrap gap-2">
                {priorityOptions.map((key) => {
                  const config = priorityConfig[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setNewTaskPriority(key)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                        newTaskPriority === key 
                          ? 'bg-primary/10 text-primary ring-2 ring-offset-2 ring-offset-background ring-primary'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                    >
                      {renderPriorityIndicator(key)}
                      <span>{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hours */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> Estimated Hours
              </label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={newTaskHours || ''}
                onChange={(e) => setNewTaskHours(parseFloat(e.target.value) || null)}
                className="max-w-[120px] h-9 rounded-lg"
                placeholder="Hours"
              />
            </div>

            {/* Description */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </label>
              <Textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Add a description..."
                className="min-h-[120px] rounded-lg resize-none"
              />
            </div>
          </div>

          {/* Footer with Create Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-muted-foreground/10">
            <Button variant="outline" onClick={handleClose} className="rounded-lg">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTask} 
              disabled={!newTaskTitle.trim()}
              className="rounded-lg"
            >
              Create Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Existing Task View
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl border-muted-foreground/10">
        <DialogHeader className="pb-4 border-b border-muted-foreground/10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onUpdateTask(task!.id, { is_completed: !task!.is_completed, status: task!.is_completed ? 'todo' : 'done' })}
              className="flex-shrink-0"
            >
              {task!.is_completed ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground hover:text-emerald-500 transition-colors" />
              )}
            </button>
            <Input
              value={editedTitle || task!.title}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              className="text-lg font-semibold border-0 bg-transparent focus-visible:ring-0 p-0 h-auto"
            />
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start gap-1 bg-transparent border-b border-muted-foreground/10 rounded-none p-0 h-auto">
            <TabsTrigger 
              value="details"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              Details
            </TabsTrigger>
            <TabsTrigger 
              value="updates"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              Comments ({activities.filter(a => a.activity_type === 'comment').length})
            </TabsTrigger>
            <TabsTrigger 
              value="activity"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 space-y-6 overflow-y-auto p-1 mt-4">
            {/* Status */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusPickerOptions.map((key) => {
                  const config = statusConfig[key];
                  return (
                    <button
                      key={key}
                      onClick={() => onUpdateTask(task!.id, { status: key, is_completed: key === 'done' })}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        task!.status === key 
                          ? `${config.bg} ${config.text} ring-2 ring-offset-2 ring-offset-background`
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                      style={task!.status === key ? { '--tw-ring-color': config.color } as React.CSSProperties : {}}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Assignee
              </label>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 ring-2 ring-background">
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-medium">
                    {'EV'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">Evan</span>
              </div>
            </div>

            {/* Related Customer */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" /> Related Borrower
              </label>
              <BorrowerSearchSelect
                leads={leads}
                value={task!.lead_id || null}
                onValueChange={(value) => onUpdateTask(task!.id, { lead_id: value })}
                placeholder="Search borrowers..."
              />
            </div>

            {/* Due Date & Time */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" /> Due Date
              </label>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start h-9 rounded-lg font-normal">
                      {task!.due_date ? format(parseISO(task!.due_date), 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl pointer-events-auto z-[200]" align="start">
                    <Calendar
                      mode="single"
                      selected={task!.due_date ? parseISO(task!.due_date) : undefined}
                      onSelect={handleDateSelect}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                
                {/* Optional Time */}
                {task!.due_date && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="justify-start h-9 rounded-lg font-normal min-w-[130px]"
                      >
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        {extractTimeFromDate(task!.due_date) || <span className="text-muted-foreground">Add time</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 rounded-xl pointer-events-auto z-[200]" align="start">
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Enter Time</p>
                        <Input
                          type="time"
                          value={extractTimeFromDate(task!.due_date) || ''}
                          onChange={(e) => handleTimeChange(e.target.value)}
                          className="h-10 rounded-lg text-center font-medium"
                        />
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs"
                            onClick={() => handleTimeChange('')}
                          >
                            Clear
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs ml-auto"
                            onClick={() => handleTimeChange('09:00')}
                          >
                            9 AM
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs"
                            onClick={() => handleTimeChange('12:00')}
                          >
                            12 PM
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs"
                            onClick={() => handleTimeChange('17:00')}
                          >
                            5 PM
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {task!.due_date && extractTimeFromDate(task!.due_date) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => handleTimeChange('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Time is optional — leave blank for date-only due dates
              </p>
            </div>

            {/* Priority */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Star className="h-3.5 w-3.5" /> Priority
              </label>
              <div className="flex flex-wrap gap-2">
                {priorityOptions.map((key) => {
                  const config = priorityConfig[key];
                  return (
                    <button
                      key={key}
                      onClick={() => onUpdateTask(task!.id, { priority: key })}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                        task!.priority === key 
                          ? 'bg-primary/10 text-primary ring-2 ring-offset-2 ring-offset-background ring-primary'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                    >
                      {renderPriorityIndicator(key)}
                      <span>{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Go To Section */}
            {(() => {
              const navInfo = getNavigationInfo(task!);
              if (!navInfo) return null;
              return (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5" /> Go To
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10 px-4 rounded-lg gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-colors"
                      onClick={() => handleNavigate(navInfo)}
                    >
                      {navInfo.icon}
                      <span>{navInfo.label}</span>
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* Hours */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> Estimated Hours
              </label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={task!.estimated_hours || ''}
                onChange={(e) => onUpdateTask(task!.id, { estimated_hours: parseFloat(e.target.value) || null })}
                className="max-w-[120px] h-9 rounded-lg"
                placeholder="Hours"
              />
            </div>

            {/* Description */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </label>
              <Textarea
                value={editedDescription || task!.description || ''}
                onChange={(e) => setEditedDescription(e.target.value)}
                onBlur={handleSaveDescription}
                placeholder="Add a description..."
                className="min-h-[120px] rounded-lg resize-none"
              />
            </div>
          </TabsContent>

          <TabsContent value="updates" className="flex-1 flex flex-col min-h-0 mt-4">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {activities
                  .filter(a => a.activity_type === 'comment')
                  .map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-background">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-medium">
                          {(activity.created_by || 'U').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted/40 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{activity.created_by}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(activity.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm">{activity.content}</p>
                      </div>
                    </div>
                  ))}
                {activities.filter(a => a.activity_type === 'comment').length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    No comments yet
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Comment input */}
            <div className="flex gap-3 pt-4 border-t border-muted-foreground/10 mt-4">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="rounded-full h-10"
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <Button 
                onClick={handleAddComment} 
                size="icon"
                className="h-10 w-10 rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-y-auto mt-4">
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="p-2 bg-muted/50 rounded-full">
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm">
                      <span className="font-medium">{activity.created_by}</span>
                      <span className="text-muted-foreground">
                        {activity.activity_type === 'comment' && ' added a comment'}
                        {activity.activity_type === 'status_change' && (
                          <> changed status to <span className="font-medium text-foreground">{activity.new_value}</span></>
                        )}
                      </span>
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(activity.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  No activity yet
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
