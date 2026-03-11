import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useState } from 'react';

interface TeamMember {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface FeedLeftPanelProps {
  selectedTeamMember: string | null;
  onTeamMemberSelect: (member: string | null) => void;
  teamMembers: TeamMember[];
  activityCounts: {
    total: number;
    last30Days: number;
    calls: number;
    emails: number;
    sms: number;
    notes: number;
    tasks: number;
    leads: number;
  };
  isSheet?: boolean;
  selectedFilters: Set<string>;
  onFiltersChange: (filters: Set<string>) => void;
  filterCounts: Record<string, number>;
}

const filterOptions = [
  'Email',
  'Phone Call',
  'SMS',
  'Note',
  'New Lead',
  'Task',
  'Stage Change',
];

const FeedLeftPanel = ({
  selectedTeamMember,
  onTeamMemberSelect,
  teamMembers,
  activityCounts,
  isSheet,
  selectedFilters,
  onFiltersChange,
  filterCounts,
}: FeedLeftPanelProps) => {
  const [filterSearch, setFilterSearch] = useState('');

  const filteredOptions = filterOptions.filter(f =>
    f.toLowerCase().includes(filterSearch.toLowerCase())
  );

  const toggleFilter = (filter: string) => {
    const next = new Set(selectedFilters);
    if (next.has(filter)) next.delete(filter);
    else next.add(filter);
    onFiltersChange(next);
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full overflow-hidden',
        isSheet ? 'w-full bg-white' : 'w-[240px] min-w-[240px] bg-white border-r border-gray-200'
      )}
    >
      {/* Welcome section */}
      <div className="px-5 pt-6 pb-4">
        <h2 className="text-[15px] font-semibold text-gray-900 leading-snug">
          Welcome to your Feed,
        </h2>
        <h2 className="text-[15px] font-semibold text-gray-900 leading-snug">
          {selectedTeamMember || 'Team'} 👋
        </h2>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          Your relationships, your activities, the heartbeat of your business. All in one place.
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
          <span><span className="font-semibold text-gray-700">{activityCounts.total}</span> total</span>
          <span><span className="font-semibold text-gray-700">{activityCounts.last30Days}</span> last 30d</span>
        </div>
      </div>


      {/* Filter search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search Filters"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-gray-50 border border-gray-200 rounded-md text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300"
          />
        </div>
      </div>

      {/* Filter list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* All button */}
        <button
          onClick={() => onFiltersChange(new Set())}
          className={cn(
            'w-full text-left px-2.5 py-1.5 text-xs rounded-md mb-0.5 transition-colors',
            selectedFilters.size === 0
              ? 'bg-purple-50 text-purple-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          All
        </button>

        {filteredOptions.map((filter) => (
          <label
            key={filter}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-md cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedFilters.has(filter)}
              onChange={() => toggleFilter(filter)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600"
            />
            <span className="truncate flex-1">{filter}</span>
            {(filterCounts[filter] ?? 0) > 0 && (
              <span className="text-[10px] text-gray-400 font-medium tabular-nums">
                {filterCounts[filter]}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
};

export default FeedLeftPanel;
