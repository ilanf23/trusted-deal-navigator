import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  CalendarIcon, ChevronDown, X,
  Filter, SlidersHorizontal, MessageSquare, Flag,
  UserCheck, CalendarDays, Lock, Globe,
  RotateCcw, Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import {
  statusPickerOptions,
  statusConfig,
  priorityConfig,
  sourceConfig,
  taskTypeConfig,
} from '../types';
import type {
  SavedTaskFilter,
  SavedTaskFilterInput,
  TaskFilterCriteria,
  FilterVisibility,
} from './types';
import { cleanCriteria } from './applyTaskFilter';

interface TaskFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: SavedTaskFilterInput) => Promise<void> | void;
  /** When set, drawer is in "edit" mode and pre-populates with these values. */
  editingFilter?: SavedTaskFilter | null;
  /** When true, the visibility toggle is hidden and the value is forced to private.
   *  Useful for users who can't publish public filters. */
  forcePrivate?: boolean;
  /** Optional: prefill criteria when creating a new filter (e.g. from current state). */
  initialCriteria?: TaskFilterCriteria;
}

// ── Inlined filter primitives ──

function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = options.length > 0 && selected.length === options.length;

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value],
    );
  };

  const toggleAll = () => {
    onChange(allSelected ? [] : options.map(o => o.value));
  };

  const summary = selected.length === 0
    ? 'Select…'
    : allSelected
      ? 'All'
      : selected.length === 1
        ? options.find(o => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center justify-between w-full h-8 px-3 rounded-md border border-input bg-background text-xs transition-colors hover:bg-accent',
              selected.length === 0 && 'text-muted-foreground',
            )}
          >
            <span className="truncate">{summary}</span>
            <span className="flex items-center gap-1 shrink-0 ml-1">
              {selected.length > 0 && (
                <span
                  role="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-xs hover:bg-accent transition-colors"
          >
            <Checkbox
              checked={allSelected}
              className="h-3.5 w-3.5 rounded-sm data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778] dark:data-[state=checked]:bg-[#a78bfa] dark:data-[state=checked]:border-[#a78bfa]"
              tabIndex={-1}
            />
            <span className="font-medium">All</span>
          </button>
          <Separator className="my-1" />
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-xs hover:bg-accent transition-colors"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                className="h-3.5 w-3.5 rounded-sm data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778] dark:data-[state=checked]:bg-[#a78bfa] dark:data-[state=checked]:border-[#a78bfa]"
                tabIndex={-1}
              />
              <span>{opt.label}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DateRangePickerInline({ label, fromDate, toDate, onFromChange, onToChange }: {
  label: string;
  fromDate: Date | undefined;
  toDate: Date | undefined;
  onFromChange: (d: Date | undefined) => void;
  onToChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('h-8 w-full justify-start text-left text-xs font-normal', !fromDate && 'text-muted-foreground')}>
              <CalendarIcon className="mr-1.5 h-3 w-3" />
              {fromDate ? format(fromDate, 'MM/dd/yyyy') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={fromDate} onSelect={onFromChange} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('h-8 w-full justify-start text-left text-xs font-normal', !toDate && 'text-muted-foreground')}>
              <CalendarIcon className="mr-1.5 h-3 w-3" />
              {toDate ? format(toDate, 'MM/dd/yyyy') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={toDate} onSelect={onToChange} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function RangeNumberInput({ label, minVal, maxVal, onMinChange, onMaxChange }: {
  label: string;
  minVal: string;
  maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input className="h-8 text-xs" placeholder="Min" type="number" value={minVal} onChange={e => onMinChange(e.target.value)} />
        <Input className="h-8 text-xs" placeholder="Max" type="number" value={maxVal} onChange={e => onMaxChange(e.target.value)} />
      </div>
    </div>
  );
}

function SectionIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-center h-7 w-7 rounded-md shrink-0 bg-[#eee6f6] text-[#3b2778] dark:bg-purple-900/50 dark:text-purple-400">
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

// ── Form-state shape (UI-friendly) ──

interface FormState {
  name: string;
  description: string;
  visibility: FilterVisibility;
  status: string[];
  priority: string[];
  source: string[];
  taskType: string[];
  assignedUserIds: string[];
  assignedToMe: boolean;
  tags: string;
  dueFrom: Date | undefined;
  dueTo: Date | undefined;
  createdFrom: Date | undefined;
  createdTo: Date | undefined;
  estMin: string;
  estMax: string;
  includeCompleted: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  visibility: 'private',
  status: [],
  priority: [],
  source: [],
  taskType: [],
  assignedUserIds: [],
  assignedToMe: false,
  tags: '',
  dueFrom: undefined,
  dueTo: undefined,
  createdFrom: undefined,
  createdTo: undefined,
  estMin: '',
  estMax: '',
  includeCompleted: false,
};

const criteriaToForm = (c: TaskFilterCriteria | undefined): Partial<FormState> => {
  if (!c) return {};
  return {
    status: c.status ?? [],
    priority: c.priority ?? [],
    source: c.source ?? [],
    taskType: c.taskType ?? [],
    assignedUserIds: c.assignedUserIds ?? [],
    assignedToMe: !!c.assignedToMe,
    tags: (c.tags ?? []).join(', '),
    dueFrom: c.dueDateRange?.from ? new Date(c.dueDateRange.from) : undefined,
    dueTo: c.dueDateRange?.to ? new Date(c.dueDateRange.to) : undefined,
    createdFrom: c.createdRange?.from ? new Date(c.createdRange.from) : undefined,
    createdTo: c.createdRange?.to ? new Date(c.createdRange.to) : undefined,
    estMin: c.estimatedHoursRange?.min != null ? String(c.estimatedHoursRange.min) : '',
    estMax: c.estimatedHoursRange?.max != null ? String(c.estimatedHoursRange.max) : '',
    includeCompleted: !!c.includeCompleted,
  };
};

const formToCriteria = (s: FormState): TaskFilterCriteria => {
  const tagList = s.tags.split(',').map(t => t.trim()).filter(Boolean);
  const numMin = s.estMin.trim() === '' ? undefined : Number(s.estMin);
  const numMax = s.estMax.trim() === '' ? undefined : Number(s.estMax);
  const criteria: TaskFilterCriteria = {
    status: s.status,
    priority: s.priority,
    source: s.source,
    taskType: s.taskType,
    assignedUserIds: s.assignedUserIds,
    assignedToMe: s.assignedToMe,
    tags: tagList,
    dueDateRange: (s.dueFrom || s.dueTo) ? {
      from: s.dueFrom ? s.dueFrom.toISOString() : undefined,
      to: s.dueTo ? s.dueTo.toISOString() : undefined,
    } : null,
    createdRange: (s.createdFrom || s.createdTo) ? {
      from: s.createdFrom ? s.createdFrom.toISOString() : undefined,
      to: s.createdTo ? s.createdTo.toISOString() : undefined,
    } : null,
    estimatedHoursRange: (numMin != null || numMax != null) ? { min: numMin, max: numMax } : null,
    includeCompleted: s.includeCompleted,
  };
  return cleanCriteria(criteria);
};

// ── Component ──

export default function TaskFilterDrawer({
  open,
  onClose,
  onSave,
  editingFilter,
  forcePrivate,
  initialCriteria,
}: TaskFilterDrawerProps) {
  const { data: assignable = [] } = useAssignableUsers();
  const [saving, setSaving] = useState(false);

  const [values, setValues] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (editingFilter) {
      setValues({
        ...EMPTY_FORM,
        name: editingFilter.name,
        description: editingFilter.description ?? '',
        visibility: forcePrivate ? 'private' : editingFilter.visibility,
        ...criteriaToForm(editingFilter.criteria),
      } as FormState);
    } else {
      setValues({
        ...EMPTY_FORM,
        visibility: forcePrivate ? 'private' : 'private',
        ...criteriaToForm(initialCriteria),
      } as FormState);
    }
  }, [open, editingFilter, forcePrivate, initialCriteria]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setValues(prev => ({ ...prev, [key]: val }));

  const sectionCounts = useMemo(() => {
    const arr = (v: string[]) => (v.length > 0 ? 1 : 0);
    const str = (v: string) => (v.trim() !== '' ? 1 : 0);
    const range = (a: string, b: string) => (a.trim() !== '' || b.trim() !== '' ? 1 : 0);
    const dr = (a?: Date, b?: Date) => (a !== undefined || b !== undefined ? 1 : 0);
    const bool = (b: boolean) => (b ? 1 : 0);
    return {
      classify:
        arr(values.status) + arr(values.priority) + arr(values.source) + arr(values.taskType),
      assignment:
        arr(values.assignedUserIds) + bool(values.assignedToMe),
      dates:
        dr(values.dueFrom, values.dueTo) + dr(values.createdFrom, values.createdTo) + range(values.estMin, values.estMax),
      tags: str(values.tags) + bool(values.includeCompleted),
    };
  }, [values]);

  const totalActive = useMemo(
    () => Object.values(sectionCounts).reduce((s, n) => s + n, 0),
    [sectionCounts],
  );

  const handleSave = async () => {
    if (!values.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: values.name.trim(),
        description: values.description.trim() || null,
        visibility: forcePrivate ? 'private' : values.visibility,
        criteria: formToCriteria(values),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setValues(prev => ({ ...EMPTY_FORM, name: prev.name, visibility: prev.visibility }));
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const triggerClass = 'text-xs font-semibold tracking-wide text-foreground py-2.5 hover:no-underline hover:bg-accent rounded-md p-1';

  const statusOptions = statusPickerOptions.map(s => ({ value: s, label: statusConfig[s]?.label || s }));
  const priorityOptions = Object.entries(priorityConfig).map(([k, v]) => ({ value: k, label: v.label }));
  const sourceOptions = Object.entries(sourceConfig).map(([k, v]) => ({ value: k, label: v.label }));
  const taskTypeOptions = (Object.keys(taskTypeConfig) as Array<keyof typeof taskTypeConfig>).map(k => ({ value: k, label: taskTypeConfig[k].label }));
  const userOptions = assignable.map(u => ({ value: u.id, label: u.name }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="w-[460px] max-w-[90vw] p-0 flex flex-col max-h-[80vh] gap-0 rounded-xl shadow-2xl border-border/60">
        <DialogHeader className="px-5 pt-5 pb-3 bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-[#4a3290] to-[#3b2778] shadow-md">
              <SlidersHorizontal className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold">
                {editingFilter ? 'Edit Filter' : 'New Task Filter'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Build a saved filter for the Tasks page
                {totalActive > 0 && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-[#eee6f6] text-[#3b2778] dark:bg-purple-900/50 dark:text-purple-300 px-1.5 py-0.5 text-[10px] font-semibold">
                    {totalActive} active
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-5 overflow-y-auto">
          <div className="pb-4">
            {/* Identity */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Filter className="h-3 w-3" />
                  Filter Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  className="h-9 text-sm focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
                  placeholder="e.g. High-priority Gmail tasks"
                  value={values.name}
                  onChange={e => set('name', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                <Textarea
                  className="text-xs min-h-[50px]"
                  placeholder="What does this filter show? (optional)"
                  value={values.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>

              {!forcePrivate && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Visibility</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => set('visibility', 'private')}
                      className={cn(
                        'flex items-center justify-center gap-1.5 h-8 rounded-md border text-xs font-medium transition-colors',
                        values.visibility === 'private'
                          ? 'bg-[#eee6f6] dark:bg-purple-950/40 border-[#3b2778] text-[#3b2778] dark:text-purple-300'
                          : 'bg-background border-input text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <Lock className="h-3 w-3" />
                      Private
                    </button>
                    <button
                      type="button"
                      onClick={() => set('visibility', 'public')}
                      className={cn(
                        'flex items-center justify-center gap-1.5 h-8 rounded-md border text-xs font-medium transition-colors',
                        values.visibility === 'public'
                          ? 'bg-[#eee6f6] dark:bg-purple-950/40 border-[#3b2778] text-[#3b2778] dark:text-purple-300'
                          : 'bg-background border-input text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <Globe className="h-3 w-3" />
                      Public
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {values.visibility === 'public'
                      ? 'Public filters appear for everyone in the workspace.'
                      : 'Private filters are only visible to you.'}
                  </p>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <Accordion type="multiple" defaultValue={['classify', 'assignment']} className="w-full">
              <AccordionItem value="classify" className="border-b border-border/50">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center gap-2">
                    <SectionIcon icon={Flag} />
                    Status, Priority, Source & Type
                    {sectionCounts.classify > 0 && (
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold bg-[#eee6f6] text-[#3b2778] dark:bg-purple-900/50 dark:text-purple-300">
                        {sectionCounts.classify}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-1">
                  <MultiSelect label="Status" options={statusOptions} selected={values.status} onChange={v => set('status', v)} />
                  <MultiSelect label="Priority" options={priorityOptions} selected={values.priority} onChange={v => set('priority', v)} />
                  <MultiSelect label="Source" options={sourceOptions} selected={values.source} onChange={v => set('source', v)} />
                  <MultiSelect label="Task Type" options={taskTypeOptions} selected={values.taskType} onChange={v => set('taskType', v)} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="assignment" className="border-b border-border/50">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center gap-2">
                    <SectionIcon icon={UserCheck} />
                    Assignment
                    {sectionCounts.assignment > 0 && (
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold bg-[#eee6f6] text-[#3b2778] dark:bg-purple-900/50 dark:text-purple-300">
                        {sectionCounts.assignment}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">Assigned to me</Label>
                    <Switch checked={values.assignedToMe} onCheckedChange={v => set('assignedToMe', v)} />
                  </div>
                  <MultiSelect
                    label="Assigned to (anyone)"
                    options={userOptions}
                    selected={values.assignedUserIds}
                    onChange={v => set('assignedUserIds', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="dates" className="border-b border-border/50">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center gap-2">
                    <SectionIcon icon={CalendarDays} />
                    Dates & Estimate
                    {sectionCounts.dates > 0 && (
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold bg-[#eee6f6] text-[#3b2778] dark:bg-purple-900/50 dark:text-purple-300">
                        {sectionCounts.dates}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-1">
                  <DateRangePickerInline
                    label="Due Date"
                    fromDate={values.dueFrom}
                    toDate={values.dueTo}
                    onFromChange={d => set('dueFrom', d)}
                    onToChange={d => set('dueTo', d)}
                  />
                  <DateRangePickerInline
                    label="Created"
                    fromDate={values.createdFrom}
                    toDate={values.createdTo}
                    onFromChange={d => set('createdFrom', d)}
                    onToChange={d => set('createdTo', d)}
                  />
                  <RangeNumberInput
                    label="Estimated Hours"
                    minVal={values.estMin}
                    maxVal={values.estMax}
                    onMinChange={v => set('estMin', v)}
                    onMaxChange={v => set('estMax', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="other" className="border-none">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center gap-2">
                    <SectionIcon icon={Tag} />
                    Tags & Completion
                    {sectionCounts.tags > 0 && (
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold bg-[#eee6f6] text-[#3b2778] dark:bg-purple-900/50 dark:text-purple-300">
                        {sectionCounts.tags}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Tags</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Comma-separated tags..."
                      value={values.tags}
                      onChange={e => set('tags', e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">Matches tasks with at least one of these tags.</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Include completed tasks</Label>
                      <p className="text-[11px] text-muted-foreground">By default, completed tasks are hidden.</p>
                    </div>
                    <Switch
                      checked={values.includeCompleted}
                      onCheckedChange={v => set('includeCompleted', v)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!values.name.trim() || saving}
              className="bg-[#3b2778] hover:bg-[#2d1d5e] text-white"
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              {editingFilter ? 'Save changes' : 'Save Filter'}
            </Button>
          </div>
        </div>

        {/* Helper hint when this filter is being created/edited as a tab inside Settings */}
        <span className="sr-only" aria-live="polite">
          <MessageSquare className="hidden" />
        </span>
      </DialogContent>
    </Dialog>
  );
}
