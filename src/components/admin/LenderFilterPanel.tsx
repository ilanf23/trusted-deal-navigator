import { useState, useMemo } from 'react';
import {
  X, ChevronDown, ChevronUp, Phone, Clock, Building2,
  DollarSign, MapPin, Tag, User, FileText,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface LenderCustomFilterValues {
  filterName: string;
  institutions: string[];
  lookingFor: string;
  contacts: string[];
  loanSizes: string[];
  states: string[];
  lenderTypes: string[];
  loanTypes: string[];
  callStatus: string[];
  lastContactFrom: string;
  lastContactTo: string;
}

const defaultLenderFilterValues: LenderCustomFilterValues = {
  filterName: '',
  institutions: [],
  lookingFor: '',
  contacts: [],
  loanSizes: [],
  states: [],
  lenderTypes: [],
  loanTypes: [],
  callStatus: [],
  lastContactFrom: '',
  lastContactTo: '',
};

interface LenderFilterPanelProps {
  institutions: string[];
  contacts: string[];
  lenderTypes: string[];
  loanTypes: string[];
  states: string[];
  loanSizes: string[];
  onSave: (filter: LenderCustomFilterValues) => void;
  onClose: () => void;
  initialValues?: LenderCustomFilterValues;
}

const SECTION_ICONS: Record<string, React.ElementType> = {
  institutions: Building2,
  lookingFor: FileText,
  contacts: User,
  loanSizes: DollarSign,
  states: MapPin,
  lenderTypes: Tag,
  loanTypes: Tag,
  callStatus: Phone,
  lastContact: Clock,
};

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

function getActiveChips(
  values: LenderCustomFilterValues,
): { key: string; label: string; onRemove: (prev: LenderCustomFilterValues) => LenderCustomFilterValues }[] {
  const chips: { key: string; label: string; onRemove: (prev: LenderCustomFilterValues) => LenderCustomFilterValues }[] = [];

  if (values.institutions.length > 0) {
    chips.push({
      key: 'institutions',
      label: `Institution: ${values.institutions.join(', ')}`,
      onRemove: (p) => ({ ...p, institutions: [] }),
    });
  }
  if (values.lookingFor) {
    chips.push({
      key: 'lookingFor',
      label: `Looking For: ${values.lookingFor}`,
      onRemove: (p) => ({ ...p, lookingFor: '' }),
    });
  }
  if (values.contacts.length > 0) {
    chips.push({
      key: 'contacts',
      label: `Contact: ${values.contacts.join(', ')}`,
      onRemove: (p) => ({ ...p, contacts: [] }),
    });
  }
  if (values.loanSizes.length > 0) {
    chips.push({
      key: 'loanSizes',
      label: `Loan Size: ${values.loanSizes.join(', ')}`,
      onRemove: (p) => ({ ...p, loanSizes: [] }),
    });
  }
  if (values.states.length > 0) {
    chips.push({
      key: 'states',
      label: `States: ${values.states.join(', ')}`,
      onRemove: (p) => ({ ...p, states: [] }),
    });
  }
  if (values.lenderTypes.length > 0) {
    chips.push({
      key: 'lenderTypes',
      label: `Type: ${values.lenderTypes.join(', ')}`,
      onRemove: (p) => ({ ...p, lenderTypes: [] }),
    });
  }
  if (values.loanTypes.length > 0) {
    chips.push({
      key: 'loanTypes',
      label: `Loans: ${values.loanTypes.join(', ')}`,
      onRemove: (p) => ({ ...p, loanTypes: [] }),
    });
  }
  if (values.callStatus.length > 0) {
    chips.push({
      key: 'callStatus',
      label: `Call: ${values.callStatus.join(', ')}`,
      onRemove: (p) => ({ ...p, callStatus: [] }),
    });
  }
  if (values.lastContactFrom || values.lastContactTo) {
    const range = [values.lastContactFrom, values.lastContactTo].filter(Boolean).join(' – ');
    chips.push({
      key: 'lastContact',
      label: `Last Contact: ${range}`,
      onRemove: (p) => ({ ...p, lastContactFrom: '', lastContactTo: '' }),
    });
  }

  return chips;
}

export default function LenderFilterPanel({
  institutions,
  contacts,
  lenderTypes,
  loanTypes,
  states,
  loanSizes,
  onSave,
  onClose,
  initialValues,
}: LenderFilterPanelProps) {
  const [values, setValues] = useState<LenderCustomFilterValues>(
    initialValues ? { ...initialValues } : { ...defaultLenderFilterValues }
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const set = <K extends keyof LenderCustomFilterValues>(key: K, val: LenderCustomFilterValues[K]) =>
    setValues(prev => ({ ...prev, [key]: val }));

  const activeCount = useMemo(() => [
    values.institutions.length > 0,
    values.lookingFor.length > 0,
    values.contacts.length > 0,
    values.loanSizes.length > 0,
    values.states.length > 0,
    values.lenderTypes.length > 0,
    values.loanTypes.length > 0,
    values.callStatus.length > 0,
    values.lastContactFrom || values.lastContactTo,
  ].filter(Boolean).length, [values]);

  const chips = useMemo(() => getActiveChips(values), [values]);

  const handleApply = () => {
    const filterName = values.filterName.trim() || `Filter (${activeCount} criteria)`;
    onSave({ ...values, filterName });
  };

  const handleReset = () => {
    setValues({ ...defaultLenderFilterValues });
    setExpandedRows(new Set());
  };

  const institutionOptions = institutions.map(i => ({ value: i, label: i }));
  const contactOptions = contacts.map(c => ({ value: c, label: c }));
  const lenderTypeOptions = lenderTypes.map(t => ({ value: t, label: t }));
  const loanTypeOptions = loanTypes.map(t => ({ value: t, label: t }));
  const stateOptions = states.map(s => ({ value: s, label: s }));
  const loanSizeOptions = loanSizes.map(s => ({ value: s, label: s }));
  const callStatusOptions = [
    { value: 'Y', label: 'Called (Y)' },
    { value: 'N', label: 'Not called (N)' },
  ];

  const sectionHasValue: Record<string, boolean> = {
    institutions: values.institutions.length > 0,
    lookingFor: !!values.lookingFor,
    contacts: values.contacts.length > 0,
    loanSizes: values.loanSizes.length > 0,
    states: values.states.length > 0,
    lenderTypes: values.lenderTypes.length > 0,
    loanTypes: values.loanTypes.length > 0,
    callStatus: values.callStatus.length > 0,
    lastContact: !!(values.lastContactFrom || values.lastContactTo),
  };

  const clearSection: Record<string, () => void> = {
    institutions: () => set('institutions', []),
    lookingFor: () => set('lookingFor', ''),
    contacts: () => set('contacts', []),
    loanSizes: () => set('loanSizes', []),
    states: () => set('states', []),
    lenderTypes: () => set('lenderTypes', []),
    loanTypes: () => set('loanTypes', []),
    callStatus: () => set('callStatus', []),
    lastContact: () => setValues(prev => ({ ...prev, lastContactFrom: '', lastContactTo: '' })),
  };

  return (
    <aside className="shrink-0 w-[400px] bg-slate-50 dark:bg-[#1a1a2e] flex flex-col h-full shadow-[-4px_0_12px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.3)] animate-in slide-in-from-right-5 duration-200">
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

      <div className="shrink-0 px-5 py-2.5 border-b border-gray-200/60 dark:border-white/10">
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Filter name (optional)</label>
        <Input
          value={values.filterName}
          onChange={(e) => set('filterName', e.target.value)}
          placeholder="e.g. FL banks open to call-backs"
          className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
        />
      </div>

      <ScrollArea className="flex-1">
        <div>
          <FilterRow
            sectionKey="institutions"
            label="Institution"
            expanded={expandedRows.has('institutions')}
            onToggle={() => toggle('institutions')}
            hasActiveValues={sectionHasValue.institutions}
            onClear={clearSection.institutions}
          >
            <CheckboxSelect
              options={institutionOptions}
              selected={values.institutions}
              onChange={(v) => set('institutions', v)}
              searchable={institutionOptions.length >= 4}
            />
          </FilterRow>

          <FilterRow
            sectionKey="lookingFor"
            label="Looking For"
            expanded={expandedRows.has('lookingFor')}
            onToggle={() => toggle('lookingFor')}
            hasActiveValues={sectionHasValue.lookingFor}
            onClear={clearSection.lookingFor}
          >
            <Input
              value={values.lookingFor}
              onChange={(e) => set('lookingFor', e.target.value)}
              placeholder="Keyword (e.g. multifamily)"
              className="h-8 text-sm rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus-visible:ring-[#3b2778] dark:focus-visible:ring-[#a78bfa]"
            />
          </FilterRow>

          <FilterRow
            sectionKey="contacts"
            label="Contact Name"
            expanded={expandedRows.has('contacts')}
            onToggle={() => toggle('contacts')}
            hasActiveValues={sectionHasValue.contacts}
            onClear={clearSection.contacts}
          >
            <CheckboxSelect
              options={contactOptions}
              selected={values.contacts}
              onChange={(v) => set('contacts', v)}
              searchable={contactOptions.length >= 4}
            />
          </FilterRow>

          <FilterRow
            sectionKey="loanSizes"
            label="Loan Size"
            expanded={expandedRows.has('loanSizes')}
            onToggle={() => toggle('loanSizes')}
            hasActiveValues={sectionHasValue.loanSizes}
            onClear={clearSection.loanSizes}
          >
            <CheckboxSelect
              options={loanSizeOptions}
              selected={values.loanSizes}
              onChange={(v) => set('loanSizes', v)}
            />
          </FilterRow>

          <FilterRow
            sectionKey="states"
            label="States"
            expanded={expandedRows.has('states')}
            onToggle={() => toggle('states')}
            hasActiveValues={sectionHasValue.states}
            onClear={clearSection.states}
          >
            <CheckboxSelect
              options={stateOptions}
              selected={values.states}
              onChange={(v) => set('states', v)}
              searchable={stateOptions.length >= 4}
            />
          </FilterRow>

          <FilterRow
            sectionKey="lenderTypes"
            label="Lender Type"
            expanded={expandedRows.has('lenderTypes')}
            onToggle={() => toggle('lenderTypes')}
            hasActiveValues={sectionHasValue.lenderTypes}
            onClear={clearSection.lenderTypes}
          >
            <CheckboxSelect
              options={lenderTypeOptions}
              selected={values.lenderTypes}
              onChange={(v) => set('lenderTypes', v)}
              searchable={lenderTypeOptions.length >= 4}
            />
          </FilterRow>

          <FilterRow
            sectionKey="loanTypes"
            label="Loan Types"
            expanded={expandedRows.has('loanTypes')}
            onToggle={() => toggle('loanTypes')}
            hasActiveValues={sectionHasValue.loanTypes}
            onClear={clearSection.loanTypes}
          >
            <CheckboxSelect
              options={loanTypeOptions}
              selected={values.loanTypes}
              onChange={(v) => set('loanTypes', v)}
              searchable={loanTypeOptions.length >= 4}
            />
          </FilterRow>

          <FilterRow
            sectionKey="callStatus"
            label="Call Status"
            expanded={expandedRows.has('callStatus')}
            onToggle={() => toggle('callStatus')}
            hasActiveValues={sectionHasValue.callStatus}
            onClear={clearSection.callStatus}
          >
            <CheckboxSelect
              options={callStatusOptions}
              selected={values.callStatus}
              onChange={(v) => set('callStatus', v)}
            />
          </FilterRow>

          <FilterRow
            sectionKey="lastContact"
            label="Last Contact"
            expanded={expandedRows.has('lastContact')}
            onToggle={() => toggle('lastContact')}
            hasActiveValues={sectionHasValue.lastContact}
            onClear={clearSection.lastContact}
          >
            <DateRangeInput
              from={values.lastContactFrom}
              to={values.lastContactTo}
              onFromChange={(v) => set('lastContactFrom', v)}
              onToChange={(v) => set('lastContactTo', v)}
            />
          </FilterRow>
        </div>
      </ScrollArea>

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
