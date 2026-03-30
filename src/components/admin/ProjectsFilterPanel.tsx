import { useState, useMemo } from 'react';
import {
  X, ChevronDown, ChevronUp, User, Calendar, CircleDot,
  Tag, FileText, AlertTriangle, GitBranch, Search,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';


// ── Filter values for projects ──
export interface ProjectFilterValues {
  filterName: string;
  ownedBy: string[];
  dateAddedFrom: string;
  dateAddedTo: string;
  status: string[];
  tags: string;
  name: string;
  description: string;
  priority: string[];
  stage: string[];
}

const defaultValues: ProjectFilterValues = {
  filterName: '',
  ownedBy: [],
  dateAddedFrom: '',
  dateAddedTo: '',
  status: [],
  tags: '',
  name: '',
  description: '',
  priority: [],
  stage: [],
};

interface ProjectsFilterPanelProps {
  teamMemberMap: Record<string, string>;
  initialValues?: ProjectFilterValues | null;
  onSave: (filter: ProjectFilterValues) => void;
  onClose: () => void;
}

// ── Section icon map ──
const SECTION_ICONS: Record<string, React.ElementType> = {
  ownedBy: User,
  dateAdded: Calendar,
  status: CircleDot,
  tags: Tag,
  name: FileText,
  description: FileText,
  priority: AlertTriangle,
  stage: GitBranch,
};

// ── Expandable filter row ──
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
  const Icon = SECTION_ICONS[sectionKey] ?? CircleDot;
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

// ── Multi-select with checkboxes ──
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

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent_to_close', label: 'Urgent to Close' },
  { value: 'urgent_to_get_approval', label: 'Urgent to Get Approval' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'refinance', label: 'Refinance' },
];

const STAGE_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'waiting_on_approval', label: 'Waiting on Approval' },
  { value: 'closing_checklist_in_process', label: 'Closing Checklist in Process' },
  { value: 'waiting_on_closing_date', label: 'Waiting on Closing Date' },
  { value: 'closing_scheduled', label: 'Closing Scheduled' },
  { value: 'ts_received_brad_to_discuss', label: "TS's Received/Brad to Discuss" },
];

// ── Helper: build active filter chip descriptors ──
function getActiveChips(
  values: ProjectFilterValues,
  teamMemberMap: Record<string, string>,
): { key: string; label: string; onRemove: (prev: ProjectFilterValues) => ProjectFilterValues }[] {
  const chips: { key: string; label: string; onRemove: (prev: ProjectFilterValues) => ProjectFilterValues }[] = [];

  if (values.ownedBy.length > 0) {
    const names = values.ownedBy.map((id) => teamMemberMap[id] ?? id).join(', ');
    chips.push({ key: 'ownedBy', label: `Owner: ${names}`, onRemove: (p) => ({ ...p, ownedBy: [] }) });
  }
  if (values.dateAddedFrom || values.dateAddedTo) {
    const range = [values.dateAddedFrom, values.dateAddedTo].filter(Boolean).join(' - ');
    chips.push({ key: 'dateAdded', label: `Date: ${range}`, onRemove: (p) => ({ ...p, dateAddedFrom: '', dateAddedTo: '' }) });
  }
  if (values.status.length > 0) {
    const labels = values.status.map((v) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v).join(', ');
    chips.push({ key: 'status', label: `Status: ${labels}`, onRemove: (p) => ({ ...p, status: [] }) });
  }
  if (values.tags) {
    chips.push({ key: 'tags', label: `Tags: ${values.tags}`, onRemove: (p) => ({ ...p, tags: '' }) });
  }
  if (values.name) {
    chips.push({ key: 'name', label: `Name: ${values.name}`, onRemove: (p) => ({ ...p, name: '' }) });
  }
  if (values.description) {
    chips.push({ key: 'description', label: `Desc: ${values.description}`, onRemove: (p) => ({ ...p, description: '' }) });
  }
  if (values.priority.length > 0) {
    const labels = values.priority.map((v) => PRIORITY_OPTIONS.find((o) => o.value === v)?.label ?? v).join(', ');
    chips.push({ key: 'priority', label: `Priority: ${labels}`, onRemove: (p) => ({ ...p, priority: [] }) });
  }
  if (values.stage.length > 0) {
    const labels = values.stage.map((v) => STAGE_OPTIONS.find((o) => o.value === v)?.label ?? v).join(', ');
    chips.push({ key: 'stage', label: `Stage: ${labels}`, onRemove: (p) => ({ ...p, stage: [] }) });
  }

  return chips;
}

export default function ProjectsFilterPanel({
  teamMemberMap,
  initialValues,
  onSave,
  onClose,
}: ProjectsFilterPanelProps) {
  const [values, setValues] = useState<ProjectFilterValues>(initialValues ? { ...initialValues } : { ...defaultValues });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const set = <K extends keyof ProjectFilterValues>(key: K, val: ProjectFilterValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const activeCount = useMemo(
    () =>
      [
        values.ownedBy.length > 0,
        values.dateAddedFrom || values.dateAddedTo,
        values.status.length > 0,
        values.tags,
        values.name,
        values.description,
        values.priority.length > 0,
        values.stage.length > 0,
      ].filter(Boolean).length,
    [values],
  );

  const hasChanges = useMemo(() => JSON.stringify(values) !== JSON.stringify(initialValues ?? defaultValues), [values, initialValues]);

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

  // ── Section active-value helpers ──
  const sectionHasValue: Record<string, boolean> = {
    ownedBy: values.ownedBy.length > 0,
    dateAdded: !!(values.dateAddedFrom || values.dateAddedTo),
    status: values.status.length > 0,
    tags: !!values.tags,
    name: !!values.name,
    description: !!values.description,
    priority: values.priority.length > 0,
    stage: values.stage.length > 0,
  };

  const clearSection: Record<string, () => void> = {
    ownedBy: () => set('ownedBy', []),
    dateAdded: () => setValues((prev) => ({ ...prev, dateAddedFrom: '', dateAddedTo: '' })),
    status: () => set('status', []),
    tags: () => set('tags', ''),
    name: () => set('name', ''),
    description: () => set('description', ''),
    priority: () => set('priority', []),
    stage: () => set('stage', []),
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
              className="filter-chip-enter inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-[11px] font-medium text-[#3b2778] dark:text-[#c4b5fd] max-w-[200px]"
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
          <FilterRow
            sectionKey="ownedBy"
            label="Owned By"
            expanded={expandedRows.has('ownedBy')}
            onToggle={() => toggle('ownedBy')}
            hasActiveValues={sectionHasValue.ownedBy}
            onClear={clearSection.ownedBy}
          >
            <CheckboxSelect options={teamOptions} selected={values.ownedBy} onChange={(v) => set('ownedBy', v)} searchable={teamOptions.length >= 4} />
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
              from={values.dateAddedFrom}
              to={values.dateAddedTo}
              onFromChange={(v) => set('dateAddedFrom', v)}
              onToChange={(v) => set('dateAddedTo', v)}
            />
          </FilterRow>

          <FilterRow
            sectionKey="status"
            label="Status"
            expanded={expandedRows.has('status')}
            onToggle={() => toggle('status')}
            hasActiveValues={sectionHasValue.status}
            onClear={clearSection.status}
          >
            <CheckboxSelect options={STATUS_OPTIONS} selected={values.status} onChange={(v) => set('status', v)} />
          </FilterRow>

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

          <FilterRow
            sectionKey="priority"
            label="Priority"
            expanded={expandedRows.has('priority')}
            onToggle={() => toggle('priority')}
            hasActiveValues={sectionHasValue.priority}
            onClear={clearSection.priority}
          >
            <CheckboxSelect options={PRIORITY_OPTIONS} selected={values.priority} onChange={(v) => set('priority', v)} />
          </FilterRow>

          <FilterRow
            sectionKey="stage"
            label="Project Stage"
            expanded={expandedRows.has('stage')}
            onToggle={() => toggle('stage')}
            hasActiveValues={sectionHasValue.stage}
            onClear={clearSection.stage}
          >
            <CheckboxSelect options={STAGE_OPTIONS} selected={values.stage} onChange={(v) => set('stage', v)} searchable />
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
          disabled={activeCount === 0 && !hasChanges}
          className="px-6 py-2 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-b from-[#4a3290] to-[#3b2778] hover:from-[#3b2778] hover:to-[#2d1d5e] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
        >
          {activeCount > 0 ? `Apply ${activeCount} Filter${activeCount > 1 ? 's' : ''}` : 'Apply Filters'}
        </button>
      </div>
    </aside>
  );
}
