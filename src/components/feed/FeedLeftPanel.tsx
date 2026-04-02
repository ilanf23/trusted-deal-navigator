import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTeamMember, type TeamMember } from '@/hooks/useTeamMember';

interface FeedLeftPanelProps {
  selectedTeamMembers: Set<string>;
  onTeamMembersChange: (members: Set<string>) => void;
  teamMembers: TeamMember[];
  isSheet?: boolean;
  selectedFilters: Set<string>;
  onFiltersChange: (filters: Set<string>) => void;
}

const filterOptions = [
  'Annual Follow Up',
  'CLX Agr. Out for eSignature',
  'Email',
  'Follow Up',
  'Form',
  'Lender Needs List',
  'Lender Q&A',
  'Mail',
  'Meeting',
  'Note',
  'Phone Call',
  'Prep Projections',
  'Review Financials',
  'SMS',
  'To Do',
  'UW Paused - Need Info',
  'Zoom Call',
];

const FeedLeftPanel = ({
  selectedTeamMembers,
  onTeamMembersChange,
  teamMembers,
  isSheet,
  selectedFilters,
  onFiltersChange,
}: FeedLeftPanelProps) => {
  const { teamMember } = useTeamMember();
  const [filterSearch, setFilterSearch] = useState('');

  const filteredOptions = filterOptions.filter(f =>
    f.toLowerCase().includes(filterSearch.toLowerCase())
  );

  const toggleFilter = (filter: string) => {
    const next = new Set(selectedFilters);
    if (next.has(filter)) {
      next.delete(filter);
    } else {
      next.add(filter);
    }
    onFiltersChange(next);
  };

  return (
    <div
      className={cn(
        'px-5 py-6 flex flex-col h-full overflow-hidden',
        isSheet ? 'w-full bg-white' : 'w-[280px] min-w-[280px] bg-[#f3f4f6] border-r border-gray-200'
      )}
    >
      {/* Welcome heading */}
      <h2 className="text-xl font-bold text-foreground leading-tight text-center">
        Welcome to your Feed, {teamMember?.name ?? 'Team'} 👋
      </h2>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed mt-3 text-center">
        Your relationships, your activities, the heartbeat of your business. All in one place.
      </p>

      {/* Divider */}
      <div className="border-b border-border my-4" />

      {/* Team member buttons */}
      <div className="flex items-center justify-center -space-x-2 flex-wrap">
        {teamMembers.map((member) => (
          <button
            key={member.id}
            onClick={() => {
              const next = new Set(selectedTeamMembers);
              if (next.has(member.name)) {
                next.delete(member.name);
              } else {
                next.add(member.name);
              }
              onTeamMembersChange(next);
            }}
            style={{ borderRadius: '9999px' }}
            className={cn(
              'w-10 h-10 aspect-square shrink-0 border-2 font-semibold text-xs leading-none flex items-center justify-center transition-all',
              selectedTeamMembers.has(member.name)
                ? 'border-violet-500 text-white bg-violet-500'
                : 'border-slate-300 text-slate-600 bg-white hover:border-violet-400 hover:text-violet-600'
            )}
            title={member.name}
            aria-label={member.name}
          >
            {member.name.charAt(0)}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative mt-4">
        <input
          type="text"
          placeholder="Search Filters"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="w-full h-10 pl-3 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-300"
        />
      </div>

      {/* All button */}
      <button
        onClick={() => onFiltersChange(new Set())}
        className={cn(
          'w-full text-left mt-3 transition-colors',
          selectedFilters.size === 0
            ? 'px-3 py-2 rounded-lg bg-violet-200 text-violet-900 font-medium text-sm'
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
                ? 'px-3 py-2 rounded-lg bg-violet-200 text-violet-900 font-medium text-sm'
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
