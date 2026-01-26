import { Task, statusConfig } from './types';
import { format, parseISO, differenceInDays, startOfDay, addDays, addWeeks, addMonths, isToday, isWeekend, startOfWeek, startOfMonth, isSameMonth } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type TimelineViewMode = 'day' | 'week' | 'month';

interface TaskTimelineViewProps {
  tasks: Task[];
  onOpenDetail: (task: Task) => void;
}

export const TaskTimelineView = ({
  tasks,
  onOpenDetail,
}: TaskTimelineViewProps) => {
  const [viewMode, setViewMode] = useState<TimelineViewMode>('week');
  const [startDate, setStartDate] = useState(() => {
    const today = startOfDay(new Date());
    return startOfWeek(today, { weekStartsOn: 1 }); // Start on Monday
  });

  // Configure based on view mode
  const getViewConfig = () => {
    switch (viewMode) {
      case 'day':
        return { daysToShow: 1, shiftAmount: 1 };
      case 'week':
        return { daysToShow: 7, shiftAmount: 7 };
      case 'month':
        return { daysToShow: 30, shiftAmount: 30 };
      default:
        return { daysToShow: 7, shiftAmount: 7 };
    }
  };

  const { daysToShow, shiftAmount } = getViewConfig();
  const days = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));

  const tasksWithDates = tasks.filter(t => t.due_date);

  const shiftLeft = () => setStartDate(prev => addDays(prev, -shiftAmount));
  const shiftRight = () => setStartDate(prev => addDays(prev, shiftAmount));
  const goToToday = () => setStartDate(startOfWeek(startOfDay(new Date()), { weekStartsOn: 1 }));

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

  const viewModes: { value: TimelineViewMode; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ];

  // Render day headers based on view mode
  const renderDayHeader = (day: Date, idx: number) => {
    const isTodayDate = isToday(day);
    const isWeekendDay = isWeekend(day);

    if (viewMode === 'month') {
      // For month view, only show week start markers
      const isMonday = day.getDay() === 1;
      const isFirstOfMonth = day.getDate() === 1;
      
      if (!isMonday && !isFirstOfMonth) {
        return (
          <div
            key={idx}
            className={`flex-1 border-l border-muted-foreground/5 ${
              isTodayDate ? 'bg-foreground/5' : isWeekendDay ? 'bg-muted/30' : ''
            }`}
          />
        );
      }
      
      return (
        <div
          key={idx}
          className={`flex-1 py-1 text-center text-[9px] border-l border-muted-foreground/10 ${
            isTodayDate ? 'bg-foreground/5' : isWeekendDay ? 'bg-muted/30' : ''
          }`}
        >
          <div className={`font-semibold ${isTodayDate ? 'text-foreground' : 'text-muted-foreground'}`}>
            {isFirstOfMonth ? format(day, 'MMM d') : format(day, 'd')}
          </div>
        </div>
      );
    }

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
  };

  return (
    <div className="rounded-2xl border border-muted-foreground/10 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-muted-foreground/10">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={shiftLeft}
            className="rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToToday}
            className="rounded-full text-xs"
          >
            Today
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={shiftRight}
            className="rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm ml-2">
            {viewMode === 'day' 
              ? format(startDate, 'EEEE, MMM d, yyyy')
              : `${format(startDate, 'MMM d')} – ${format(addDays(startDate, daysToShow - 1), 'MMM d, yyyy')}`
            }
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-full backdrop-blur-sm self-start sm:self-auto">
          {viewModes.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setViewMode(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                viewMode === value 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline header - hide for day view */}
      {viewMode !== 'day' && (
        <div className="flex border-b border-muted-foreground/10">
          <div className="w-40 flex-shrink-0 px-4 py-3 font-medium text-xs text-muted-foreground uppercase tracking-wider">
            Assignee
          </div>
          <div className="flex-1 relative overflow-hidden">
            <div className="flex">
              {days.map((day, idx) => renderDayHeader(day, idx))}
            </div>
          </div>
        </div>
      )}

      {/* Day View - List format */}
      {viewMode === 'day' && (
        <div className="divide-y divide-muted-foreground/5">
          {tasksWithDates.filter(task => {
            const pos = getTaskPosition(task);
            return pos !== null;
          }).length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No tasks scheduled for this day
            </div>
          ) : (
            tasksWithDates.filter(task => getTaskPosition(task) !== null).map(task => (
              <div
                key={task.id}
                className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onOpenDetail(task)}
              >
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusConfig[task.status || 'todo']?.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusConfig[task.status || 'todo']?.bg} ${statusConfig[task.status || 'todo']?.text}`}>
                    {statusConfig[task.status || 'todo']?.label}
                  </span>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[9px] bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                      {(task.assignee_name || 'U').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Timeline rows - Week/Month view */}
      {viewMode !== 'day' && (
        <div className="divide-y divide-muted-foreground/5">
          {Object.entries(groupedByAssignee).map(([assignee, assigneeTasks]) => {
            // Task sizing stays constant
            const taskHeight = 28;
            const taskSpacing = 36;
            // Dynamic row sizing based on view mode (2x for week, 3x for month)
            const baseRowHeight = 90;
            const rowMinHeight = viewMode === 'month' ? baseRowHeight * 3 : baseRowHeight * 2;
            
            return (
              <div key={assignee} className="flex" style={{ minHeight: `${rowMinHeight}px` }}>
                <div className="w-40 flex-shrink-0 px-4 py-3 flex items-center gap-3">
                  <Avatar className="h-7 w-7 ring-2 ring-background">
                    <AvatarFallback className="text-[10px] bg-gradient-to-br from-violet-500 to-purple-600 text-white font-medium">
                      {assignee.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm truncate">{assignee}</span>
                </div>
                <div className="flex-1 relative overflow-hidden">
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
                          className={`absolute rounded-xl text-white px-3 truncate cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg flex items-center font-medium ${
                            viewMode === 'month' ? 'text-sm' : 'text-xs'
                          }`}
                          style={{
                            left: pos.left,
                            width: `calc(${pos.width} - 4px)`,
                            height: `${taskHeight}px`,
                            top: `${taskIdx * taskSpacing + 8}px`,
                            backgroundColor: statusConfig[task.status || 'todo']?.color,
                            minWidth: viewMode === 'month' ? '24px' : '60px',
                          }}
                          onClick={() => onOpenDetail(task)}
                          title={task.title}
                        >
                          {viewMode !== 'month' && task.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          
          {Object.keys(groupedByAssignee).length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              No tasks with due dates to display
            </div>
          )}
        </div>
      )}
    </div>
  );
};
