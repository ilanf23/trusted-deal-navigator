import { useState, useRef, useCallback } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ActivityCard from './ActivityCard';
import feedEmptyState from '@/assets/feed-empty-state.png';
import type { FeedActivity } from '@/hooks/useFeedData';

interface FeedCenterProps {
  activities: FeedActivity[];
  isLoading: boolean;
}

const FeedCenter = ({ activities, isLoading }: FeedCenterProps) => {
  const [activeTab, setActiveTab] = useState<'all' | 'notes' | 'comms'>('all');
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

  return (
    <div className="flex-1 min-w-0 bg-muted/50 flex flex-col h-full relative">
      {/* Tab bar */}
      <div className="bg-white dark:bg-card border-b border-border px-4">
        <div className="flex">
          {(['all', 'notes', 'comms'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative px-4 py-3.5 text-[15px] font-semibold transition-colors',
                activeTab === tab
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'comms' ? 'Communications' : tab === 'all' ? 'All Activity' : 'Notes & Leads'}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full bg-[#5B21B6]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feed content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
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
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-4 mt-2">
                {group.label}
              </div>
              {group.items.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FeedCenter;
