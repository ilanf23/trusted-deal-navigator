import { Task, statusConfig } from './types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Star, Calendar, Clock } from 'lucide-react';
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
  const columns = Object.entries(statusConfig);

  const getTasksByStatus = (status: string) => 
    tasks.filter(task => task.status === status);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
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
  };

  const renderPriorityStars = (priority: string | null) => {
    const stars = priority === 'critical' ? 5 : priority === 'high' ? 4 : priority === 'medium' ? 3 : priority === 'low' ? 2 : 1;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${star <= stars ? 'fill-[#ffcb00] text-[#ffcb00]' : 'text-muted-foreground/20'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(([status, config]) => {
        const columnTasks = getTasksByStatus(status);
        
        return (
          <div
            key={status}
            className="flex-shrink-0 w-72"
            onDrop={(e) => handleDrop(e, status)}
            onDragOver={handleDragOver}
          >
            <Card className="h-full">
              <CardHeader 
                className="py-3 px-4 rounded-t-lg"
                style={{ backgroundColor: config.color }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">{config.label}</span>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                    {columnTasks.length}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="p-2 space-y-2 min-h-[400px] bg-muted/20">
                {columnTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                    style={{ borderLeftColor: config.color }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => onOpenDetail(task)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                      
                      <div className="flex items-center justify-between">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[9px] bg-gradient-to-br from-pink-400 to-pink-600 text-white">
                            {(task.assignee_name || 'E').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {renderPriorityStars(task.priority)}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(task.due_date), 'MMM d')}
                          </div>
                        )}
                        {task.estimated_hours && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.estimated_hours}h
                          </div>
                        )}
                      </div>
                      
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.tags.slice(0, 2).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                  onClick={() => onAddTask({ status, group_name: config.label })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
};
