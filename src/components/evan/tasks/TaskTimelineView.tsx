import { Task, statusConfig } from './types';
import { format, parseISO, differenceInDays, startOfDay, addDays, isToday, isWeekend } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface TaskTimelineViewProps {
  tasks: Task[];
  onOpenDetail: (task: Task) => void;
}

export const TaskTimelineView = ({
  tasks,
  onOpenDetail,
}: TaskTimelineViewProps) => {
  const [startDate, setStartDate] = useState(() => {
    const today = startOfDay(new Date());
    return addDays(today, -7);
  });

  const daysToShow = 28;
  const days = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));

  const tasksWithDates = tasks.filter(t => t.due_date);

  const shiftLeft = () => setStartDate(prev => addDays(prev, -7));
  const shiftRight = () => setStartDate(prev => addDays(prev, 7));

  const getTaskPosition = (task: Task) => {
    if (!task.due_date) return null;
    const taskDate = startOfDay(parseISO(task.due_date));
    const dayIndex = differenceInDays(taskDate, startDate);
    
    if (dayIndex < 0 || dayIndex >= daysToShow) return null;
    
    return {
      left: `${(dayIndex / daysToShow) * 100}%`,
      width: `${(1 / daysToShow) * 100}%`,
    };
  };

  const groupedByAssignee = tasksWithDates.reduce((acc, task) => {
    const assignee = task.assignee_name || 'Unassigned';
    if (!acc[assignee]) acc[assignee] = [];
    acc[assignee].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="rounded-2xl border border-muted-foreground/10 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-muted-foreground/10">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={shiftLeft}
          className="rounded-full"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <span className="font-medium text-sm">
          {format(startDate, 'MMM d')} – {format(addDays(startDate, daysToShow - 1), 'MMM d, yyyy')}
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={shiftRight}
          className="rounded-full"
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Timeline header */}
      <div className="flex border-b border-muted-foreground/10">
        <div className="w-40 flex-shrink-0 px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">
          Assignee
        </div>
        <div className="flex-1 relative">
          <div className="flex">
            {days.map((day, idx) => {
              const isTodayDate = isToday(day);
              const isWeekendDay = isWeekend(day);
              return (
                <div
                  key={idx}
                  className={`flex-1 py-2 text-center text-[10px] border-l border-muted-foreground/5 ${
                    isTodayDate ? 'bg-foreground/5' : isWeekendDay ? 'bg-muted/30' : ''
                  }`}
                >
                  <div className="text-muted-foreground font-medium">{format(day, 'EEE')}</div>
                  <div className={`font-semibold ${isTodayDate ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline rows */}
      <div className="divide-y divide-muted-foreground/5">
        {Object.entries(groupedByAssignee).map(([assignee, assigneeTasks]) => (
          <div key={assignee} className="flex min-h-[70px]">
            <div className="w-40 flex-shrink-0 px-4 py-3 flex items-center gap-3">
              <Avatar className="h-7 w-7 ring-2 ring-background">
                <AvatarFallback className="text-[10px] bg-gradient-to-br from-violet-500 to-purple-600 text-white font-medium">
                  {assignee.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm truncate">{assignee}</span>
            </div>
            <div className="flex-1 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex">
                {days.map((day, idx) => {
                  const isWeekendDay = isWeekend(day);
                  const isTodayDate = isToday(day);
                  return (
                    <div
                      key={idx}
                      className={`flex-1 border-l border-muted-foreground/5 ${
                        isTodayDate ? 'bg-foreground/5' : isWeekendDay ? 'bg-muted/20' : ''
                      }`}
                    />
                  );
                })}
              </div>
              
              {/* Tasks */}
              <div className="relative py-3 px-1">
                {assigneeTasks.map((task, taskIdx) => {
                  const pos = getTaskPosition(task);
                  if (!pos) return null;
                  
                  return (
                    <div
                      key={task.id}
                      className="absolute h-7 rounded-lg text-xs text-white px-2 truncate cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg flex items-center font-medium"
                      style={{
                        left: pos.left,
                        width: `calc(${pos.width} - 4px)`,
                        top: `${taskIdx * 32 + 8}px`,
                        backgroundColor: statusConfig[task.status || 'todo']?.color,
                        minWidth: '60px',
                      }}
                      onClick={() => onOpenDetail(task)}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        
        {Object.keys(groupedByAssignee).length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            No tasks with due dates to display
          </div>
        )}
      </div>
    </div>
  );
};
