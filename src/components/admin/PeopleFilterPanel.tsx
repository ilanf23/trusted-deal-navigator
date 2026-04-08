import { useState, useMemo } from 'react';
import {
  X, ChevronDown, ChevronUp, MessageSquare, Clock,
  User, Heart, Calendar, Layers, Tag, MapPin, FileText, Search,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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

// ── Section icons ──
const SECTION_ICONS: Record<string, React.ElementType> = {
  interactions: MessageSquare,
  activityType: MessageSquare,
  lastContacted: Clock,
  inactiveDays: Clock,
  ownedBy: User,
  followed: Heart,
  dateAdded: Calendar,
  contactType: Layers,
  tags: Tag,
  city: MapPin,
  state: MapPin,
  country: MapPin,
  zip: MapPin,
  name: FileText,
  description: FileText,
};

// ── Expandable filter row (ProjectsFilterPanel style) ──
function FilterRow({
  sectionKey,
  label,
  expanded,
  onToggle,
  hasActiveValues,
  onClear,
  children,
}: {
  sectionKey: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  hasActiveValues: boolean;
  onClear?: () => void;
  children?: React.ReactNode;
}) {
  const Icon = SECTION_ICONS[sectionKey] ?? FileText;
  return (
    <div className="border-b border-gray-100 dark:border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-5 py-3 text-left hover:bg-gray-100/60 dark:hover:bg-white/[0.04] transition-colors"
      >
        <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
        <span className="flex-1 text-[13px] font-medium text-gray-700 dark:text-gray-200">{label}</span>
        {hasActiveValues && (
          <span className="h-2 w-2 rounded-full bg-[#3b2778] dark:bg-[#a78bfa] shrink-0" />
        )}
        {hasActiveValues && onClear && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClear?.(); } }}
            className="text-[11px] text-[#3b2778] dark:text-[#a78bfa] hover:underline shrink-0"
          >
            Clear
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        )}
      </button>
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: expanded ? '500px' : '0px', opacity: expanded ? 1 : 0 }}
      >
        <div className="px-5 pb-3.5 pt-1 bg-gray-50/50 dark:bg-white/[0.02]">
          {children}
        </div>
      </div>
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
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">{placeholder[0]}</label>
        <Input
          type="number"
          value={min}
          onChange={(e) => onMinChange(e.target.value)}
          placeholder={placeholder[0]}
          className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">{placeholder[1]}</label>
        <Input
          type="number"
          value={max}
          onChange={(e) => onMaxChange(e.target.value)}
          placeholder={placeholder[1]}
          className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
        />
      </div>
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
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
        />
      </div>
    </div>
  );
}

// ── Multi-select with checkboxes (ProjectsFilterPanel style) ──
function CheckboxSelect({
  options,
  selected,
  onChange,
  searchable,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  searchable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="space-y-1">
      {searchable && (
        <div className="mb-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-7 pl-3 text-xs rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
          />
        </div>
      )}
      <div className="space-y-0.5 max-h-40 overflow-y-auto">
        {(() => {
          const allSelected = filtered.length > 0 && filtered.every(o => selected.includes(o.value));
          return (
            <label
              className={`flex items-center gap-2.5 cursor-pointer py-1.5 px-2 rounded-md transition-colors ${
                allSelected ? 'bg-[#ece8f4] dark:bg-[#3b2778]/20' : 'hover:bg-gray-100 dark:hover:bg-white/[0.04]'
              }`}
            >
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => {
                  onChange(checked ? filtered.map(o => o.value) : []);
                }}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778] dark:data-[state=checked]:bg-[#a78bfa] dark:data-[state=checked]:border-[#a78bfa]"
              />
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">(All)</span>
            </label>
          );
        })()}
        {filtered.map((opt) => {
          const isChecked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex items-center gap-2.5 cursor-pointer py-1.5 px-2 rounded-md transition-colors ${
                isChecked ? 'bg-[#ece8f4] dark:bg-[#3b2778]/20' : 'hover:bg-gray-100 dark:hover:bg-white/[0.04]'
              }`}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => {
                  onChange(checked ? [...selected, opt.value] : selected.filter((v) => v !== opt.value));
                }}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778] dark:data-[state=checked]:bg-[#a78bfa] dark:data-[state=checked]:border-[#a78bfa]"
              />
              <span className="text-[13px] text-gray-700 dark:text-gray-200">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' },
];

// ── Active filter chip builder ──
function getActiveChips(
  values: CustomFilterValues,
  teamMemberMap: Record<string, string>,
): { key: string; label: string; onRemove: (prev: CustomFilterValues) => CustomFilterValues }[] {
  const chips: { key: string; label: string; onRemove: (prev: CustomFilterValues) => CustomFilterValues }[] = [];

  if (values.activityType.length > 0) {
    const labels = values.activityType.map(v => ACTIVITY_TYPES.find(o => o.value === v)?.label ?? v).join(', ');
    chips.push({ key: 'activityType', label: `Activity: ${labels}`, onRemove: (p) => ({ ...p, activityType: [] }) });
  }
  if (values.lastContactedMin || values.lastContactedMax) {
    const range = [values.lastContactedMin, values.lastContactedMax].filter(Boolean).join(' - ');
    chips.push({ key: 'lastContacted', label: `Last Contacted: ${range}`, onRemove: (p) => ({ ...p, lastContactedMin: '', lastContactedMax: '' }) });
  }
  if (values.inactiveDaysMin || values.inactiveDaysMax) {
    const range = [values.inactiveDaysMin, values.inactiveDaysMax].filter(Boolean).join(' - ');
    chips.push({ key: 'inactiveDays', label: `Inactive: ${range}d`, onRemove: (p) => ({ ...p, inactiveDaysMin: '', inactiveDaysMax: '' }) });
  }
  if (values.ownedBy.length > 0) {
    const names = values.ownedBy.map((id) => teamMemberMap[id] ?? id).join(', ');
    chips.push({ key: 'ownedBy', label: `Owner: ${names}`, onRemove: (p) => ({ ...p, ownedBy: [] }) });
  }
  if (values.followed) {
    chips.push({ key: 'followed', label: 'Followed', onRemove: (p) => ({ ...p, followed: false }) });
  }
  if (values.dateAddedFrom || values.dateAddedTo) {
    const range = [
      values.dateAddedFrom ? values.dateAddedFrom.toISOString().slice(0, 10) : '',
      values.dateAddedTo ? values.dateAddedTo.toISOString().slice(0, 10) : '',
    ].filter(Boolean).join(' - ');
    chips.push({ key: 'dateAdded', label: `Date: ${range}`, onRemove: (p) => ({ ...p, dateAddedFrom: undefined, dateAddedTo: undefined }) });
  }
  if (values.stage.length > 0) {
    chips.push({ key: 'contactType', label: `Type: ${values.stage.join(', ')}`, onRemove: (p) => ({ ...p, stage: [] }) });
  }
  if (values.tags) {
    chips.push({ key: 'tags', label: `Tags: ${values.tags}`, onRemove: (p) => ({ ...p, tags: '' }) });
  }
  if (values.company) {
    chips.push({ key: 'city', label: `City: ${values.company}`, onRemove: (p) => ({ ...p, company: '' }) });
  }
  if (values.name) {
    chips.push({ key: 'name', label: `Name: ${values.name}`, onRemove: (p) => ({ ...p, name: '' }) });
  }
  if (values.description) {
    chips.push({ key: 'description', label: `Desc: ${values.description}`, onRemove: (p) => ({ ...p, description: '' }) });
  }

  return chips;
}

export default function PeopleFilterPanel({
  teamMemberMap,
  contactTypes,
  onSave,
  onClose,
}: PeopleFilterPanelProps) {
  const [values, setValues] = useState<CustomFilterValues>({ ...defaultValues });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const set = <K extends keyof CustomFilterValues>(key: K, val: CustomFilterValues[K]) =>
    setValues(prev => ({ ...prev, [key]: val }));

  const activeCount = useMemo(() => [
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
  ].filter(Boolean).length, [values]);

  const chips = useMemo(() => getActiveChips(values, teamMemberMap), [values, teamMemberMap]);

  const handleApply = () => {
    const filterName = values.filterName.trim() || `Filter (${activeCount} criteria)`;
    onSave({ ...values, filterName });
  };

  const handleReset = () => {
    setValues({ ...defaultValues });
    setExpandedRows(new Set());
  };

  const teamOptions = Object.entries(teamMemberMap).map(([id, name]) => ({ value: id, label: name }));
  const typeOptions = contactTypes.map(t => ({ value: t, label: t }));

  // ── Section active-value helpers ──
  const sectionHasValue: Record<string, boolean> = {
    interactions: !!(values.inactiveDaysMin || values.inactiveDaysMax),
    activityType: values.activityType.length > 0,
    lastContacted: !!(values.lastContactedMin || values.lastContactedMax),
    inactiveDays: !!(values.inactiveDaysMin || values.inactiveDaysMax),
    ownedBy: values.ownedBy.length > 0,
    followed: values.followed,
    dateAdded: !!(values.dateAddedFrom || values.dateAddedTo),
    contactType: values.stage.length > 0,
    tags: !!values.tags,
    city: !!values.company,
    name: !!values.name,
    description: !!values.description,
  };

  const clearSection: Record<string, () => void> = {
    interactions: () => setValues(prev => ({ ...prev, inactiveDaysMin: '', inactiveDaysMax: '' })),
    activityType: () => set('activityType', []),
    lastContacted: () => setValues(prev => ({ ...prev, lastContactedMin: '', lastContactedMax: '' })),
    inactiveDays: () => setValues(prev => ({ ...prev, inactiveDaysMin: '', inactiveDaysMax: '' })),
    ownedBy: () => set('ownedBy', []),
    followed: () => set('followed', false),
    dateAdded: () => setValues(prev => ({ ...prev, dateAddedFrom: undefined, dateAddedTo: undefined })),
    contactType: () => set('stage', []),
    tags: () => set('tags', ''),
    city: () => set('company', ''),
    name: () => set('name', ''),
    description: () => set('description', ''),
  };

  return (
    <aside className="shrink-0 w-[400px] bg-slate-50 dark:bg-[#1a1a2e] flex flex-col h-full shadow-[-4px_0_12px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.3)] animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 dark:border-white/10" style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }}>
        <h2 className="flex-1 text-[13px] font-semibold capitalize tracking-wider text-[#3b2778] dark:text-gray-100">Filters</h2>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#3b2778] dark:bg-[#a78bfa] text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* ── Active filter chips ── */}
      {chips.length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-1.5 px-5 py-2.5 border-b border-gray-200/60 dark:border-white/10">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-[11px] font-medium text-[#3b2778] dark:text-[#c4b5fd] max-w-[200px]"
            >
              <span className="truncate">{chip.label}</span>
              <button
                type="button"
                onClick={() => setValues((prev) => chip.onRemove(prev))}
                className="shrink-0 h-3.5 w-3.5 flex items-center justify-center rounded-full hover:bg-gray-300 dark:hover:bg-white/20 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Scrollable filter sections ── */}
      <ScrollArea className="flex-1">
        <div>
          {/* ── Section: Activity ── */}
          <FilterRow
            sectionKey="interactions"
            label="Interactions"
            expanded={expandedRows.has('interactions')}
            onToggle={() => toggle('interactions')}
            hasActiveValues={sectionHasValue.interactions}
            onClear={clearSection.interactions}
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
            sectionKey="activityType"
            label="Activity Type"
            expanded={expandedRows.has('activityType')}
            onToggle={() => toggle('activityType')}
            hasActiveValues={sectionHasValue.activityType}
            onClear={clearSection.activityType}
          >
            <CheckboxSelect
              options={ACTIVITY_TYPES}
              selected={values.activityType}
              onChange={(v) => set('activityType', v)}
            />
          </FilterRow>

          <FilterRow
            sectionKey="lastContacted"
            label="Last Contacted"
            expanded={expandedRows.has('lastContacted')}
            onToggle={() => toggle('lastContacted')}
            hasActiveValues={sectionHasValue.lastContacted}
            onClear={clearSection.lastContacted}
          >
            <DateRangeInput
              from={values.lastContactedMin}
              to={values.lastContactedMax}
              onFromChange={(v) => set('lastContactedMin', v)}
              onToChange={(v) => set('lastContactedMax', v)}
            />
          </FilterRow>

          <FilterRow
            sectionKey="inactiveDays"
            label="Inactive Days"
            expanded={expandedRows.has('inactiveDays')}
            onToggle={() => toggle('inactiveDays')}
            hasActiveValues={sectionHasValue.inactiveDays}
            onClear={clearSection.inactiveDays}
          >
            <RangeInput
              min={values.inactiveDaysMin}
              max={values.inactiveDaysMax}
              onMinChange={(v) => set('inactiveDaysMin', v)}
              onMaxChange={(v) => set('inactiveDaysMax', v)}
              placeholder={['Min days', 'Max days']}
            />
          </FilterRow>

          {/* ── Section: Ownership ── */}
          <FilterRow
            sectionKey="ownedBy"
            label="Owned By"
            expanded={expandedRows.has('ownedBy')}
            onToggle={() => toggle('ownedBy')}
            hasActiveValues={sectionHasValue.ownedBy}
            onClear={clearSection.ownedBy}
          >
            <CheckboxSelect
              options={teamOptions}
              selected={values.ownedBy}
              onChange={(v) => set('ownedBy', v)}
              searchable={teamOptions.length >= 4}
            />
          </FilterRow>

          <FilterRow
            sectionKey="followed"
            label="Followed"
            expanded={expandedRows.has('followed')}
            onToggle={() => toggle('followed')}
            hasActiveValues={sectionHasValue.followed}
            onClear={clearSection.followed}
          >
            <div className="flex items-center gap-2">
              <Switch
                checked={values.followed}
                onCheckedChange={(v) => set('followed', v)}
              />
              <span className="text-[13px] text-gray-600 dark:text-gray-300">Only people I follow</span>
            </div>
          </FilterRow>

          <FilterRow
            sectionKey="dateAdded"
            label="Date Added"
            expanded={expandedRows.has('dateAdded')}
            onToggle={() => toggle('dateAdded')}
            hasActiveValues={sectionHasValue.dateAdded}
            onClear={clearSection.dateAdded}
          >
            <DateRangeInput
              from={values.dateAddedFrom ? values.dateAddedFrom.toISOString().slice(0, 10) : ''}
              to={values.dateAddedTo ? values.dateAddedTo.toISOString().slice(0, 10) : ''}
              onFromChange={(v) => set('dateAddedFrom', v ? new Date(v) : undefined)}
              onToChange={(v) => set('dateAddedTo', v ? new Date(v) : undefined)}
            />
          </FilterRow>

          <FilterRow
            sectionKey="contactType"
            label="Contact Type"
            expanded={expandedRows.has('contactType')}
            onToggle={() => toggle('contactType')}
            hasActiveValues={sectionHasValue.contactType}
            onClear={clearSection.contactType}
          >
            <CheckboxSelect
              options={typeOptions}
              selected={values.stage}
              onChange={(v) => set('stage', v)}
              searchable={typeOptions.length >= 4}
            />
          </FilterRow>

          {/* ── Section: Tags ── */}
          <FilterRow
            sectionKey="tags"
            label="Tags"
            expanded={expandedRows.has('tags')}
            onToggle={() => toggle('tags')}
            hasActiveValues={sectionHasValue.tags}
            onClear={clearSection.tags}
          >
            <Input
              value={values.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="Enter tags (comma separated)"
              className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
            />
          </FilterRow>

          {/* ── Section: Location ── */}
          <FilterRow
            sectionKey="city"
            label="City"
            expanded={expandedRows.has('city')}
            onToggle={() => toggle('city')}
            hasActiveValues={sectionHasValue.city}
            onClear={clearSection.city}
          >
            <Input
              value={values.company}
              onChange={(e) => set('company', e.target.value)}
              placeholder="Enter city"
              className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
            />
          </FilterRow>

          {/* ── Section: Details ── */}
          <FilterRow
            sectionKey="name"
            label="Name"
            expanded={expandedRows.has('name')}
            onToggle={() => toggle('name')}
            hasActiveValues={sectionHasValue.name}
            onClear={clearSection.name}
          >
            <Input
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Contains..."
              className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
            />
          </FilterRow>

          <FilterRow
            sectionKey="description"
            label="Description"
            expanded={expandedRows.has('description')}
            onToggle={() => toggle('description')}
            hasActiveValues={sectionHasValue.description}
            onClear={clearSection.description}
          >
            <Input
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Contains..."
              className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
            />
          </FilterRow>
        </div>
      </ScrollArea>

      {/* ── Footer ── */}
      <div className="shrink-0 px-5 py-3 flex items-center justify-between shadow-[0_-2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_-2px_8px_rgba(0,0,0,0.2)]">
        <button
          type="button"
          onClick={handleReset}
          className="text-[13px] text-gray-500 dark:text-gray-400 underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Reset all
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={activeCount === 0}
          className="px-6 py-2 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-b from-[#4a3290] to-[#3b2778] hover:from-[#3b2778] hover:to-[#2d1d5e] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
        >
          {activeCount > 0 ? `Apply ${activeCount} Filter${activeCount > 1 ? 's' : ''}` : 'Apply Filters'}
        </button>
      </div>
    </aside>
  );
}
