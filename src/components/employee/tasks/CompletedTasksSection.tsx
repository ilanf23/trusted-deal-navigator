import { useState } from 'react';
import { Task, statusConfig, priorityConfig } from './types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, ChevronDown, ChevronRight, Building2, Calendar, RotateCcw, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTeamMember } from '@/hooks/useTeamMember';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CompletedTasksSectionProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onOpenDetail: (task: Task) => void;
}

export const CompletedTasksSection = ({
  tasks,
  onUpdateTask,
  onDeleteTask,
  onOpenDetail,
}: CompletedTasksSectionProps) => {
  const { teamMember } = useTeamMember();
  const [isExpanded, setIsExpanded] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const completedTasks = tasks.filter(t => t.is_completed || t.status === 'done');

  if (completedTasks.length === 0) {
    return null;
  }

  const allSelected = completedTasks.length > 0 && selectedIds.size === completedTasks.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < completedTasks.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(completedTasks.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRestore = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    onUpdateTask(task.id, { is_completed: false, status: 'todo' });
  };

  const handleDelete = (id: string) => {
    onDeleteTask(id);
    setDeletingId(null);
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => onDeleteTask(id));
    setSelectedIds(new Set());
    setIsBulkDeleteOpen(false);
  };

  const renderPriorityIndicator = (priority: string | null) => {
    const config = priorityConfig[priority || 'medium'];
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[13px] text-[#202124] dark:text-foreground whitespace-nowrap">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: config.color }}
          aria-hidden
        />
        {config.label}
      </span>
    );
  };

  return (
    <div className="mt-8">
      {/* Thick Divider Line */}
      <div className="h-1 bg-gradient-to-r from-transparent via-border to-transparent mb-6" />
      
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 group"
        >
          <div className="p-1.5 rounded-lg bg-[#eee6f6] dark:bg-purple-950/40">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-[#3b2778] dark:text-purple-300" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#3b2778] dark:text-purple-300" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#3b2778] dark:text-purple-300" />
            <h3 className="text-lg font-semibold text-foreground">Completed Tasks</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-[#eee6f6] dark:bg-purple-950/40 text-[#3b2778] dark:text-purple-300 text-[13px] font-medium">
              {completedTasks.length}
            </span>
          </div>
        </button>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selectedIds.size} selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedIds.size} completed tasks?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {selectedIds.size} task{selectedIds.size > 1 ? 's' : ''}. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleBulkDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="rounded-xl md:rounded-2xl border bg-white dark:bg-card overflow-x-auto" style={{ borderColor: '#c8bdd6' }}>
          <Table className="min-w-[600px] [&_tbody_td]:overflow-hidden [&_tbody_td]:whitespace-nowrap">
            <TableHeader>
              <TableRow className="hover:bg-transparent" style={{ backgroundColor: '#eee6f6', borderBottom: '1px solid #c8bdd6' }}>
                <TableHead className="w-8 md:w-10">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) {
                        (el as unknown as HTMLInputElement).indeterminate = someSelected;
                      }
                    }}
                    onCheckedChange={toggleSelectAll}
                    className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                  />
                </TableHead>
                <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground">Task Name</TableHead>
                <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground hidden md:table-cell">Assigned To</TableHead>
                <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground hidden lg:table-cell">Related Customer</TableHead>
                <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground">Completed</TableHead>
                <TableHead className="text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground hidden sm:table-cell">Priority</TableHead>
                <TableHead className="w-24 md:w-32 text-right text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedTasks.map((task) => (
                <TableRow
                  key={task.id}
                  className={`group cursor-pointer transition-colors ${
                    selectedIds.has(task.id)
                      ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
                      : 'hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                  }`}
                  onClick={() => onOpenDetail(task)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(task.id)}
                      onCheckedChange={() => toggleSelect(task.id)}
                      className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                    />
                  </TableCell>

                  <TableCell>
                    <span className="text-[13px] font-medium line-through text-[#5f6368] dark:text-muted-foreground">
                      {task.title}
                    </span>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <span className="inline-flex items-center gap-2 pl-0.5 pr-3 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full">
                      <Avatar className="h-5 w-5 md:h-6 md:w-6">
                        <AvatarFallback className="text-[9px] md:text-[10px] bg-[#3b2778] text-white font-medium">
                          {(teamMember?.name || 'Team Member').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[13px] text-[#202124] dark:text-foreground truncate">{teamMember?.name || 'Team Member'}</span>
                    </span>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell">
                    {task.lead ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[13px] text-[#202124] dark:text-foreground truncate max-w-full">
                        <Building2 className="h-3 w-3 text-[#5f6368] dark:text-muted-foreground" />
                        {task.lead.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[13px] text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {task.updated_at ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[13px] text-[#202124] dark:text-foreground tabular-nums">
                        <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 text-[#5f6368] dark:text-muted-foreground" />
                        <span className="hidden sm:inline">{format(parseISO(task.updated_at), 'MMM d, yyyy')}</span>
                        <span className="sm:hidden">{format(parseISO(task.updated_at), 'M/d')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[13px] text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell">
                    {renderPriorityIndicator(task.priority)}
                  </TableCell>

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {/* Restore Button */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => handleRestore(e, task)}
                              className="p-1.5 rounded-lg hover:bg-[#eee6f6] text-muted-foreground hover:text-[#3b2778] transition-all"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Restore task
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* Delete Button with Confirmation */}
                      <AlertDialog open={deletingId === task.id} onOpenChange={(open) => !open && setDeletingId(null)}>
                        <AlertDialogTrigger asChild>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setDeletingId(task.id)}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Delete task
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete completed task?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{task.title}". This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(task.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
