import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FEED_ACTIVITY_FILTERS } from '@/hooks/useFeedData';

interface TeamMember {
  id: string;
  name: string;
}

interface FeedLeftPanelProps {
  userName: string;
  selectedTeamMember: string | null;
  onTeamMemberSelect: (member: string | null) => void;
  selectedFilters: string[];
  onFilterChange: (filters: string[]) => void;
  teamMembers: TeamMember[];
}

const FeedLeftPanel = ({
  userName,
  selectedTeamMember,
  onTeamMemberSelect,
  selectedFilters,
  onFilterChange,
  teamMembers,
}: FeedLeftPanelProps) => {
  const [filterSearch, setFilterSearch] = useState('');
  const isAllSelected = selectedFilters.length === 0;

  const filteredActivityFilters = FEED_ACTIVITY_FILTERS.filter((f) =>
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
    <div className="w-[220px] min-w-[220px] bg-card border-r border-border flex flex-col h-full overflow-hidden">
      {/* Welcome header */}
      <div className="px-4 pt-5 pb-3">
        <h2 className="text-lg font-bold text-foreground leading-tight">
          Welcome to your Feed, {userName} 👋
        </h2>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Your pipeline activity, communications, and deal updates — all in one place.
        </p>
        <div className="h-px bg-border mt-4" />
      </div>

      {/* Team avatars */}
      <div className="px-4 pb-3 flex flex-wrap">
        {teamMembers.map((member, idx) => (
          <button
            key={member.id}
            onClick={() =>
              onTeamMemberSelect(selectedTeamMember === member.name ? null : member.name)
            }
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all border-2',
              'bg-muted/60 text-[#1e1b4b]',
              idx > 0 && '-ml-2',
              selectedTeamMember === member.name
                ? 'border-primary bg-muted z-10'
                : 'border-transparent hover:bg-muted'
            )}
            style={{ zIndex: selectedTeamMember === member.name ? 10 : teamMembers.length - idx }}
          >
            {member.name.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>

      {/* Search filters */}
      <div className="px-4 pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search Filters"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full h-8 pl-3 pr-3 text-xs bg-muted rounded-md border-0 outline-none focus:ring-1 focus:ring-[#5B21B6]/30 placeholder:text-muted-foreground/60 text-foreground"
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
              ? 'bg-primary/10 text-primary font-bold'
              : 'text-foreground hover:bg-muted'
          )}
        >
          All
        </button>

        {filteredActivityFilters.map((filter, idx) => (
          <label
            key={`${filter}-${idx}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-foreground hover:bg-muted cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedFilters.includes(filter)}
              onChange={() => handleFilterToggle(filter)}
              className="w-3.5 h-3.5 rounded border-border text-[#5B21B6] focus:ring-[#5B21B6]/30"
            />
            <span className="text-xs">{filter}</span>
          </label>
        ))}
      </div>

      {/* Footer link */}
      <div className="px-4 py-3 border-t border-border">
        <button className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1">
          Email Visibility Settings
          <span className="text-[10px]">↗</span>
        </button>
      </div>
    </div>
  );
};

export default FeedLeftPanel;
