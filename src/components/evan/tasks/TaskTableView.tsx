import { useState } from 'react';
import { Task, statusConfig, priorityConfig, groupColors } from './types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Star, Trash2, Plus, MessageSquare, ExternalLink, Paperclip } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TaskTableViewProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (task: Partial<Task>) => void;
  onOpenDetail: (task: Task) => void;
  selectedTasks: Set<string>;
  onToggleSelect: (id: string) => void;
}

export const TaskTableView = ({
  tasks,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  onOpenDetail,
  selectedTasks,
  onToggleSelect,
}: TaskTableViewProps) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'To Do': true,
    'In Progress': true,
    'Done': true,
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);

  // Group tasks by group_name
  const groups = tasks.reduce((acc, task) => {
    const group = task.group_name || 'To Do';
    if (!acc[group]) acc[group] = [];
    acc[group].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const allGroups = ['To Do', 'In Progress', 'Done', 'Blocked', 'Review'];
  
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleAddTask = (groupName: string) => {
    if (!newTaskTitle.trim()) return;
    onAddTask({ title: newTaskTitle.trim(), group_name: groupName });
    setNewTaskTitle('');
    setAddingToGroup(null);
  };

  const renderPriorityStars = (priority: string | null, taskId: string) => {
    const config = priorityConfig[priority || 'medium'];
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 cursor-pointer transition-colors ${
              star <= config.stars ? 'fill-[#ffcb00] text-[#ffcb00]' : 'text-muted-foreground/20 hover:text-[#ffcb00]/50'
            }`}
            onClick={() => {
              const priorities = ['none', 'low', 'medium', 'high', 'critical'];
              onUpdateTask(taskId, { priority: priorities[star - 1] });
            }}
          />
        ))}
      </div>
    );
  };

  const StatusDropdown = ({ task }: { task: Task }) => (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className={`w-full h-8 px-3 rounded text-xs font-medium ${statusConfig[task.status || 'todo']?.bg} ${statusConfig[task.status || 'todo']?.text} transition-colors hover:opacity-90`}
        >
          {statusConfig[task.status || 'todo']?.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1 z-50 bg-popover" align="start">
        <div className="space-y-1">
          {Object.entries(statusConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => onUpdateTask(task.id, { status: key, is_completed: key === 'done' })}
              className={`w-full h-8 px-3 rounded text-xs font-medium ${config.bg} ${config.text} transition-colors hover:opacity-90`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  const calculateGroupSummary = (groupTasks: Task[]) => {
    const totalHours = groupTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    const statusCounts = groupTasks.reduce((acc, t) => {
      const status = t.status || 'todo';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { totalHours, statusCounts, count: groupTasks.length };
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {allGroups.map((groupName) => {
        const groupTasks = groups[groupName] || [];
        const isExpanded = expandedGroups[groupName] !== false;
        const summary = calculateGroupSummary(groupTasks);
        const groupColor = groupColors[groupName] || '#c4c4c4';

        return (
          <div key={groupName} className="border-b last:border-b-0">
            <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(groupName)}>
              <CollapsibleTrigger asChild>
                <div 
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  style={{ borderLeft: `4px solid ${groupColor}` }}
                >
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  <span className="font-semibold text-sm" style={{ color: groupColor }}>{groupName}</span>
                  <span className="text-xs text-muted-foreground ml-2">{groupTasks.length} items</span>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                {/* Column Headers */}
                <div className="grid grid-cols-[40px_1fr_100px_120px_120px_80px_100px_40px] gap-0 border-y bg-muted/20 text-xs font-medium text-muted-foreground">
                  <div className="p-2"></div>
                  <div className="p-2">Item</div>
                  <div className="p-2 text-center">Person</div>
                  <div className="p-2 text-center">Status</div>
                  <div className="p-2 text-center">Due Date</div>
                  <div className="p-2 text-center">Hours</div>
                  <div className="p-2 text-center">Priority</div>
                  <div className="p-2 text-center">
                    <Plus className="h-4 w-4 mx-auto text-muted-foreground/50" />
                  </div>
                </div>

                {/* Tasks */}
                {groupTasks.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted-foreground italic text-center">
                    No tasks in this group
                  </div>
                ) : (
                  groupTasks.map((task) => (
                    <div
                      key={task.id}
                      className="grid grid-cols-[40px_1fr_100px_120px_120px_80px_100px_40px] gap-0 border-b border-border/50 items-center hover:bg-muted/20 transition-colors group"
                      style={{ borderLeftWidth: '3px', borderLeftColor: statusConfig[task.status || 'todo']?.color }}
                    >
                      <div className="p-2 flex justify-center">
                        <Checkbox 
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={() => onToggleSelect(task.id)}
                          className="h-4 w-4"
                        />
                      </div>

                      <div className="p-2 flex items-center gap-2">
                        <Input
                          value={task.title}
                          onChange={(e) => onUpdateTask(task.id, { title: e.target.value })}
                          className="h-7 border-0 bg-transparent p-0 focus-visible:ring-0 text-sm font-normal flex-1"
                        />
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink 
                            className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground cursor-pointer" 
                            onClick={() => onOpenDetail(task)}
                          />
                          <MessageSquare className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground cursor-pointer" onClick={() => onOpenDetail(task)} />
                        </div>
                      </div>

                      <div className="p-2 flex justify-center">
                        <Avatar className="h-7 w-7 border-2 border-background shadow-sm">
                          <AvatarFallback className="text-[10px] bg-gradient-to-br from-pink-400 to-pink-600 text-white font-medium">
                            {(task.assignee_name || 'E').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="p-2">
                        <StatusDropdown task={task} />
                      </div>

                      <div className="p-2 text-center">
                        <span className="text-xs text-muted-foreground">
                          {task.due_date ? format(parseISO(task.due_date), 'd MMM, h:mm a') : '-'}
                        </span>
                      </div>

                      <div className="p-2 flex justify-center">
                        <Input
                          type="number"
                          step="0.25"
                          min="0"
                          value={task.estimated_hours || ''}
                          onChange={(e) => onUpdateTask(task.id, { estimated_hours: parseFloat(e.target.value) || null })}
                          className="h-7 w-14 text-xs text-center border-0 bg-transparent p-0 focus-visible:ring-0"
                          placeholder="-"
                        />
                      </div>

                      <div className="p-2 flex justify-center">
                        {renderPriorityStars(task.priority, task.id)}
                      </div>

                      <div className="p-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteTask(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}

                {/* Add Item Row */}
                {addingToGroup === groupName ? (
                  <div className="flex items-center gap-2 px-4 py-2 border-b">
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Enter task name..."
                      className="flex-1 h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTask(groupName);
                        if (e.key === 'Escape') {
                          setAddingToGroup(null);
                          setNewTaskTitle('');
                        }
                      }}
                    />
                    <Button size="sm" onClick={() => handleAddTask(groupName)}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddingToGroup(null); setNewTaskTitle(''); }}>Cancel</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingToGroup(groupName)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors w-full"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </button>
                )}

                {/* Summary Row */}
                {groupTasks.length > 0 && (
                  <div className="grid grid-cols-[40px_1fr_100px_120px_120px_80px_100px_40px] gap-0 bg-muted/30 items-center text-xs">
                    <div className="p-2"></div>
                    <div className="p-2"></div>
                    <div className="p-2"></div>
                    <div className="p-2">
                      <div className="flex h-4 rounded overflow-hidden">
                        {Object.entries(summary.statusCounts).map(([status, count]) => {
                          const percentage = (count / summary.count) * 100;
                          return (
                            <div 
                              key={status} 
                              style={{ width: `${percentage}%`, backgroundColor: statusConfig[status]?.color || '#c4c4c4' }}
                              title={`${statusConfig[status]?.label}: ${count}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div className="p-2"></div>
                    <div className="p-2 text-center font-medium">{summary.totalHours || '-'}</div>
                    <div className="p-2"></div>
                    <div className="p-2"></div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
};
