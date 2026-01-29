import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CheckCircle2, Circle, ListTodo, Plus } from 'lucide-react';

type LeadTodoItem = {
  id: string;
  title: string;
  due_date?: string | null;
  status?: string | null;
};

interface LeadTodosSectionProps {
  tasks: LeadTodoItem[];
  onAddTask: () => void;
  onViewAll?: () => void;
  maxVisible?: number;
}

export function LeadTodosSection({
  tasks,
  onAddTask,
  onViewAll,
  maxVisible = 4,
}: LeadTodosSectionProps) {
  const visibleTasks = tasks.slice(0, maxVisible);

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">To Do&apos;s</h3>
        </div>
        <div className="flex items-center gap-2">
          {onViewAll && tasks.length > maxVisible && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              View all
            </Button>
          )}
          <Button size="sm" onClick={onAddTask} className="gap-1">
            <Plus className="h-4 w-4" /> Add task
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          No tasks yet
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background">
          <div className="divide-y divide-border">
            {visibleTasks.map((task) => {
              const completed = task.status === 'completed' || task.status === 'done';
              return (
                <div key={task.id} className="flex items-start gap-3 px-3 py-2">
                  {completed ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        completed
                          ? 'text-sm text-muted-foreground line-through'
                          : 'text-sm text-foreground'
                      }
                    >
                      {task.title}
                    </p>
                    {task.due_date ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Due {format(new Date(task.due_date), 'MMM d')}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {tasks.length > maxVisible && onViewAll ? (
            <div className="px-3 py-2">
              <Button variant="ghost" size="sm" onClick={onViewAll}>
                +{tasks.length - maxVisible} more
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
