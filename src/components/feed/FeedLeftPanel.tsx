import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Search } from 'lucide-react';
import type { TeamMember } from '@/hooks/useTeamMember';

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
    if (selectedFilters.has(filter)) {
      onFiltersChange(new Set());
    } else {
      onFiltersChange(new Set([filter]));
    }
  };

  return (
    <div
      className={cn(
        'px-5 py-6 flex flex-col h-full overflow-hidden',
        isSheet ? 'w-full bg-white' : 'w-[240px] min-w-[240px] bg-white border-r border-gray-200'
      )}
    >
      {/* Welcome heading */}
      <h2 className="text-xl font-bold text-foreground leading-tight">
        Welcome to your Feed, {selectedTeamMember || 'Team'} 👋
      </h2>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed mt-3">
        Your relationships, your activities, the heartbeat of your business. All in one place.
      </p>

      {/* Divider */}
      <div className="border-b border-border my-4" />

      {/* Team member buttons */}
      <div className="flex items-center gap-3">
        {teamMembers.map((member) => (
          <button
            key={member.id}
            onClick={() => onTeamMemberSelect(selectedTeamMember === member.name ? null : member.name)}
            className={cn(
              'w-10 h-10 rounded-full border-2 bg-transparent font-medium text-sm flex items-center justify-center transition-colors',
              selectedTeamMember === member.name
                ? 'border-violet-500 text-violet-700 bg-violet-50'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            )}
            title={member.name}
          >
            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search Filters"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-300"
        />
      </div>

      {/* All button */}
      <button
        onClick={() => onFiltersChange(new Set())}
        className={cn(
          'w-full text-left mt-3 transition-colors',
          selectedFilters.size === 0
            ? 'px-3 py-2 rounded-lg bg-violet-50 text-violet-600 font-medium text-sm'
            : 'px-3 py-1.5 text-sm text-slate-600 cursor-pointer hover:text-slate-900 rounded-lg'
        )}
      >
        All
      </button>

      {/* Filter list */}
      <div className="mt-1 space-y-0.5 flex-1 overflow-y-auto pb-4">
        {filteredOptions.map((filter) => (
          <button
            key={filter}
            onClick={() => toggleFilter(filter)}
            className={cn(
              'w-full text-left transition-colors',
              selectedFilters.has(filter)
                ? 'px-3 py-2 rounded-lg bg-violet-50 text-violet-600 font-medium text-sm'
                : 'px-3 py-1.5 text-sm text-slate-600 cursor-pointer hover:text-slate-900 rounded-lg'
            )}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FeedLeftPanel;
