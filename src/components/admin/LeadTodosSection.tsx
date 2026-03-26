import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Circle, ListTodo, Plus, ChevronDown, ChevronRight, Clock, Calendar, Building2, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type LeadTodoItem = {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  status?: string | null;
  priority?: string | null;
  estimated_hours?: number | null;
};

interface LeadTodosSectionProps {
  tasks: LeadTodoItem[];
  onAddTask: () => void;
  onViewAll?: () => void;
  onTaskClick?: (task: LeadTodoItem) => void;
  onUpdateTask?: (id: string, updates: Partial<LeadTodoItem>) => void;
  maxVisible?: number;
}

const priorityConfig: Record<string, { color: string; label: string; stars: number }> = {
  critical: { color: '#ef4444', label: 'Critical', stars: 6 },
  high: { color: '#f97316', label: 'High', stars: 4 },
  medium: { color: '#eab308', label: 'Medium', stars: 3 },
  low: { color: '#22c55e', label: 'Low', stars: 2 },
  none: { color: '#94a3b8', label: 'None', stars: 0 },
};

const statusConfig: Record<string, { label: string; bg: string; text: string; color: string }> = {
  todo: { label: 'To Do', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', color: '#3b82f6' },
  working: { label: 'Working', bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', color: '#ec4899' },
  in_progress: { label: 'In Progress', bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', color: '#ec4899' },
  blocked: { label: 'Blocked', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', color: '#ef4444' },
  done: { label: 'Done', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', color: '#10b981' },
  completed: { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', color: '#10b981' },
};

export function LeadTodosSection({
  tasks,
  onAddTask,
  onViewAll,
  onTaskClick,
  onUpdateTask,
  maxVisible = 4,
}: LeadTodosSectionProps) {
  const visibleTasks = tasks.slice(0, maxVisible);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderPriorityIndicator = (priority: string | null) => {
    const config = priorityConfig[priority || 'none'];
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`w-1 rounded-full transition-all ${
              level <= Math.ceil(config.stars / 2) 
                ? 'h-2.5 opacity-100' 
                : 'h-1.5 opacity-25'
            }`}
            style={{ backgroundColor: config.color }}
          />
        ))}
      </div>
    );
  };

  const StatusPill = ({ task }: { task: LeadTodoItem }) => {
    const config = statusConfig[task.status || 'todo'] || statusConfig.todo;
    
    if (!onUpdateTask) {
      return (
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${config.bg} ${config.text}`}>
          {config.label}
        </span>
      );
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button 
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all hover:scale-105 ${config.bg} ${config.text}`}
            onClick={(e) => e.stopPropagation()}
          >
            {config.label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1.5 rounded-xl border-muted-foreground/10" align="start">
          <div className="space-y-0.5">
            {Object.entries(statusConfig).filter(([key]) => !['in_progress', 'completed'].includes(key)).map(([key, cfg]) => (
              <button
                key={key}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateTask(task.id, { status: key });
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:scale-[1.02] ${cfg.bg} ${cfg.text}`}
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
    <section className="mt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">To Do&apos;s</h3>
          <span className="text-xs text-muted-foreground">({tasks.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {onViewAll && tasks.length > maxVisible && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs h-7">
              View all
            </Button>
          )}
          <Button size="sm" onClick={onAddTask} className="gap-1 h-7 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add task
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No tasks yet
        </div>
      ) : (
        <div className="space-y-2">
          {visibleTasks.map((task) => {
            const completed = task.status === 'completed' || task.status === 'done';
            const isExpanded = expandedTasks.has(task.id);
            const hasDescription = task.description && task.description.trim().length > 0;

            return (
              <div
                key={task.id}
                className={cn(
                  "group rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200",
                  "hover:border-muted-foreground/30 hover:shadow-sm",
                  completed && "opacity-60"
                )}
              >
                {/* Main task row */}
                <div 
                  className="flex items-start gap-3 p-3 cursor-pointer"
                  onClick={() => onTaskClick?.(task)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateTask?.(task.id, { 
                        status: completed ? 'todo' : 'done'
                      });
                    }}
                    className="mt-0.5 flex-shrink-0"
                  >
                    {completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground hover:text-emerald-500 transition-colors" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title row with priority */}
                    <div className="flex items-start gap-2">
                      {renderPriorityIndicator(task.priority)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-sm font-medium leading-snug",
                            completed && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                        
                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                          {task.due_date && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(task.due_date), 'MMM d')}
                            </span>
                          )}
                          {task.estimated_hours && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {task.estimated_hours}h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right side - Status + Expand */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusPill task={task} />
                    
                    {hasDescription && (
                      <button 
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                        onClick={(e) => toggleExpand(task.id, e)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded description */}
                {isExpanded && hasDescription && (
                  <div className="px-3 pb-3 pl-11">
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">
                      {task.description}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {tasks.length > maxVisible && onViewAll && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onViewAll} 
              className="w-full text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              +{tasks.length - maxVisible} more tasks
            </Button>
          )}
        </div>
      )}
    </section>
  );
}