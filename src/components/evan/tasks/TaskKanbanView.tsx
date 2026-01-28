import { Task, statusConfig, statusPickerOptions } from './types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TaskKanbanViewProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onAddTask: (task: Partial<Task>) => void;
  onOpenDetail: (task: Task) => void;
}

export const TaskKanbanView = ({
  tasks,
  onUpdateTask,
  onAddTask,
  onOpenDetail,
}: TaskKanbanViewProps) => {
  const columns = statusPickerOptions.map(status => [status, statusConfig[status]] as const);

  const getTasksByStatus = (status: string) => 
    tasks.filter(task => task.status === status);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onUpdateTask(taskId, { status, is_completed: status === 'done' });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory md:snap-none">
      {columns.map(([status, config]) => {
        const columnTasks = getTasksByStatus(status);
        
        return (
          <div
            key={status}
            className="flex-shrink-0 w-[280px] md:w-80 snap-start"
            onDrop={(e) => handleDrop(e, status)}
            onDragOver={handleDragOver}
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4 px-1">
              <div 
                className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="font-semibold text-xs md:text-sm">{config.label}</span>
              <span className="text-[10px] md:text-xs text-muted-foreground bg-muted/60 px-1.5 md:px-2 py-0.5 rounded-full">
                {columnTasks.length}
              </span>
            </div>
            
            {/* Column Content */}
            <div className="space-y-2 md:space-y-3 min-h-[300px] md:min-h-[400px] p-2 md:p-3 rounded-xl md:rounded-2xl bg-muted/30 backdrop-blur-sm">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  className="group bg-card rounded-lg md:rounded-xl p-3 md:p-4 shadow-sm border border-muted-foreground/5 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-foreground/5 hover:scale-[1.02] hover:-translate-y-0.5"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={() => onOpenDetail(task)}
                >
                  {/* Task Title */}
                  <p className="text-xs md:text-sm font-medium mb-2 md:mb-3 line-clamp-2">{task.title}</p>
                  
                  {/* Meta Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-muted-foreground">
                      {task.due_date && (
                        <div className="flex items-center gap-1 md:gap-1.5 bg-muted/50 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md">
                          <Calendar className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          {format(parseISO(task.due_date), 'MMM d')}
                        </div>
                      )}
                      {task.estimated_hours && (
                        <div className="flex items-center gap-1 md:gap-1.5 bg-muted/50 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md">
                          <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          {task.estimated_hours}h
                        </div>
                      )}
                    </div>
                    
                    <Avatar className="h-5 w-5 md:h-6 md:w-6 ring-2 ring-background">
                      <AvatarFallback className="text-[8px] md:text-[9px] bg-gradient-to-br from-violet-500 to-purple-600 text-white font-medium">
                        {(task.assignee_name || 'E').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  {/* Tags */}
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 md:gap-1.5 mt-2 md:mt-3">
                      {task.tags.slice(0, 2).map((tag, i) => (
                        <span 
                          key={i} 
                          className="text-[9px] md:text-[10px] px-1.5 md:px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Add Task Button */}
              <button
                onClick={() => onAddTask({ status, group_name: config.label })}
                className="w-full flex items-center justify-center gap-1.5 md:gap-2 py-2 md:py-3 rounded-lg md:rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground text-xs md:text-sm font-medium transition-all hover:border-muted-foreground/40 hover:bg-muted/30"
              >
                <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Add task
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
