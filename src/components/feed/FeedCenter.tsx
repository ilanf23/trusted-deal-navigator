import { useState, useRef } from 'react';
import { Loader2, Users, SquareCheckBig } from 'lucide-react';
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex-1 min-w-0 bg-muted/30 flex flex-col h-full relative">
      {/* Search bar — always visible */}
      <div className="bg-card border-b border-border/60 px-3 sm:px-5 pt-3.5 pb-0">
        {/* Mobile filter buttons */}
        <div className="flex items-center gap-2 mb-2.5 xl:hidden">
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

        <div className="relative mb-3.5">
          <input
            type="text"
            placeholder="Search by name, company, or keyword..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 px-4 bg-muted/60 rounded-xl text-sm outline-none border border-border/40 placeholder:text-muted-foreground/60 text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/30 focus:bg-card transition-all duration-200"
          />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1">
          {(['all', 'notes', 'comms'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative px-2.5 sm:px-3.5 md:px-4 py-2.5 text-sm font-medium transition-colors duration-150',
                activeTab === tab
                  ? 'text-foreground'
                  : 'text-muted-foreground/70 hover:text-foreground'
              )}
            >
              <span className="sm:hidden">
                {tab === 'comms' ? 'Comms' : tab === 'all' ? 'All' : 'Notes'}
              </span>
              <span className="hidden sm:inline">
                {tab === 'comms' ? 'Communications' : tab === 'all' ? 'All Activity' : 'Notes & Leads'}
              </span>
              <span className="ml-1.5 text-[11px] text-muted-foreground/50 tabular-nums font-normal">({tabCounts[tab]})</span>
              {activeTab === tab && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feed content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-5">
        <div className="max-w-3xl mx-auto w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-8">
              <p className="text-foreground font-semibold text-lg mb-1.5 tracking-tight">
                No "{activeTab === 'comms' ? 'Communications' : activeTab === 'notes' ? 'Notes & Leads' : 'All Activity'}" activities to show in the last 30 days
              </p>
              <p className="text-muted-foreground/70 text-sm max-w-md mb-8 leading-relaxed">
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
                <div className="flex items-center gap-3 mb-4 mt-3 first:mt-0">
                  <span className="text-[11px] text-muted-foreground/60 font-semibold uppercase tracking-widest whitespace-nowrap">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" />
                  <span className="text-[11px] text-muted-foreground/40 whitespace-nowrap tabular-nums font-medium">
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
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedCenter;
