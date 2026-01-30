import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CheckCircle2, Circle, ListTodo, Plus, ChevronDown, ChevronRight, Clock } from 'lucide-react';
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
  maxVisible?: number;
}

const priorityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  none: '#94a3b8',
};

export function LeadTodosSection({
  tasks,
  onAddTask,
  onViewAll,
  onTaskClick,
  maxVisible = 4,
}: LeadTodosSectionProps) {
  const visibleTasks = tasks.slice(0, maxVisible);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
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

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between gap-3 mb-2">
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
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          No tasks yet
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          <div className="divide-y divide-border">
            {visibleTasks.map((task) => {
              const completed = task.status === 'completed' || task.status === 'done';
              const isExpanded = expandedTasks.has(task.id);
              const hasDescription = task.description && task.description.trim().length > 0;
              const priorityColor = priorityColors[task.priority || 'none'];

              return (
                <div key={task.id} className="group">
                  <div 
                    className={cn(
                      "flex items-start gap-2 px-3 py-2.5 transition-colors cursor-pointer",
                      hasDescription && "hover:bg-muted/50"
                    )}
                    onClick={() => hasDescription && toggleExpand(task.id)}
                  >
                    {/* Priority indicator */}
                    <div className="flex items-center gap-0.5 mt-1.5">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`w-1 rounded-full transition-all ${
                            level <= Math.ceil((priorityColors[task.priority || 'none'] ? 3 : 1))
                              ? 'h-2.5'
                              : 'h-1.5'
                          }`}
                          style={{ 
                            backgroundColor: priorityColor,
                            opacity: level <= (task.priority === 'critical' ? 3 : task.priority === 'high' ? 2 : 1) ? 1 : 0.25
                          }}
                        />
                      ))}
                    </div>

                    {/* Expand indicator */}
                    {hasDescription ? (
                      <button 
                        className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(task.id);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <div className="w-4" />
                    )}

                    {/* Status icon */}
                    {completed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          completed
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground'
                        )}
                      >
                        {task.title}
                      </p>
                      
                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-1">
                        {task.due_date && (
                          <span className="text-[11px] text-muted-foreground">
                            Due {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                        {task.estimated_hours && (
                          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {task.estimated_hours}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded description */}
                  {isExpanded && hasDescription && (
                    <div className="px-3 pb-3 pl-[72px]">
                      <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2.5 whitespace-pre-wrap">
                        {task.description}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {tasks.length > maxVisible && onViewAll ? (
            <div className="px-3 py-2 border-t border-border bg-muted/30">
              <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs h-6 px-2">
                +{tasks.length - maxVisible} more
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
