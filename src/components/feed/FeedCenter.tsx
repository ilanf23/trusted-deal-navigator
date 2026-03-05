import { useState, useRef, useCallback, useMemo } from 'react';
import { Loader2, Users, X, SquareCheckBig, CheckSquare, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ActivityCard from './ActivityCard';
import feedEmptyState from '@/assets/feed-empty-state.png';
import type { FeedActivity } from '@/hooks/useFeedData';

interface FeedCenterProps {
  activities: FeedActivity[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  selectedTeamMember?: string | null;
  onViewLead?: (leadId: string) => void;
}

const FeedCenter = ({ activities, isLoading, searchQuery, onSearchChange, onToggleLeftPanel, onToggleRightPanel, selectedTeamMember, onViewLead }: FeedCenterProps) => {
  const [activeTab, setActiveTab] = useState<'all' | 'notes' | 'comms'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const filtered = activities.filter((a) => {
    if (activeTab === 'notes') return a.type === 'note' || a.type === 'lead_created';
    if (activeTab === 'comms') return a.type === 'call' || a.type === 'email' || a.type === 'sms';
    return true;
  });

  // Group by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: FeedActivity[] }[] = [];
  const todayItems = filtered.filter(a => a.rawDate >= today);
  const yesterdayItems = filtered.filter(a => a.rawDate >= yesterday && a.rawDate < today);
  const olderItems = filtered.filter(a => a.rawDate < yesterday);

  if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (olderItems.length > 0) groups.push({ label: 'Earlier', items: olderItems });

  const tabCounts = {
    all: activities.length,
    notes: activities.filter(a => a.type === 'note' || a.type === 'lead_created').length,
    comms: activities.filter(a => a.type === 'call' || a.type === 'email' || a.type === 'sms').length,
  };

  const handleToggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const hasSelection = selectedIds.size > 0;
  const allFilteredIds = useMemo(() => filtered.map(a => a.id), [filtered]);
  const allSelected = hasSelection && allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allFilteredIds));
  }, [allFilteredIds]);

  return (
    <div className="flex-1 min-w-0 bg-muted/50 flex flex-col h-full relative">
      {/* Search bar — always visible */}
      <div className="bg-card border-b border-border px-3 sm:px-4 pt-3 pb-0">
        {/* Mobile filter buttons */}
        <div className="flex items-center gap-2 mb-2 xl:hidden">
          {onToggleLeftPanel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleLeftPanel}
              className="flex items-center gap-2 lg:hidden"
            >
              <Users className="w-4 h-4" />
              {selectedTeamMember || 'All Team'}
            </Button>
          )}
          {onToggleRightPanel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleRightPanel}
              className="flex items-center gap-2"
            >
              <SquareCheckBig className="w-4 h-4" />
              Tasks
            </Button>
          )}
        </div>

        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search by name, company, or keyword..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 px-4 bg-muted rounded-lg text-sm outline-none border-0 placeholder:text-muted-foreground text-foreground focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Tab bar */}
        <div className="flex">
          {(['all', 'notes', 'comms'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative px-2 sm:px-3 md:px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="sm:hidden">
                {tab === 'comms' ? 'Comms' : tab === 'all' ? 'All' : 'Notes'}
              </span>
              <span className="hidden sm:inline">
                {tab === 'comms' ? 'Communications' : tab === 'all' ? 'All Activity' : 'Notes & Leads'}
              </span>
              <span className="ml-1.5 text-xs text-muted-foreground">({tabCounts[tab]})</span>
              {activeTab === tab && (
                <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feed content */}
      <div ref={scrollRef} className={cn("flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4", hasSelection && "pb-20")}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-8">
            <p className="text-foreground font-semibold text-lg mb-1">
              No "{activeTab === 'comms' ? 'Communications' : activeTab === 'notes' ? 'Notes & Leads' : 'All Activity'}" activities to show in the last 30 days
            </p>
            <p className="text-muted-foreground text-sm max-w-md mb-6">
              When there's activity matching this filter, it will appear here automatically.
            </p>
            <img
              src={feedEmptyState}
              alt="No activities illustration"
              className="w-full max-w-xl mx-auto"
            />
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              {/* Date group header with rule + count */}
              <div className="flex items-center gap-3 mb-4 mt-2">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              {group.items.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  isExpanded={expandedId === activity.id}
                  onToggle={() => handleToggle(activity.id)}
                  onViewLead={onViewLead}
                  isSelected={selectedIds.has(activity.id)}
                  onSelect={toggleSelect}
                  selectionActive={hasSelection}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Floating selection bar */}
      <div
        className={cn(
          'absolute bottom-4 left-3 right-3 sm:left-4 sm:right-4 lg:left-6 lg:right-6 z-10 transition-all duration-200',
          hasSelection
            ? 'translate-y-0 opacity-100'
            : 'translate-y-4 opacity-0 pointer-events-none'
        )}
      >
        <div className="bg-foreground text-background rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
          <button
            onClick={clearSelection}
            className="flex-shrink-0 p-1 rounded-md hover:bg-background/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <span className="text-sm font-semibold">
            {selectedIds.size} selected
          </span>

          <div className="w-px h-5 bg-background/20 mx-1" />

          <button
            onClick={allSelected ? clearSelection : selectAll}
            className="flex items-center gap-1.5 text-sm font-medium hover:bg-background/10 px-2 py-1 rounded-md transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 text-sm font-medium hover:bg-background/10 px-3 py-1.5 rounded-md transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 text-sm font-medium hover:bg-red-500/20 text-red-300 px-3 py-1.5 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedCenter;
