import { useState, useMemo } from 'react';
import { Plus, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTeamMember } from '@/hooks/useTeamMember';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import FeedLeftPanel from '@/components/feed/FeedLeftPanel';
import FeedCenter from '@/components/feed/FeedCenter';
import FeedRightPanel from '@/components/feed/FeedRightPanel';
import { useFeedData } from '@/hooks/useFeedData';
import type { FeedActivity, FeedActivityType } from '@/hooks/useFeedData';

const PipelineFeed = () => {
  const { teamMember } = useTeamMember();
  const userName = teamMember?.name || 'User';
  const { data: activities = [], isLoading } = useFeedData();

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['feed-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, avatar_url')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const [selectedTeamMember, setSelectedTeamMember] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredActivities = useMemo(() => {
    let result = activities;

    // Filter by team member
    if (selectedTeamMember) {
      result = result.filter(
        (a) =>
          a.actorName.toLowerCase().includes(selectedTeamMember.toLowerCase())
      );
    }

    // Filter by activity type
    if (selectedFilters.length > 0) {
      const typeMap: Record<string, FeedActivityType[]> = {
        'New Lead': ['lead_created'],
        Note: ['note'],
        Call: ['call'],
        Email: ['email'],
        SMS: ['sms'],
        Task: ['task_created'],
      };
      const allowedTypes = selectedFilters.flatMap((f) => typeMap[f] || []);
      if (allowedTypes.length > 0) {
        result = result.filter((a) => allowedTypes.includes(a.type));
      }
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.actorName.toLowerCase().includes(q) ||
          a.leadName.toLowerCase().includes(q) ||
          (a.leadCompany?.toLowerCase().includes(q)) ||
          a.content.toLowerCase().includes(q)
      );
    }

    return result;
  }, [activities, selectedTeamMember, selectedFilters, searchQuery]);

  return (
    <EvanLayout>
      <div data-full-bleed className="flex flex-col h-[calc(100vh-3.5rem-1px)] md:h-[calc(100vh-4rem-1px)] w-full">
        {/* Top bar */}
        <div className="h-14 bg-white dark:bg-card border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
          <h1 className="text-xl font-bold text-foreground mr-4">Feed</h1>
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-[500px]">
              <input
                type="text"
                placeholder="Search by name, company, or keyword"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-4 pr-4 bg-muted rounded-full text-sm outline-none border-0 placeholder:text-muted-foreground text-foreground focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground">
              <Plus className="w-5 h-5" />
            </button>
            <button className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="flex flex-1 min-h-0">
          <FeedLeftPanel
            userName={userName}
            selectedTeamMember={selectedTeamMember}
            onTeamMemberSelect={setSelectedTeamMember}
            selectedFilters={selectedFilters}
            onFilterChange={setSelectedFilters}
            teamMembers={teamMembers}
          />
          <FeedCenter activities={filteredActivities} isLoading={isLoading} />
          <FeedRightPanel />
        </div>
      </div>
    </EvanLayout>
  );
};

export default PipelineFeed;
