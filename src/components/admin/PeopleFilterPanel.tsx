import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import type { CustomFilterValues } from '@/components/admin/CreateFilterDialog';

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

interface PeopleFilterPanelProps {
  teamMemberMap: Record<string, string>;
  contactTypes: string[];
  onSave: (filter: CustomFilterValues) => void;
  onClose: () => void;
}

// ── Row that expands inline when clicked ──
function FilterRow({
  label,
  actionLabel,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  actionLabel?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-muted/30 transition-colors"
      >
        <span className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground">{label}</span>
        {actionLabel ? (
          <span className="text-[13px] font-medium text-blue-700 dark:text-blue-400">{actionLabel}</span>
        ) : (
          expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="px-6 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Range input (min/max) ──
function RangeInput({
  min,
  max,
  onMinChange,
  onMaxChange,
  placeholder = ['Min', 'Max'],
}: {
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  placeholder?: [string, string];
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={min}
        onChange={(e) => onMinChange(e.target.value)}
        placeholder={placeholder[0]}
        className="h-8 text-sm"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="number"
        value={max}
        onChange={(e) => onMaxChange(e.target.value)}
        placeholder={placeholder[1]}
        className="h-8 text-sm"
      />
    </div>
  );
}

// ── Date range input ──
function DateRangeInput({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className="h-8 text-sm flex-1"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className="h-8 text-sm flex-1"
      />
    </div>
  );
}

// ── Multi-select with checkboxes ──
function CheckboxSelect({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-1.5 max-h-40 overflow-y-auto">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer py-1">
          <Checkbox
            checked={selected.includes(opt.value)}
            onCheckedChange={(checked) => {
              onChange(checked ? [...selected, opt.value] : selected.filter(v => v !== opt.value));
            }}
            className="h-4 w-4"
          />
          <span className="text-sm text-foreground">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function PeopleFilterPanel({
  teamMemberMap,
  contactTypes,
  onSave,
  onClose,
}: PeopleFilterPanelProps) {
  const [values, setValues] = useState<CustomFilterValues>({ ...defaultValues });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggle = (key: string) => setExpandedRow(prev => prev === key ? null : key);
  const set = <K extends keyof CustomFilterValues>(key: K, val: CustomFilterValues[K]) =>
    setValues(prev => ({ ...prev, [key]: val }));

  const activeCount = [
    values.lastContactedMin || values.lastContactedMax,
    values.activityType.length > 0,
    values.inactiveDaysMin || values.inactiveDaysMax,
    values.ownedBy.length > 0,
    values.followed,
    values.dateAddedFrom || values.dateAddedTo,
    values.stage.length > 0,
    values.tags,
    values.name,
    values.description,
    values.company,
  ].filter(Boolean).length;

  const handleApply = () => {
    const filterName = values.filterName.trim() || `Filter (${activeCount} criteria)`;
    onSave({ ...values, filterName });
  };

  const handleReset = () => {
    setValues({ ...defaultValues });
    setExpandedRow(null);
  };

  const teamOptions = Object.entries(teamMemberMap).map(([id, name]) => ({ value: id, label: name }));
  const typeOptions = contactTypes.map(t => ({ value: t, label: t }));

  const ACTIVITY_TYPES = [
    { value: 'call', label: 'Call' },
    { value: 'email', label: 'Email' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'note', label: 'Note' },
    { value: 'task', label: 'Task' },
  ];

  return (
    <aside className="shrink-0 w-[400px] border-l border-border/60 bg-white dark:bg-card flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-border">
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-muted transition-colors"
        >
          <ArrowRight className="h-4 w-4 text-foreground" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">Filter People</h2>
      </div>

      {/* Filter Name */}
      <div className="shrink-0 px-6 py-3 border-b border-border">
        <Input
          value={values.filterName}
          onChange={(e) => set('filterName', e.target.value)}
          placeholder="Filter name (optional)"
          className="h-9 text-sm"
        />
      </div>

      {/* Scrollable filter rows */}
      <ScrollArea className="flex-1">
        {/* ── Section 1: Activity ── */}
        <div className="border-b border-border">
          <FilterRow
            label="Interactions"
            actionLabel="Select Range"
            expanded={expandedRow === 'interactions'}
            onToggle={() => toggle('interactions')}
          >
            <RangeInput
              min={values.inactiveDaysMin}
              max={values.inactiveDaysMax}
              onMinChange={(v) => set('inactiveDaysMin', v)}
              onMaxChange={(v) => set('inactiveDaysMax', v)}
              placeholder={['Min count', 'Max count']}
            />
          </FilterRow>

          <FilterRow
            label="Activity Type"
            expanded={expandedRow === 'activityType'}
            onToggle={() => toggle('activityType')}
          >
            <CheckboxSelect
              options={ACTIVITY_TYPES}
              selected={values.activityType}
              onChange={(v) => set('activityType', v)}
            />
          </FilterRow>

          <FilterRow
            label="Last Contacted"
            actionLabel="Select Date Range"
            expanded={expandedRow === 'lastContacted'}
            onToggle={() => toggle('lastContacted')}
          >
            <DateRangeInput
              from={values.lastContactedMin}
              to={values.lastContactedMax}
              onFromChange={(v) => set('lastContactedMin', v)}
              onToChange={(v) => set('lastContactedMax', v)}
            />
          </FilterRow>

          <FilterRow
            label="Inactive Days"
            actionLabel="Select Range"
            expanded={expandedRow === 'inactiveDays'}
            onToggle={() => toggle('inactiveDays')}
          >
            <RangeInput
              min={values.inactiveDaysMin}
              max={values.inactiveDaysMax}
              onMinChange={(v) => set('inactiveDaysMin', v)}
              onMaxChange={(v) => set('inactiveDaysMax', v)}
              placeholder={['Min days', 'Max days']}
            />
          </FilterRow>
        </div>

        {/* ── Section 2: Ownership ── */}
        <div className="border-b border-border">
          <FilterRow
            label="Owned By"
            expanded={expandedRow === 'ownedBy'}
            onToggle={() => toggle('ownedBy')}
          >
            <CheckboxSelect
              options={teamOptions}
              selected={values.ownedBy}
              onChange={(v) => set('ownedBy', v)}
            />
          </FilterRow>

          <FilterRow
            label="Followed"
            expanded={expandedRow === 'followed'}
            onToggle={() => toggle('followed')}
          >
            <div className="flex items-center gap-2">
              <Switch
                checked={values.followed}
                onCheckedChange={(v) => set('followed', v)}
              />
              <span className="text-sm text-muted-foreground">Only people I follow</span>
            </div>
          </FilterRow>

          <FilterRow
            label="Date Added"
            actionLabel="Select Date Range"
            expanded={expandedRow === 'dateAdded'}
            onToggle={() => toggle('dateAdded')}
          >
            <DateRangeInput
              from={values.dateAddedFrom ? values.dateAddedFrom.toISOString().slice(0, 10) : ''}
              to={values.dateAddedTo ? values.dateAddedTo.toISOString().slice(0, 10) : ''}
              onFromChange={(v) => set('dateAddedFrom', v ? new Date(v) : undefined)}
              onToChange={(v) => set('dateAddedTo', v ? new Date(v) : undefined)}
            />
          </FilterRow>

          <FilterRow
            label="Contact Type"
            expanded={expandedRow === 'contactType'}
            onToggle={() => toggle('contactType')}
          >
            <CheckboxSelect
              options={typeOptions}
              selected={values.stage}
              onChange={(v) => set('stage', v)}
            />
          </FilterRow>
        </div>

        {/* ── Section 3: Tags ── */}
        <div className="border-b border-border">
          <FilterRow
            label="Tags"
            expanded={expandedRow === 'tags'}
            onToggle={() => toggle('tags')}
          >
            <Input
              value={values.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="Enter tags (comma separated)"
              className="h-8 text-sm"
            />
          </FilterRow>
        </div>

        {/* ── Section 4: Location ── */}
        <div className="border-b border-border">
          <FilterRow
            label="City"
            expanded={expandedRow === 'city'}
            onToggle={() => toggle('city')}
          >
            <Input
              value={values.company}
              onChange={(e) => set('company', e.target.value)}
              placeholder="Enter city"
              className="h-8 text-sm"
            />
          </FilterRow>

          <FilterRow
            label="State"
            expanded={expandedRow === 'state'}
            onToggle={() => toggle('state')}
          >
            <Input
              value=""
              onChange={() => {}}
              placeholder="Enter state"
              className="h-8 text-sm"
            />
          </FilterRow>

          <FilterRow
            label="Country"
            expanded={expandedRow === 'country'}
            onToggle={() => toggle('country')}
          >
            <Input
              value=""
              onChange={() => {}}
              placeholder="Enter country"
              className="h-8 text-sm"
            />
          </FilterRow>

          <FilterRow
            label="Zip"
            expanded={expandedRow === 'zip'}
            onToggle={() => toggle('zip')}
          >
            <Input
              value=""
              onChange={() => {}}
              placeholder="Enter zip code"
              className="h-8 text-sm"
            />
          </FilterRow>
        </div>

        {/* ── Section 5: Details ── */}
        <div>
          <FilterRow
            label="Name"
            expanded={expandedRow === 'name'}
            onToggle={() => toggle('name')}
          >
            <Input
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Contains..."
              className="h-8 text-sm"
            />
          </FilterRow>

          <FilterRow
            label="Description"
            expanded={expandedRow === 'description'}
            onToggle={() => toggle('description')}
          >
            <Input
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Contains..."
              className="h-8 text-sm"
            />
          </FilterRow>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-1.5 text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset All
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={activeCount === 0}
          className="bg-[#3b2778] hover:bg-[#2d1d5e] text-white px-6"
        >
          Apply Filter
        </Button>
      </div>
    </aside>
  );
}
