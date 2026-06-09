import { useState } from 'react';
import { Task, statusConfig, statusPickerOptions, priorityConfig, taskTypeConfig } from './types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DraggableTh from '@/components/admin/DraggableTh';
import DraggableColumnsContext from '@/components/admin/DraggableColumnsContext';
import { makeColumnDragOverlay, type ColumnHeaderDef } from '@/components/admin/columnDragOverlay';
import { useColumnOrder } from '@/hooks/useColumnOrder';
import { useAutoFitColumns } from '@/hooks/useAutoFitColumns';
import { Trash2, Plus, Building2, Calendar, Mail, Phone, User, CheckSquare, ArrowUpRight, Tag, Clock, FileSearch } from 'lucide-react';
import { format, parseISO } from 'date-fns';

type TaskColumnKey = 'type' | 'customer' | 'dueDate' | 'status' | 'priority';

const TASK_REORDERABLE_COLUMNS: TaskColumnKey[] = ['type', 'customer', 'dueDate', 'status', 'priority'];

const TASK_COLUMN_HEADERS: Record<TaskColumnKey, ColumnHeaderDef> = {
  type:     { icon: Tag,       label: 'Type' },
  customer: { icon: Building2, label: 'Customer' },
  dueDate:  { icon: Calendar,  label: 'Due Date' },
  status:   { icon: Clock,     label: 'Status' },
  priority: { icon: Tag,       label: 'Priority' },
};

interface TaskTableViewProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (task: Partial<Task>) => void;
  onOpenDetail: (task: Task) => void;
  selectedTasks: Set<string>;
  onToggleSelect: (id: string) => void;
  fadingTasks?: Set<string>;
  onComposeEmail?: (leadId: string | null, template?: string) => void | Promise<void>;
}

type SortField = 'title' | 'due_date' | 'status' | 'priority' | 'lead_name' | 'task_type';
type SortDir = 'asc' | 'desc';

const COLUMN_SORT_OPTIONS: Record<string, { label: string; field: SortField; dir: SortDir }[]> = {
  task: [
    { label: 'Name ascending', field: 'title', dir: 'asc' },
    { label: 'Name descending', field: 'title', dir: 'desc' },
  ],
  type: [
    { label: 'Type ascending', field: 'task_type', dir: 'asc' },
    { label: 'Type descending', field: 'task_type', dir: 'desc' },
  ],
  customer: [
    { label: 'Customer ascending', field: 'lead_name', dir: 'asc' },
    { label: 'Customer descending', field: 'lead_name', dir: 'desc' },
  ],
  dueDate: [
    { label: 'Due date ascending', field: 'due_date', dir: 'asc' },
    { label: 'Due date descending', field: 'due_date', dir: 'desc' },
  ],
  status: [
    { label: 'Status ascending', field: 'status', dir: 'asc' },
    { label: 'Status descending', field: 'status', dir: 'desc' },
  ],
  priority: [
    { label: 'Priority ascending', field: 'priority', dir: 'asc' },
    { label: 'Priority descending', field: 'priority', dir: 'desc' },
  ],
};

export const TaskTableView = ({
  tasks,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  onOpenDetail,
  selectedTasks,
  onToggleSelect,
  fadingTasks = new Set(),
}: TaskTableViewProps) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Column widths auto-fit to the longest value in each column (measured from
  // the visible tasks), floored at per-column minimums that keep the header
  // labels from clipping. User drag-resizes win and persist to localStorage.
  // Mirrors the pattern used by Projects/Underwriting/etc.
  const { columnWidths, handleColumnResize } = useAutoFitColumns({
    minWidths: { task: 260, type: 120, customer: 200, dueDate: 150, status: 140, priority: 150 },
    autoFitConfig: {
      task:     { getText: (t: Task) => t.title ?? '', extraPx: 56 },
      type:     { getText: (t: Task) => (taskTypeConfig[t.task_type || 'internal'] || taskTypeConfig.internal).label, extraPx: 48 },
      customer: { getText: (t: Task) => {
        const name = t.lead?.name ?? '';
        const company = t.lead?.company_name ?? '';
        return name.length >= company.length ? name : company;
      }, extraPx: 36 },
      dueDate:  { getText: (t: Task) => (t.due_date ? format(parseISO(t.due_date), 'MMM d, yyyy') : ''), extraPx: 8 },
      status:   { getText: (t: Task) => (statusConfig[t.status || 'todo']?.label ?? ''), extraPx: 40 },
      priority: { getText: (t: Task) => (priorityConfig[t.priority || 'medium']?.label ?? ''), extraPx: 64 },
    },
    data: tasks,
    storageKey: 'tasks-col-widths-v2',
  });

  const { orderedKeys: orderedColumnKeys, reorderableKeys: reorderableColumnKeys, handleDragEnd: handleColumnReorder } = useColumnOrder({
    tableId: 'tasks-table',
    defaultOrder: TASK_REORDERABLE_COLUMNS,
  });

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    onAddTask({ title: newTaskTitle.trim() });
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  // Sort tasks
  const sortedTasks = [...tasks].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'title': return dir * (a.title || '').localeCompare(b.title || '');
      case 'due_date': return dir * ((a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1);
      case 'status': return dir * (a.status || '').localeCompare(b.status || '');
      case 'priority': {
        const order = ['critical', 'high', 'medium', 'low', 'none'];
        return dir * (order.indexOf(a.priority || 'medium') - order.indexOf(b.priority || 'medium'));
      }
      case 'lead_name': return dir * (a.lead?.name || '').localeCompare(b.lead?.name || '');
      case 'task_type': return dir * (a.task_type || '').localeCompare(b.task_type || '');
      default: return 0;
    }
  });

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

  const StatusPill = ({ task }: { task: Task }) => {
    const config = statusConfig[task.status || 'todo'];
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[13px] text-[#202124] dark:text-foreground hover:bg-[#e8eaed] dark:hover:bg-muted/80 transition-colors whitespace-nowrap"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: config.color }}
              aria-hidden
            />
            {config.label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1.5 rounded-xl border" style={{ borderColor: '#c8bdd6' }} align="start">
          <div className="space-y-0.5">
            {statusPickerOptions.map((key) => {
              const cfg = statusConfig[key];
              const isActive = (task.status || 'todo') === key;
              return (
                <button
                  key={key}
                  onClick={() => onUpdateTask(task.id, { status: key, is_completed: key === 'done' })}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-[#202124] dark:text-foreground ${
                    isActive ? 'bg-[#eee6f6] dark:bg-purple-950/40' : 'hover:bg-[#f5f0fa] dark:hover:bg-muted'
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.color }}
                    aria-hidden
                  />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const TaskTypeChip = ({ task }: { task: Task }) => {
    const type = task.task_type || 'internal';
    const cfg = taskTypeConfig[type] || taskTypeConfig.internal;
    const Icon = type === 'call' ? Phone : type === 'email' ? Mail : User;
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[13px] text-[#202124] dark:text-foreground whitespace-nowrap">
        <Icon className="h-3 w-3 text-[#5f6368] dark:text-muted-foreground" />
        {cfg.label}
      </span>
    );
  };

  // Helper function (NOT a React component) — see same pattern in People.tsx.
  const renderColHeader = ({
    reactKey,
    colKey,
    children,
    className: extraClassName,
    style: extraStyle,
  }: {
    reactKey?: string;
    colKey?: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => {
    const widthKey = colKey ?? 'task';
    const width = columnWidths[widthKey] ?? 120;
    const sortOptions = COLUMN_SORT_OPTIONS[widthKey];
    const isMenuOpen = colMenuOpen === widthKey;
    const sortMenu = sortOptions ? (
      <div
        className={`relative ml-auto shrink-0 transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover/col:opacity-100'}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setColMenuOpen(isMenuOpen ? null : widthKey)}
          title="Sort options"
          style={{ color: '#202124', backgroundColor: isMenuOpen ? '#d8cce8' : undefined, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 'bold', lineHeight: 1 }}
          onMouseEnter={(e) => { if (!isMenuOpen) (e.currentTarget as HTMLElement).style.backgroundColor = '#d8cce8'; }}
          onMouseLeave={(e) => { if (!isMenuOpen) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          ⋮
        </button>
        {isMenuOpen && (
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50, backgroundColor: '#fff', border: '1px solid #e4dced', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 220, padding: '4px 0', overflow: 'hidden' }}>
            {sortOptions.map((opt) => (
              <button
                key={`${opt.field}-${opt.dir}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSortField(opt.field);
                  setSortDir(opt.dir);
                  setColMenuOpen(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f5f0fa] transition-colors"
              >
                {opt.dir === 'asc' ? (
                  <span style={{ color: '#3b2778', fontSize: 16 }}>↑</span>
                ) : (
                  <span style={{ color: '#5f6368', fontSize: 16 }}>↓</span>
                )}
                <span style={{ fontSize: 14, color: '#202124' }}>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    ) : null;
    return (
      <DraggableTh
        key={reactKey}
        columnId={widthKey}
        width={width}
        onResize={handleColumnResize}
        draggable={widthKey !== 'task'}
        className={extraClassName}
        style={extraStyle}
        trailing={sortMenu}
      >
        {children}
      </DraggableTh>
    );
  };

  const isAllSelected = tasks.length > 0 && tasks.every(t => selectedTasks.has(t.id));

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead>
          <DraggableColumnsContext
            items={reorderableColumnKeys}
            onDragEnd={handleColumnReorder}
            renderOverlay={makeColumnDragOverlay(TASK_COLUMN_HEADERS, k => columnWidths[k])}
          >
            <tr>
              {renderColHeader({
                reactKey: 'task',
                colKey: 'task',
                className: 'sticky top-0 z-30 group/hdr',
                style: { left: 0, borderLeft: 'none', boxShadow: 'inset -1px 0 0 #c8bdd6, inset 1px 0 0 #c8bdd6, 2px 0 4px -2px rgba(0,0,0,0.15)' },
                children: (
                  <>
                    <div className="shrink-0" title="Select all" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(checked) => {
                          tasks.forEach(t => {
                            if (checked && !selectedTasks.has(t.id)) onToggleSelect(t.id);
                            if (!checked && selectedTasks.has(t.id)) onToggleSelect(t.id);
                          });
                        }}
                        className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                      />
                    </div>
                    <CheckSquare className="h-4 w-4" /> Task
                  </>
                ),
              })}
              {(orderedColumnKeys as TaskColumnKey[]).map((key) => {
                const def = TASK_COLUMN_HEADERS[key];
                const Icon = def.icon;
                return renderColHeader({
                  reactKey: key,
                  colKey: key,
                  className: 'sticky top-0 z-10',
                  children: (<><Icon className="h-4 w-4" /> {def.label}</>),
                });
              })}
            </tr>
          </DraggableColumnsContext>
        </thead>
        <tbody>
          {sortedTasks.length === 0 && !isAddingTask ? (
            <tr>
              <td colSpan={6}>
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted">
                    <FileSearch className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">No tasks found</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                      Click "Add task" below to create one.
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            sortedTasks.map((task) => {
              const isBulkSelected = selectedTasks.has(task.id);
              const isFading = fadingTasks.has(task.id);

              const stickyBg = isBulkSelected
                ? 'bg-[#eee6f6] dark:bg-violet-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-violet-900/40'
                : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

              return (
                <tr
                  key={task.id}
                  onClick={() => onOpenDetail(task)}
                  className={`cursor-pointer transition-all duration-300 group ${
                    isFading
                      ? 'opacity-0 scale-95 translate-x-4'
                      : isBulkSelected
                        ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
                        : task.is_completed
                          ? 'opacity-50 bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                          : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                  }`}
                >
                  {/* Task Name + Checkbox (sticky). Always renders a 2-line content area
                       (title + description-or-placeholder) so every row is the same height
                       whether or not the task has a description. */}
                  <td
                    className={`pl-4 pr-6 py-3 overflow-hidden sticky left-0 z-[5] transition-colors ${stickyBg}`}
                    style={{ width: columnWidths.task, height: 56, border: '1px solid #c8bdd6', borderLeft: 'none', boxShadow: 'inset -1px 0 0 #c8bdd6, inset 1px 0 0 #c8bdd6, 2px 0 4px -2px rgba(0,0,0,0.15)' }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0" title="Complete" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={task.is_completed}
                          onCheckedChange={(checked) => onUpdateTask(task.id, {
                            is_completed: !!checked,
                            status: checked ? 'done' : 'todo',
                          })}
                          className="h-5 w-5 rounded-full border-2 border-[#c8bdd6] data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="relative flex items-center">
                          <p
                            className={`font-semibold text-[#202124] dark:text-foreground truncate text-[13px] leading-tight flex-1 min-w-0 ${task.is_completed ? 'line-through text-[#5f6368]' : ''}`}
                            title={task.title}
                          >
                            {task.title}
                          </p>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                        </div>
                        <p
                          className="text-[11px] text-[#5f6368] dark:text-muted-foreground mt-0.5 truncate max-w-[200px]"
                          title={task.description ?? undefined}
                        >
                          {task.description || ' '}
                        </p>
                      </div>
                    </div>
                  </td>

                  {(orderedColumnKeys as TaskColumnKey[]).map((k) => {
                    const cellStyle: React.CSSProperties = { width: columnWidths[k], border: '1px solid #c8bdd6' };
                    switch (k) {
                      case 'type':
                        return (
                          <td key={k} className="px-4 py-1.5 overflow-hidden whitespace-nowrap" style={cellStyle} onClick={(e) => e.stopPropagation()}>
                            <TaskTypeChip task={task} />
                          </td>
                        );
                      case 'customer':
                        return (
                          <td key={k} className="px-4 py-1.5 overflow-hidden whitespace-nowrap" style={cellStyle}>
                            {task.lead ? (
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                                  <Building2 className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] text-[#202124] dark:text-foreground/80 truncate max-w-[120px] font-medium" title={task.lead.name}>{task.lead.name}</p>
                                  <p className="text-[11px] text-[#5f6368] dark:text-muted-foreground truncate max-w-[120px]" title={task.lead.company_name ?? undefined}>
                                    {task.lead.company_name || ' '}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      case 'dueDate':
                        return (
                          <td key={k} className="px-4 py-1.5 overflow-hidden whitespace-nowrap" style={cellStyle}>
                            {task.due_date ? (
                              <span className="text-[12px] text-muted-foreground tabular-nums">
                                {format(parseISO(task.due_date), 'MMM d, yyyy')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      case 'status':
                        return (
                          <td key={k} className="px-4 py-1.5 overflow-hidden whitespace-nowrap" style={cellStyle} onClick={(e) => e.stopPropagation()}>
                            <StatusPill task={task} />
                          </td>
                        );
                      case 'priority':
                        return (
                          <td key={k} className="px-4 py-1.5 overflow-hidden whitespace-nowrap" style={cellStyle} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                              {renderPriorityIndicator(task.priority)}
                              <button
                                onClick={() => onDeleteTask(task.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Add Task Row */}
      <div className="px-4 py-3 border-t" style={{ borderColor: '#c8bdd6' }}>
        {isAddingTask ? (
          <div className="flex items-center gap-3">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 h-9 rounded-xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') {
                  setIsAddingTask(false);
                  setNewTaskTitle('');
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleAddTask}
              className="h-8 px-4 rounded-full text-xs text-white bg-[#3b2778] hover:bg-[#4a3490]"
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setIsAddingTask(false); setNewTaskTitle(''); }}
              className="h-8 px-4 rounded-full text-xs"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 text-[13px] text-[#3b2778] hover:text-[#4a3490] font-semibold transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add task
          </button>
        )}
      </div>
    </div>
  );
};
