import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface CustomFilterValues {
  filterName: string;
  activityType: string;
  interactionsFrom: Date | undefined;
  interactionsTo: Date | undefined;
  lastContactedMin: string;
  lastContactedMax: string;
  inactiveDaysMin: string;
  inactiveDaysMax: string;
  stage: string;
  daysInStageMin: string;
  daysInStageMax: string;
  status: string;
  priority: string;
  ownedBy: string;
  followed: boolean;
  dateAddedFrom: Date | undefined;
  dateAddedTo: Date | undefined;
  source: string;
  closeDateFrom: Date | undefined;
  closeDateTo: Date | undefined;
  lossReason: string;
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
  activityType: '',
  interactionsFrom: undefined,
  interactionsTo: undefined,
  lastContactedMin: '',
  lastContactedMax: '',
  inactiveDaysMin: '',
  inactiveDaysMax: '',
  stage: '',
  daysInStageMin: '',
  daysInStageMax: '',
  status: '',
  priority: '',
  ownedBy: '',
  followed: false,
  dateAddedFrom: undefined,
  dateAddedTo: undefined,
  source: '',
  closeDateFrom: undefined,
  closeDateTo: undefined,
  lossReason: '',
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMemberMap: Record<string, string>;
  stageConfig: Record<string, { label: string }>;
  onSave: (filter: CustomFilterValues) => void;
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
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-8 flex-1 justify-start text-left text-xs font-normal", !fromDate && "text-muted-foreground")}>
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
            <Button variant="outline" className={cn("h-8 flex-1 justify-start text-left text-xs font-normal", !toDate && "text-muted-foreground")}>
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
      <div className="flex gap-2">
        <Input className="h-8 text-xs flex-1" placeholder={placeholder || "Min"} value={minVal} onChange={e => onMinChange(e.target.value)} />
        <Input className="h-8 text-xs flex-1" placeholder={placeholder || "Max"} value={maxVal} onChange={e => onMaxChange(e.target.value)} />
      </div>
    </div>
  );
}

export default function CreateFilterDialog({ open, onOpenChange, teamMemberMap, stageConfig, onSave }: CreateFilterDialogProps) {
  const [values, setValues] = useState<CustomFilterValues>({ ...defaultValues });

  const set = <K extends keyof CustomFilterValues>(key: K, val: CustomFilterValues[K]) =>
    setValues(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!values.filterName.trim()) {
      return;
    }
    onSave(values);
    setValues({ ...defaultValues });
    onOpenChange(false);
  };

  const handleCancel = () => {
    setValues({ ...defaultValues });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-base font-semibold">Filter Opportunity</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 overflow-y-auto">
          <div className="space-y-4 pb-4">
            {/* Filter Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Filter Name *</Label>
              <Input className="h-8 text-xs" placeholder="Name this filter..." value={values.filterName} onChange={e => set('filterName', e.target.value)} />
            </div>

            <Separator />

            {/* Activity Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Activity Type</Label>
              <Select value={values.activityType} onValueChange={v => set('activityType', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Interactions - Date Range */}
            <DateRangePicker label="Interactions" fromDate={values.interactionsFrom} toDate={values.interactionsTo} onFromChange={d => set('interactionsFrom', d)} onToChange={d => set('interactionsTo', d)} />

            {/* Last Contacted - Range */}
            <RangeInput label="Last Contacted" minVal={values.lastContactedMin} maxVal={values.lastContactedMax} onMinChange={v => set('lastContactedMin', v)} onMaxChange={v => set('lastContactedMax', v)} placeholder="Days" />

            {/* Inactive Days */}
            <RangeInput label="Inactive Days" minVal={values.inactiveDaysMin} maxVal={values.inactiveDaysMax} onMinChange={v => set('inactiveDaysMin', v)} onMaxChange={v => set('inactiveDaysMax', v)} />

            {/* Stage */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Stage</Label>
              <Select value={values.stage} onValueChange={v => set('stage', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(stageConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Days in Stage */}
            <RangeInput label="Days in Stage" minVal={values.daysInStageMin} maxVal={values.daysInStageMax} onMinChange={v => set('daysInStageMin', v)} onMaxChange={v => set('daysInStageMax', v)} />

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={values.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
              <Select value={values.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Owned By */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Owned By</Label>
              <Select value={values.ownedBy} onValueChange={v => set('ownedBy', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(teamMemberMap).map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Followed */}
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Followed</Label>
              <Switch checked={values.followed} onCheckedChange={v => set('followed', v)} />
            </div>

            {/* Date Added */}
            <DateRangePicker label="Date Added" fromDate={values.dateAddedFrom} toDate={values.dateAddedTo} onFromChange={d => set('dateAddedFrom', d)} onToChange={d => set('dateAddedTo', d)} />

            {/* Source */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Source</Label>
              <Select value={values.source} onValueChange={v => set('source', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Close Date */}
            <DateRangePicker label="Close Date" fromDate={values.closeDateFrom} toDate={values.closeDateTo} onFromChange={d => set('closeDateFrom', d)} onToChange={d => set('closeDateTo', d)} />

            {/* Loss Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Loss Reason</Label>
              <Select value={values.lossReason} onValueChange={v => set('lossReason', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pricing">Pricing</SelectItem>
                  <SelectItem value="timing">Timing</SelectItem>
                  <SelectItem value="competition">Competition</SelectItem>
                  <SelectItem value="no_response">No Response</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Company */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Company</Label>
              <Input className="h-8 text-xs" placeholder="Company name..." value={values.company} onChange={e => set('company', e.target.value)} />
            </div>

            {/* Value */}
            <RangeInput label="Value" minVal={values.valueMin} maxVal={values.valueMax} onMinChange={v => set('valueMin', v)} onMaxChange={v => set('valueMax', v)} placeholder="$" />

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Tags</Label>
              <Input className="h-8 text-xs" placeholder="Comma-separated tags..." value={values.tags} onChange={e => set('tags', e.target.value)} />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Name</Label>
              <Input className="h-8 text-xs" placeholder="Contact name..." value={values.name} onChange={e => set('name', e.target.value)} />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Description</Label>
              <Textarea className="text-xs min-h-[60px]" placeholder="Filter description..." value={values.description} onChange={e => set('description', e.target.value)} />
            </div>

            {/* #UW */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">#UW</Label>
              <Input className="h-8 text-xs" placeholder="#UW number..." value={values.uwNumber} onChange={e => set('uwNumber', e.target.value)} />
            </div>

            {/* Client Working with Other Lenders */}
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Client Working with Other Lenders</Label>
              <Switch checked={values.clientWorkingWithOtherLenders} onCheckedChange={v => set('clientWorkingWithOtherLenders', v)} />
            </div>

            {/* Weekly's */}
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Weekly's</Label>
              <Switch checked={values.weeklys} onCheckedChange={v => set('weeklys', v)} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!values.filterName.trim()}>Save Filter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
