import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task, statusConfig, priorityConfig } from './types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, ArrowUpRight, Building2, Calendar, ExternalLink, Mail, Users, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TaskTableViewProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (task: Partial<Task>) => void;
  onOpenDetail: (task: Task) => void;
  selectedTasks: Set<string>;
  onToggleSelect: (id: string) => void;
  fadingTasks?: Set<string>;
  onComposeEmail?: (leadId: string | null, template?: string) => void | Promise<void>;
}

export const TaskTableView = ({
  tasks,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  onOpenDetail,
  selectedTasks,
  onToggleSelect,
  fadingTasks = new Set(),
  onComposeEmail,
}: TaskTableViewProps) => {
  const navigate = useNavigate();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    onAddTask({ title: newTaskTitle.trim() });
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  // Determine where to navigate based on task source and context
  const getNavigationInfo = (task: Task): { 
    path: string; 
    label: string; 
    icon: React.ReactNode;
    action?: 'compose' | 'view';
    template?: string;
  } | null => {
    const source = task.source?.toLowerCase() || '';
    const title = task.title?.toLowerCase() || '';
    const hasLead = task.lead_id || task.lead;
    
    // Closing docs / prepare closing - opens email with closing template
    if (title.includes('closing') || title.includes('prepare closing')) {
      return { 
        path: hasLead 
          ? `/team/evan/gmail?compose=true&leadId=${task.lead_id}&template=closing&taskId=${task.id}`
          : `/team/evan/gmail?compose=true&template=closing&taskId=${task.id}`,
        label: 'Draft Closing Email', 
        icon: <FileText className="h-3.5 w-3.5" />,
        action: 'compose',
        template: 'closing'
      };
    }
    
    // Follow up / nudge tasks - opens email compose with follow-up template
    if (source === 'nudge' || title.includes('follow up') || title.includes('follow-up')) {
      return { 
        path: hasLead 
          ? `/team/evan/gmail?compose=true&leadId=${task.lead_id}&template=follow_up&taskId=${task.id}`
          : `/team/evan/gmail?compose=true&template=follow_up&taskId=${task.id}`,
        label: 'Draft Follow-up Email', 
        icon: <Mail className="h-3.5 w-3.5" />,
        action: 'compose',
        template: 'follow_up'
      };
    }
    
    // General email tasks - opens compose
    if (source === 'gmail' || title.includes('email') || title.includes('send')) {
      return { 
        path: hasLead 
          ? `/team/evan/gmail?compose=true&leadId=${task.lead_id}&taskId=${task.id}`
          : `/team/evan/gmail?compose=true&taskId=${task.id}`,
        label: 'Compose Email', 
        icon: <Mail className="h-3.5 w-3.5" />,
        action: 'compose'
      };
    }
    
    // Lead/CRM tasks - go to the lead in pipeline with lenders tab
    if (source === 'lead' || hasLead) {
      return { 
        path: `/team/evan/pipeline?lead=${task.lead_id}&tab=lenders`, 
        label: 'View in CRM', 
        icon: <Users className="h-3.5 w-3.5" />,
        action: 'view'
      };
    }
    
    // Document tasks without lead context
    if (title.includes('document') || title.includes('doc') || title.includes('file')) {
      return { 
        path: '/team/evan/pipeline', 
        label: 'Go to Pipeline', 
        icon: <FileText className="h-3.5 w-3.5" />,
        action: 'view'
      };
    }
    
    // Default - no navigation available
    return null;
  };

  const handleNavigate = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const navInfo = getNavigationInfo(task);
    if (navInfo) {
      console.debug('[TaskTableView] Go To click', {
        taskId: task.id,
        action: navInfo.action,
        path: navInfo.path,
        template: navInfo.template,
      });

      // Always navigate to Gmail page for compose actions - Gmail will handle email generation
      navigate(navInfo.path);
    }
  };

  const renderPriorityIndicator = (priority: string | null) => {
    const config = priorityConfig[priority || 'medium'];
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

  const StatusPill = ({ task }: { task: Task }) => {
    const config = statusConfig[task.status || 'todo'];
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button 
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 ${config.bg} ${config.text}`}
          >
            {config.label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-2 rounded-xl border-muted-foreground/10" align="start">
          <div className="space-y-1">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => onUpdateTask(task.id, { status: key, is_completed: key === 'done' })}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] ${cfg.bg} ${cfg.text}`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="rounded-xl md:rounded-2xl border border-muted-foreground/10 bg-card/50 backdrop-blur-sm overflow-x-auto">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-muted-foreground/10">
            <TableHead className="w-8 md:w-10"></TableHead>
            <TableHead className="font-semibold text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground w-10">Go To</TableHead>
            <TableHead className="font-semibold text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Task Name</TableHead>
            <TableHead className="font-semibold text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Assigned To</TableHead>
            <TableHead className="font-semibold text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Related Customer</TableHead>
            <TableHead className="font-semibold text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Due Date</TableHead>
            <TableHead className="font-semibold text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
            <TableHead className="font-semibold text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Priority</TableHead>
            <TableHead className="w-12 md:w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className={`group cursor-pointer transition-all duration-500 hover:bg-muted/40 ${
                fadingTasks.has(task.id) 
                  ? 'opacity-0 scale-95 translate-x-4' 
                  : task.is_completed 
                    ? 'opacity-50' 
                    : ''
              }`}
              onClick={() => onOpenDetail(task)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                  checked={task.is_completed}
                  onCheckedChange={(checked) => onUpdateTask(task.id, { 
                    is_completed: !!checked, 
                    status: checked ? 'done' : 'todo' 
                  })}
                  className="h-5 w-5 rounded-full border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
              </TableCell>

              {/* Go To / Take Me There column */}
              <TableCell onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const navInfo = getNavigationInfo(task);
                  if (!navInfo) return <span className="text-muted-foreground">—</span>;
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => handleNavigate(e, task)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                          >
                            {navInfo.icon}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {navInfo.label}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })()}
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">
                    {task.description}
                  </p>
                )}
              </TableCell>

              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5 md:h-6 md:w-6 ring-2 ring-background">
                    <AvatarFallback className="text-[9px] md:text-[10px] bg-gradient-to-br from-violet-500 to-purple-600 text-white font-medium">
                      {(task.assignee_name || 'E').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs md:text-sm">{task.assignee_name || 'Unassigned'}</span>
                </div>
              </TableCell>

              <TableCell className="hidden lg:table-cell">
                {task.lead ? (
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-muted">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs md:text-sm font-medium">{task.lead.name}</p>
                      {task.lead.company_name && (
                        <p className="text-[10px] md:text-xs text-muted-foreground">{task.lead.company_name}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs md:text-sm text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell>
                {task.due_date ? (
                  <div className="flex items-center gap-1 md:gap-1.5 text-xs md:text-sm">
                    <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground" />
                    <span className="hidden sm:inline">{format(parseISO(task.due_date), 'MMM d, yyyy')}</span>
                    <span className="sm:hidden">{format(parseISO(task.due_date), 'M/d')}</span>
                  </div>
                ) : (
                  <span className="text-xs md:text-sm text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell onClick={(e) => e.stopPropagation()}>
                <StatusPill task={task} />
              </TableCell>

              <TableCell className="hidden sm:table-cell">
                {renderPriorityIndicator(task.priority)}
              </TableCell>

              <TableCell onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TableCell>
            </TableRow>
          ))}

          {/* Empty state */}
          {tasks.length === 0 && !isAddingTask && (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No tasks yet. Click "Add task" to create one.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Add Task Row */}
      <div className="px-4 py-3 border-t border-muted-foreground/10">
        {isAddingTask ? (
          <div className="flex items-center gap-3">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 h-9 rounded-xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') {
                  setIsAddingTask(false);
                  setNewTaskTitle('');
                }
              }}
            />
            <Button 
              size="sm" 
              onClick={handleAddTask}
              className="h-8 px-4 rounded-full text-xs"
            >
              Add
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => { setIsAddingTask(false); setNewTaskTitle(''); }}
              className="h-8 px-4 rounded-full text-xs"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add task
          </button>
        )}
      </div>
    </div>
  );
};
