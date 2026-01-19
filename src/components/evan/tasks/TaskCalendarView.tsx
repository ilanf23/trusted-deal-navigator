import { Task, statusConfig } from './types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
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
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 border-b bg-muted/10">
        {weekDays.map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayTasks = getTasksForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div
              key={idx}
              className={`min-h-[100px] p-1 border-b border-r ${
                !isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''
              } ${isToday ? 'bg-primary/5' : ''}`}
              onClick={() => onAddTask({ due_date: day.toISOString() })}
            >
              <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary' : ''}`}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: statusConfig[task.status || 'todo']?.color, color: 'white' }}
                    onClick={(e) => { e.stopPropagation(); onOpenDetail(task); }}
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">
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
