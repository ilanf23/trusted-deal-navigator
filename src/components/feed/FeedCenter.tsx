import { useState, useRef, useMemo } from 'react';
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
  selectedTeamMembers?: Set<string>;
  onViewLead?: (leadId: string) => void;
  currentTeamMemberId: string | null;
}

const FeedCenter = ({ activities, isLoading, searchQuery, onSearchChange, onToggleLeftPanel, onToggleRightPanel, selectedTeamMembers, onViewLead, currentTeamMemberId }: FeedCenterProps) => {
  const [activeTab, setActiveTab] = useState<'following' | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return activities;
    if (!currentTeamMemberId) return activities;
    return activities.filter(a => a.assignedToId === currentTeamMemberId);
  }, [activities, activeTab, currentTeamMemberId]);

  // Group by date — each day gets its own section
  const groups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateMap = new Map<string, FeedActivity[]>();

    for (const a of filtered) {
      const d = new Date(a.rawDate);
      d.setHours(0, 0, 0, 0);
      let label: string;
      if (d >= today) {
        label = 'Today';
      } else if (d >= yesterday) {
        label = 'Yesterday';
      } else {
        label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      }
      if (!dateMap.has(label)) dateMap.set(label, []);
      dateMap.get(label)!.push(a);
    }

    return Array.from(dateMap.entries()).map(([label, items]) => ({ label, items }));
  }, [filtered]);

  const handleToggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="flex-1 min-w-0 bg-transparent flex flex-col h-full relative">
      {/* Top bar with tabs — Copper style */}
      <div className="border-b border-gray-200 px-4 sm:px-6">
        {/* Mobile filter buttons */}
        <div className="flex items-center gap-2 pt-3 xl:hidden">
          {onToggleLeftPanel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleLeftPanel}
              className="flex items-center gap-2 lg:hidden text-xs"
            >
              <Users className="w-3.5 h-3.5" />
              {selectedTeamMembers && selectedTeamMembers.size > 0 ? Array.from(selectedTeamMembers).join(', ') : 'All Team'}
            </Button>
          )}
        </div>

        {/* Following / All tabs — Copper style */}
        <div className="flex items-center gap-0 pt-2 pb-0">
          <button
            onClick={() => setActiveTab('following')}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'following'
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            Following
            {activeTab === 'following' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'all'
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            All
            {activeTab === 'all' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900" />
            )}
          </button>
        </div>
      </div>

      {/* Feed content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="max-w-2xl mx-auto w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-8">
              <p className="text-gray-800 font-semibold text-lg mb-1.5">
                No activities to show
              </p>
              <p className="text-gray-400 text-sm max-w-md mb-8 leading-relaxed">
                When there's activity, it will appear here automatically.
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
                {/* Date group header — Copper style */}
                <h4 className="text-[13px] font-medium text-gray-500 mb-3 mt-6 first:mt-0 py-2">
                  {group.label}
                </h4>
                <div>
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedCenter;
