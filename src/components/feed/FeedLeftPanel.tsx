import { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACTIVITY_FILTERS } from './feedMockData';

interface FeedLeftPanelProps {
  userName: string;
  selectedTeamMember: string | null;
  onTeamMemberSelect: (member: string | null) => void;
  selectedFilters: string[];
  onFilterChange: (filters: string[]) => void;
}

const TEAM_MEMBERS = [
  { initial: 'E', name: 'Evan', color: 'bg-blue-100 text-blue-700' },
  { initial: 'B', name: 'Brad', color: 'bg-orange-100 text-orange-700' },
  { initial: 'M', name: 'Maura', color: 'bg-pink-100 text-pink-700' },
  { initial: 'W', name: 'Wendy', color: 'bg-green-100 text-green-700' },
];

const FeedLeftPanel = ({
  userName,
  selectedTeamMember,
  onTeamMemberSelect,
  selectedFilters,
  onFilterChange,
}: FeedLeftPanelProps) => {
  const [filterSearch, setFilterSearch] = useState('');
  const isAllSelected = selectedFilters.length === 0;

  const filteredActivityFilters = ACTIVITY_FILTERS.filter((f) =>
    f.toLowerCase().includes(filterSearch.toLowerCase())
  );

  const handleFilterToggle = (filter: string) => {
    if (selectedFilters.includes(filter)) {
      onFilterChange(selectedFilters.filter((f) => f !== filter));
    } else {
      onFilterChange([...selectedFilters, filter]);
    }
  };

  const handleAllClick = () => {
    onFilterChange([]);
  };

  return (
    <div className="w-[220px] min-w-[220px] bg-white border-r border-[#E5E7EB] flex flex-col h-full overflow-hidden">
      {/* Welcome header */}
      <div className="px-4 pt-5 pb-3">
        <h2 className="text-lg font-bold text-[#111827] leading-tight">
          Welcome to your Feed, {userName} 👋
        </h2>
        <p className="text-xs text-[#6B7280] mt-2 leading-relaxed">
          Your relationships, your activities, the heartbeat of your business. All in one place.
        </p>
        <div className="h-px bg-[#E5E7EB] mt-4" />
      </div>

      {/* Team avatars */}
      <div className="px-4 pb-3 flex gap-2">
        {TEAM_MEMBERS.map((member) => (
          <button
            key={member.name}
            onClick={() =>
              onTeamMemberSelect(selectedTeamMember === member.name ? null : member.name)
            }
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              member.color,
              selectedTeamMember === member.name && 'ring-2 ring-[#5B21B6] ring-offset-1'
            )}
          >
            {member.initial}
          </button>
        ))}
      </div>

      {/* Search filters */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search Filters"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-[#F5F5F7] rounded-md border-0 outline-none focus:ring-1 focus:ring-[#5B21B6]/30 placeholder:text-[#9CA3AF]"
          />
        </div>
      </div>

      {/* Filter list */}
      <div className="flex-1 overflow-y-auto px-2">
        {/* "All" option */}
        <button
          onClick={handleAllClick}
          className={cn(
            'w-full text-left px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            isAllSelected
              ? 'bg-[#EDEAF6] text-[#3B1F8C] font-bold'
              : 'text-[#111827] hover:bg-[#F5F5F7]'
          )}
        >
          All
        </button>

        {filteredActivityFilters.map((filter, idx) => (
          <label
            key={`${filter}-${idx}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-[#111827] hover:bg-[#F5F5F7] cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedFilters.includes(filter)}
              onChange={() => handleFilterToggle(filter)}
              className="w-3.5 h-3.5 rounded border-[#D1D5DB] text-[#5B21B6] focus:ring-[#5B21B6]/30"
            />
            <span className="text-xs">{filter}</span>
          </label>
        ))}
      </div>

      {/* Footer link */}
      <div className="px-4 py-3 border-t border-[#E5E7EB]">
        <button className="text-[11px] text-[#6B7280] hover:text-[#5B21B6] flex items-center gap-1">
          Email Visibility Settings
          <span className="text-[10px]">↗</span>
        </button>
      </div>
    </div>
  );
};

export default FeedLeftPanel;
