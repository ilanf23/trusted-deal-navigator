import { useState } from 'react';
import { Task, statusConfig, priorityConfig, groupColors } from './types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Circle, Trash2, Plus, ArrowUpRight } from 'lucide-react';
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

  const renderPriorityIndicator = (priority: string | null) => {
    const config = priorityConfig[priority || 'medium'];
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`w-1.5 rounded-full transition-all ${
              level <= Math.ceil(config.stars / 2) 
                ? 'h-3 bg-current opacity-100' 
                : 'h-2 bg-current opacity-20'
            }`}
            style={{ color: config.color }}
          />
        ))}
      </div>
    );
  };

  const StatusPill = ({ task }: { task: Task }) => {
    const config = statusConfig[task.status || 'todo'];
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button 
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 ${config.bg} ${config.text}`}
          >
            {config.label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-2 rounded-xl border-muted-foreground/10" align="start">
          <div className="space-y-1">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => onUpdateTask(task.id, { status: key, is_completed: key === 'done' })}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] ${cfg.bg} ${cfg.text}`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-3">
      {allGroups.map((groupName) => {
        const groupTasks = groups[groupName] || [];
        const isExpanded = expandedGroups[groupName] !== false;
        const groupColor = groupColors[groupName] || '#94a3b8';
        const completedCount = groupTasks.filter(t => t.status === 'done').length;

        return (
          <div 
            key={groupName} 
            className="rounded-2xl border border-muted-foreground/10 bg-card/50 backdrop-blur-sm overflow-hidden"
          >
            <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(groupName)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors">
                  <ChevronRight 
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                  />
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: groupColor }}
                  />
                  <span className="font-semibold text-sm">{groupName}</span>
                  <span className="text-xs text-muted-foreground">
                    {completedCount}/{groupTasks.length}
                  </span>
                  {groupTasks.length > 0 && (
                    <div className="flex-1 max-w-[100px] ml-2">
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${(completedCount / groupTasks.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-2 pb-3">
                  {groupTasks.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-muted-foreground text-center">
                      No tasks yet
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {groupTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-muted/40 ${
                            task.is_completed ? 'opacity-50' : ''
                          }`}
                        >
                          <Checkbox 
                            checked={task.is_completed}
                            onCheckedChange={(checked) => onUpdateTask(task.id, { 
                              is_completed: !!checked, 
                              status: checked ? 'done' : 'todo' 
                            })}
                            className="h-5 w-5 rounded-full border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-medium ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </span>
                              <button
                                onClick={() => onOpenDetail(task)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-muted transition-all"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </div>
                            {task.due_date && (
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(task.due_date), 'MMM d')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {renderPriorityIndicator(task.priority)}
                            
                            <StatusPill task={task} />

                            <Avatar className="h-7 w-7 ring-2 ring-background">
                              <AvatarFallback className="text-[10px] bg-gradient-to-br from-violet-500 to-purple-600 text-white font-medium">
                                {(task.assignee_name || 'E').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            <button
                              onClick={() => onDeleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Task Row */}
                  <div className="px-4 mt-2">
                    {addingToGroup === groupName ? (
                      <div className="flex items-center gap-3 py-2">
                        <Circle className="h-5 w-5 text-muted-foreground/30" />
                        <Input
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="What needs to be done?"
                          className="flex-1 h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/50"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTask(groupName);
                            if (e.key === 'Escape') {
                              setAddingToGroup(null);
                              setNewTaskTitle('');
                            }
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleAddTask(groupName)}
                            className="h-7 px-3 rounded-full text-xs"
                          >
                            Add
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => { setAddingToGroup(null); setNewTaskTitle(''); }}
                            className="h-7 px-3 rounded-full text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingToGroup(groupName)}
                        className="flex items-center gap-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                      >
                        <Plus className="h-4 w-4" />
                        Add task
                      </button>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
};
