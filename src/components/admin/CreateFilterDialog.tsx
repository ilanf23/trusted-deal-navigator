import { useState, useMemo } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { CalendarIcon, Plus, ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface CustomFilterValues {
  filterName: string;
  activityType: string[];
  interactionsFrom: Date | undefined;
  interactionsTo: Date | undefined;
  lastContactedMin: string;
  lastContactedMax: string;
  inactiveDaysMin: string;
  inactiveDaysMax: string;
  stage: string[];
  daysInStageMin: string;
  daysInStageMax: string;
  status: string[];
  priority: string[];
  ownedBy: string[];
  followed: boolean;
  dateAddedFrom: Date | undefined;
  dateAddedTo: Date | undefined;
  source: string[];
  closeDateFrom: Date | undefined;
  closeDateTo: Date | undefined;
  lossReason: string[];
  company: string;
  valueMin: string;
  valueMax: string;
  tags: string;
  name: string;
  description: string;
  uwNumber: string;
  clientWorkingWithOtherLenders: boolean;
  weeklys: boolean;
}

const defaultValues: CustomFilterValues = {
  filterName: '',
  activityType: [],
  interactionsFrom: undefined,
  interactionsTo: undefined,
  lastContactedMin: '',
  lastContactedMax: '',
  inactiveDaysMin: '',
  inactiveDaysMax: '',
  stage: [],
  daysInStageMin: '',
  daysInStageMax: '',
  status: [],
  priority: [],
  ownedBy: [],
  followed: false,
  dateAddedFrom: undefined,
  dateAddedTo: undefined,
  source: [],
  closeDateFrom: undefined,
  closeDateTo: undefined,
  lossReason: [],
  company: '',
  valueMin: '',
  valueMax: '',
  tags: '',
  name: '',
  description: '',
  uwNumber: '',
  clientWorkingWithOtherLenders: false,
  weeklys: false,
};

interface CreateFilterDialogProps {
  teamMemberMap: Record<string, string>;
  stageConfig: Record<string, { label: string }>;
  onSave: (filter: CustomFilterValues) => void;
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === options.length;

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    );
  };

  const toggleAll = () => {
    onChange(allSelected ? [] : options.map(o => o.value));
  };

  const summary = selected.length === 0
    ? 'Select...'
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
            className={cn(
              "flex items-center justify-between w-full h-8 px-3 rounded-md border border-input bg-background text-xs transition-colors hover:bg-accent",
              selected.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="truncate">{summary}</span>
            <div className="flex items-center gap-1 shrink-0 ml-1">
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
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-xs hover:bg-accent transition-colors"
          >
            <Checkbox
              checked={allSelected}
              className="h-3.5 w-3.5 rounded-sm"
              tabIndex={-1}
            />
            <span className="font-medium">All</span>
          </button>
          <Separator className="my-1" />
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-xs hover:bg-accent transition-colors"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                className="h-3.5 w-3.5 rounded-sm"
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

function DateRangePicker({ label, fromDate, toDate, onFromChange, onToChange }: {
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
            <Button variant="outline" className={cn("h-8 w-full justify-start text-left text-xs font-normal", !fromDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-1.5 h-3 w-3" />
              {fromDate ? format(fromDate, "MM/dd/yyyy") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={fromDate} onSelect={onFromChange} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-8 w-full justify-start text-left text-xs font-normal", !toDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-1.5 h-3 w-3" />
              {toDate ? format(toDate, "MM/dd/yyyy") : "To"}
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

function RangeInput({ label, minVal, maxVal, onMinChange, onMaxChange, placeholder }: {
  label: string;
  minVal: string;
  maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input className="h-8 text-xs" placeholder={placeholder || "Min"} value={minVal} onChange={e => onMinChange(e.target.value)} />
        <Input className="h-8 text-xs" placeholder={placeholder || "Max"} value={maxVal} onChange={e => onMaxChange(e.target.value)} />
      </div>
    </div>
  );
}

function SectionBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="bg-primary/10 text-primary text-[10px] rounded-full px-1.5 font-medium ml-2">
      {count}
    </span>
  );
}

export default function CreateFilterDialog({ teamMemberMap, stageConfig, onSave }: CreateFilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CustomFilterValues>({ ...defaultValues });

  const set = <K extends keyof CustomFilterValues>(key: K, val: CustomFilterValues[K]) =>
    setValues(prev => ({ ...prev, [key]: val }));

  const sectionCounts = useMemo(() => {
    const arr = (v: string[]) => v.length > 0 ? 1 : 0;
    const str = (v: string) => v.trim() !== '' ? 1 : 0;
    const range = (min: string, max: string) => (min.trim() !== '' || max.trim() !== '') ? 1 : 0;
    const dateRange = (from: Date | undefined, to: Date | undefined) => (from !== undefined || to !== undefined) ? 1 : 0;
    const bool = (v: boolean) => v ? 1 : 0;

    return {
      activity:
        arr(values.activityType) +
        dateRange(values.interactionsFrom, values.interactionsTo) +
        range(values.lastContactedMin, values.lastContactedMax) +
        range(values.inactiveDaysMin, values.inactiveDaysMax),
      pipeline:
        arr(values.stage) +
        range(values.daysInStageMin, values.daysInStageMax) +
        arr(values.status) +
        arr(values.priority),
      ownership:
        arr(values.ownedBy) +
        bool(values.followed),
      dates:
        dateRange(values.dateAddedFrom, values.dateAddedTo) +
        dateRange(values.closeDateFrom, values.closeDateTo),
      source:
        arr(values.source) +
        arr(values.lossReason),
      details:
        str(values.company) +
        range(values.valueMin, values.valueMax) +
        str(values.tags) +
        str(values.name) +
        str(values.description) +
        str(values.uwNumber) +
        bool(values.clientWorkingWithOtherLenders) +
        bool(values.weeklys),
    };
  }, [values]);

  const handleSave = () => {
    if (!values.filterName.trim()) {
      return;
    }
    onSave(values);
    setValues({ ...defaultValues });
    setOpen(false);
  };

  const handleCancel = () => {
    setValues({ ...defaultValues });
    setOpen(false);
  };

  const triggerClass = "text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2.5 hover:no-underline";

  const stageOptions = useMemo(() =>
    Object.entries(stageConfig).map(([key, cfg]) => ({ value: key, label: cfg.label })),
    [stageConfig]
  );

  const ownerOptions = useMemo(() =>
    Object.entries(teamMemberMap).map(([id, name]) => ({ value: id, label: name })),
    [teamMemberMap]
  );

  return (
    <>
      <button
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="Add filter"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[420px] max-w-[90vw] p-0 flex flex-col max-h-[75vh] gap-0">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-sm font-semibold">Filter Opportunity</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-5 overflow-y-auto">
            <div className="pb-4">
              {/* Filter Name — always visible */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Filter Name *</Label>
                <Input className="h-8 text-xs" placeholder="Name this filter..." value={values.filterName} onChange={e => set('filterName', e.target.value)} />
              </div>

              <Separator className="my-3" />

              <Accordion type="multiple" className="w-full">
              {/* Activity & Communication */}
              <AccordionItem value="activity" className="border-b border-border/50">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center">
                    Activity & Communication
                    <SectionBadge count={sectionCounts.activity} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <MultiSelect
                    label="Activity Type"
                    options={[
                      { value: 'call', label: 'Call' },
                      { value: 'email', label: 'Email' },
                      { value: 'meeting', label: 'Meeting' },
                      { value: 'note', label: 'Note' },
                      { value: 'task', label: 'Task' },
                    ]}
                    selected={values.activityType}
                    onChange={v => set('activityType', v)}
                  />
                  <DateRangePicker label="Interactions" fromDate={values.interactionsFrom} toDate={values.interactionsTo} onFromChange={d => set('interactionsFrom', d)} onToChange={d => set('interactionsTo', d)} />
                  <RangeInput label="Last Contacted" minVal={values.lastContactedMin} maxVal={values.lastContactedMax} onMinChange={v => set('lastContactedMin', v)} onMaxChange={v => set('lastContactedMax', v)} placeholder="Days" />
                  <RangeInput label="Inactive Days" minVal={values.inactiveDaysMin} maxVal={values.inactiveDaysMax} onMinChange={v => set('inactiveDaysMin', v)} onMaxChange={v => set('inactiveDaysMax', v)} />
                </AccordionContent>
              </AccordionItem>

              {/* Pipeline */}
              <AccordionItem value="pipeline" className="border-b border-border/50">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center">
                    Pipeline
                    <SectionBadge count={sectionCounts.pipeline} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <MultiSelect
                    label="Stage"
                    options={stageOptions}
                    selected={values.stage}
                    onChange={v => set('stage', v)}
                  />
                  <RangeInput label="Days in Stage" minVal={values.daysInStageMin} maxVal={values.daysInStageMax} onMinChange={v => set('daysInStageMin', v)} onMaxChange={v => set('daysInStageMax', v)} />
                  <MultiSelect
                    label="Status"
                    options={[
                      { value: 'open', label: 'Open' },
                      { value: 'won', label: 'Won' },
                      { value: 'lost', label: 'Lost' },
                      { value: 'on_hold', label: 'On Hold' },
                    ]}
                    selected={values.status}
                    onChange={v => set('status', v)}
                  />
                  <MultiSelect
                    label="Priority"
                    options={[
                      { value: 'high', label: 'High' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'low', label: 'Low' },
                    ]}
                    selected={values.priority}
                    onChange={v => set('priority', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Ownership */}
              <AccordionItem value="ownership" className="border-b border-border/50">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center">
                    Ownership
                    <SectionBadge count={sectionCounts.ownership} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <MultiSelect
                    label="Owned By"
                    options={ownerOptions}
                    selected={values.ownedBy}
                    onChange={v => set('ownedBy', v)}
                  />
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">Followed</Label>
                    <Switch checked={values.followed} onCheckedChange={v => set('followed', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Dates */}
              <AccordionItem value="dates" className="border-b border-border/50">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center">
                    Dates
                    <SectionBadge count={sectionCounts.dates} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <DateRangePicker label="Date Added" fromDate={values.dateAddedFrom} toDate={values.dateAddedTo} onFromChange={d => set('dateAddedFrom', d)} onToChange={d => set('dateAddedTo', d)} />
                  <DateRangePicker label="Close Date" fromDate={values.closeDateFrom} toDate={values.closeDateTo} onFromChange={d => set('closeDateFrom', d)} onToChange={d => set('closeDateTo', d)} />
                </AccordionContent>
              </AccordionItem>

              {/* Source & Outcome */}
              <AccordionItem value="source" className="border-b border-border/50">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center">
                    Source & Outcome
                    <SectionBadge count={sectionCounts.source} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <MultiSelect
                    label="Source"
                    options={[
                      { value: 'referral', label: 'Referral' },
                      { value: 'website', label: 'Website' },
                      { value: 'cold_call', label: 'Cold Call' },
                      { value: 'partner', label: 'Partner' },
                      { value: 'other', label: 'Other' },
                    ]}
                    selected={values.source}
                    onChange={v => set('source', v)}
                  />
                  <MultiSelect
                    label="Loss Reason"
                    options={[
                      { value: 'pricing', label: 'Pricing' },
                      { value: 'timing', label: 'Timing' },
                      { value: 'competition', label: 'Competition' },
                      { value: 'no_response', label: 'No Response' },
                      { value: 'other', label: 'Other' },
                    ]}
                    selected={values.lossReason}
                    onChange={v => set('lossReason', v)}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Details */}
              <AccordionItem value="details" className="border-none">
                <AccordionTrigger className={triggerClass}>
                  <span className="flex items-center">
                    Details
                    <SectionBadge count={sectionCounts.details} />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Company</Label>
                    <Input className="h-8 text-xs" placeholder="Company name..." value={values.company} onChange={e => set('company', e.target.value)} />
                  </div>
                  <RangeInput label="Value" minVal={values.valueMin} maxVal={values.valueMax} onMinChange={v => set('valueMin', v)} onMaxChange={v => set('valueMax', v)} placeholder="$" />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Tags</Label>
                    <Input className="h-8 text-xs" placeholder="Comma-separated tags..." value={values.tags} onChange={e => set('tags', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Name</Label>
                    <Input className="h-8 text-xs" placeholder="Contact name..." value={values.name} onChange={e => set('name', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                    <Textarea className="text-xs min-h-[60px]" placeholder="Filter description..." value={values.description} onChange={e => set('description', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">#UW</Label>
                    <Input className="h-8 text-xs" placeholder="#UW number..." value={values.uwNumber} onChange={e => set('uwNumber', e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">Client Working with Other Lenders</Label>
                    <Switch checked={values.clientWorkingWithOtherLenders} onCheckedChange={v => set('clientWorkingWithOtherLenders', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">Weekly's</Label>
                    <Switch checked={values.weeklys} onCheckedChange={v => set('weeklys', v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>

          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!values.filterName.trim()}>Save Filter</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
