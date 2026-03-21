import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckSquare, AlertTriangle, CalendarDays, Clock, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DbTableBadge } from '@/components/admin/DbTableBadge';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface TasksOverviewWidgetProps {
  tasksData: {
    overdue: number;
    today: number;
    thisWeek: number;
    done: number;
    topUrgent: any[];
  };
  isLoading: boolean;
}

export const TasksOverviewWidget = ({ tasksData, isLoading }: TasksOverviewWidgetProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            Tasks Overview
            <DbTableBadge tables={['tasks']} />
          </CardTitle>
          <Link to="/admin/tasks">
            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted gap-1">
              View Tasks <ArrowRight className="h-3 w-3" />
            </Badge>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-red-600">{tasksData.overdue}</p>
                <p className="text-[9px] text-red-600/70 uppercase">Overdue</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                <Clock className="h-3.5 w-3.5 text-amber-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-amber-600">{tasksData.today}</p>
                <p className="text-[9px] text-amber-600/70 uppercase">Today</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                <CalendarDays className="h-3.5 w-3.5 text-blue-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-blue-600">{tasksData.thisWeek}</p>
                <p className="text-[9px] text-blue-600/70 uppercase">This Week</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-600">{tasksData.done}</p>
                <p className="text-[9px] text-green-600/70 uppercase">Done</p>
              </div>
            </div>
            {tasksData.topUrgent.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Top Urgent</p>
                {tasksData.topUrgent.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card text-sm">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <span className="truncate flex-1">{task.title}</span>
                    {task.due_date && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
