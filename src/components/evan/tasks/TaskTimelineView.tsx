import { Task, statusConfig } from './types';
import { format, parseISO, differenceInDays, startOfDay, addDays, isBefore, isAfter, min, max } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    return addDays(today, -7); // Start from a week ago
  });

  const daysToShow = 28; // 4 weeks
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
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header with navigation */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/20">
        <Button variant="ghost" size="sm" onClick={shiftLeft}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <span className="font-medium text-sm">
          {format(startDate, 'MMM d')} - {format(addDays(startDate, daysToShow - 1), 'MMM d, yyyy')}
        </span>
        <Button variant="ghost" size="sm" onClick={shiftRight}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Timeline header with days */}
      <div className="flex border-b overflow-hidden">
        <div className="w-32 flex-shrink-0 p-2 bg-muted/20 font-medium text-sm">
          Assignee
        </div>
        <div className="flex-1 relative">
          <div className="flex">
            {days.map((day, idx) => {
              const isToday = differenceInDays(day, new Date()) === 0;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={idx}
                  className={`flex-1 p-1 text-center text-xs border-r ${
                    isToday ? 'bg-primary/20 font-bold' : isWeekend ? 'bg-muted/30' : ''
                  }`}
                >
                  <div className="text-muted-foreground">{format(day, 'EEE')}</div>
                  <div className={isToday ? 'text-primary' : ''}>{format(day, 'd')}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline rows */}
      <div className="divide-y">
        {Object.entries(groupedByAssignee).map(([assignee, assigneeTasks]) => (
          <div key={assignee} className="flex min-h-[60px]">
            <div className="w-32 flex-shrink-0 p-2 bg-muted/10 font-medium text-sm flex items-center">
              {assignee}
            </div>
            <div className="flex-1 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex">
                {days.map((day, idx) => {
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div
                      key={idx}
                      className={`flex-1 border-r ${isWeekend ? 'bg-muted/20' : ''}`}
                    />
                  );
                })}
              </div>
              
              {/* Tasks */}
              <div className="relative py-2 px-1">
                {assigneeTasks.map((task, taskIdx) => {
                  const pos = getTaskPosition(task);
                  if (!pos) return null;
                  
                  return (
                    <div
                      key={task.id}
                      className="absolute h-6 rounded text-xs text-white px-1.5 truncate cursor-pointer hover:opacity-90 flex items-center"
                      style={{
                        left: pos.left,
                        width: pos.width,
                        top: `${taskIdx * 28 + 4}px`,
                        backgroundColor: statusConfig[task.status || 'todo']?.color,
                        minWidth: '50px',
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
          <div className="p-8 text-center text-muted-foreground">
            No tasks with due dates to display
          </div>
        )}
      </div>
    </div>
  );
};
