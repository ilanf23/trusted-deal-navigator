import { Task, statusConfig } from './types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths, isToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface TaskCalendarViewProps {
  tasks: Task[];
  onOpenDetail: (task: Task) => void;
  onAddTask: (task: Partial<Task>) => void;
}

export const TaskCalendarView = ({
  tasks,
  onOpenDetail,
  onAddTask,
}: TaskCalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getTasksForDay = (date: Date) => 
    tasks.filter(task => task.due_date && isSameDay(parseISO(task.due_date), date));

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="rounded-2xl border border-muted-foreground/10 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-muted-foreground/10">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={prevMonth}
          className="h-9 w-9 rounded-full hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-lg tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={nextMonth}
          className="h-9 w-9 rounded-full hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 border-b border-muted-foreground/10">
        {weekDays.map(day => (
          <div key={day} className="py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayTasks = getTasksForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          
          return (
            <div
              key={idx}
              className={`min-h-[120px] p-2 border-b border-r border-muted-foreground/5 transition-colors hover:bg-muted/30 cursor-pointer ${
                !isCurrentMonth ? 'bg-muted/20' : ''
              }`}
              onClick={() => onAddTask({ due_date: day.toISOString() })}
            >
              <div className={`flex items-center justify-center w-7 h-7 rounded-full mb-1 text-sm font-medium ${
                isTodayDate 
                  ? 'bg-foreground text-background' 
                  : !isCurrentMonth 
                    ? 'text-muted-foreground/50' 
                    : ''
              }`}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    className="text-xs py-1 px-2 rounded-md truncate cursor-pointer transition-all hover:scale-[1.02]"
                    style={{ 
                      backgroundColor: `${statusConfig[task.status || 'todo']?.color}20`,
                      color: statusConfig[task.status || 'todo']?.color,
                      borderLeft: `2px solid ${statusConfig[task.status || 'todo']?.color}`
                    }}
                    onClick={(e) => { e.stopPropagation(); onOpenDetail(task); }}
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-muted-foreground px-2 font-medium">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
