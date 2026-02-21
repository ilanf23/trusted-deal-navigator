import { useState, useRef, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import ActivityCard from './ActivityCard';
import type { ActivityItem } from './feedMockData';

interface FeedCenterProps {
  activities: ActivityItem[];
}

const FeedCenter = ({ activities }: FeedCenterProps) => {
  const [activeTab, setActiveTab] = useState<'following' | 'all'>('following');
  const [showNewToast, setShowNewToast] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleViewNew = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setShowNewToast(false);
  }, []);

  return (
    <div className="flex-1 min-w-0 bg-muted/50 flex flex-col h-full relative">
      {/* Tab bar */}
      <div className="bg-white dark:bg-card border-b border-border px-6">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('following')}
            className={cn(
              'py-3 text-sm font-medium border-b-[3px] transition-colors',
              activeTab === 'following'
                ? 'border-[#5B21B6] text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Following
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'py-3 text-sm font-medium border-b-[3px] transition-colors',
              activeTab === 'all'
                ? 'border-[#5B21B6] text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
        </div>
      </div>

      {/* New activities toast */}
      {showNewToast && (
        <div className="sticky top-2 z-10 flex justify-center mt-2">
          <button
            onClick={handleViewNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D1B4E] text-white rounded-full text-sm shadow-lg hover:bg-[#3D2B5E] transition-colors"
          >
            New activities
            <span className="w-px h-4 bg-white/30" />
            <span className="font-bold">View</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Feed content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {/* Date header */}
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-4">
          Today
        </div>

        {/* Activity cards */}
        {activities.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
};

export default FeedCenter;
