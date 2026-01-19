import { useState } from 'react';
import { Task, TaskActivity, statusConfig } from './types';
import { useTaskActivities } from '@/hooks/useTasksData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { 
  MessageSquare, 
  Clock, 
  Send, 
  Star, 
  CalendarIcon, 
  User, 
  Tag,
  History,
  Paperclip
} from 'lucide-react';

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onAddComment: (taskId: string, content: string) => void;
}

export const TaskDetailDialog = ({
  task,
  open,
  onClose,
  onUpdateTask,
  onAddComment,
}: TaskDetailDialogProps) => {
  const [newComment, setNewComment] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const { data: activities = [] } = useTaskActivities(task?.id || null);

  if (!task) return null;

  const handleSaveTitle = () => {
    if (editedTitle && editedTitle !== task.title) {
      onUpdateTask(task.id, { title: editedTitle });
    }
  };

  const handleSaveDescription = () => {
    if (editedDescription !== task.description) {
      onUpdateTask(task.id, { description: editedDescription });
    }
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      onAddComment(task.id, newComment.trim());
      setNewComment('');
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    onUpdateTask(task.id, { due_date: date?.toISOString() || null });
  };

  const renderPriorityStars = (priority: string | null) => {
    const stars = priority === 'critical' ? 5 : priority === 'high' ? 4 : priority === 'medium' ? 3 : priority === 'low' ? 2 : 1;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 cursor-pointer transition-colors ${
              star <= stars ? 'fill-[#ffcb00] text-[#ffcb00]' : 'text-muted-foreground/30 hover:text-[#ffcb00]/50'
            }`}
            onClick={() => {
              const priorities = ['none', 'low', 'medium', 'high', 'critical'];
              onUpdateTask(task.id, { priority: priorities[star - 1] });
            }}
          />
        ))}
      </div>
    );
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare className="h-4 w-4" />;
      case 'status_change': return <History className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div 
              className="w-3 h-8 rounded"
              style={{ backgroundColor: statusConfig[task.status || 'todo']?.color }}
            />
            <Input
              value={editedTitle || task.title}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              className="text-lg font-semibold border-0 bg-transparent focus-visible:ring-0 p-0"
            />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="updates">
              Updates ({activities.filter(a => a.activity_type === 'comment').length})
            </TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 space-y-4 overflow-y-auto p-1">
            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Status
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => onUpdateTask(task.id, { status: key, is_completed: key === 'done' })}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                      task.status === key 
                        ? `${config.bg} ${config.text} ring-2 ring-offset-2 ring-current`
                        : 'bg-muted hover:opacity-80'
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" /> Assignee
              </label>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-pink-400 to-pink-600 text-white text-xs">
                    {(task.assignee_name || 'E').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Input
                  value={task.assignee_name || ''}
                  onChange={(e) => onUpdateTask(task.id, { assignee_name: e.target.value })}
                  className="max-w-[200px]"
                  placeholder="Assignee name"
                />
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> Due Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    {task.due_date ? format(parseISO(task.due_date), 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={task.due_date ? parseISO(task.due_date) : undefined}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Star className="h-4 w-4" /> Priority
              </label>
              {renderPriorityStars(task.priority)}
            </div>

            {/* Hours */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Estimated Hours
              </label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={task.estimated_hours || ''}
                onChange={(e) => onUpdateTask(task.id, { estimated_hours: parseFloat(e.target.value) || null })}
                className="max-w-[150px]"
                placeholder="Hours"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <Textarea
                value={editedDescription || task.description || ''}
                onChange={(e) => setEditedDescription(e.target.value)}
                onBlur={handleSaveDescription}
                placeholder="Add a description..."
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>

          <TabsContent value="updates" className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {activities
                  .filter(a => a.activity_type === 'comment')
                  .map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {(activity.created_by || 'U').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{activity.created_by}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(activity.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm">{activity.content}</p>
                      </div>
                    </div>
                  ))}
                {activities.filter(a => a.activity_type === 'comment').length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No updates yet. Be the first to comment!
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Comment input */}
            <div className="flex gap-2 pt-4 border-t mt-4">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write an update..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <Button onClick={handleAddComment} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-y-auto">
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 text-sm">
                  <div className="p-1.5 bg-muted rounded">
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{activity.created_by}</span>
                      {activity.activity_type === 'comment' && ' added a comment'}
                      {activity.activity_type === 'status_change' && (
                        <> changed status to <Badge variant="secondary" className="ml-1">{activity.new_value}</Badge></>
                      )}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(activity.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No activity yet
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
