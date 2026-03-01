import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import FeedLeftPanel from '@/components/feed/FeedLeftPanel';
import FeedCenter from '@/components/feed/FeedCenter';
import FeedRightPanel from '@/components/feed/FeedRightPanel';
import { useFeedData } from '@/hooks/useFeedData';

const PipelineFeed = () => {
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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredActivities = useMemo(() => {
    let result = activities;

    if (selectedTeamMember) {
      result = result.filter(
        (a) => a.actorName.toLowerCase().includes(selectedTeamMember.toLowerCase())
      );
    }

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
  }, [activities, selectedTeamMember, searchQuery]);

  const activityCounts = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const source = selectedTeamMember
      ? activities.filter((a) => a.actorName.toLowerCase().includes(selectedTeamMember.toLowerCase()))
      : activities;

    return {
      today: source.filter((a) => a.rawDate >= now).length,
      thisWeek: source.filter((a) => a.rawDate >= weekStart).length,
    };
  }, [activities, selectedTeamMember]);

  return (
    <EvanLayout>
      <div data-full-bleed className="flex flex-col h-[calc(100vh-3.5rem-1px)] md:h-[calc(100vh-4rem-1px)] w-full pl-6 md:pl-10 lg:pl-14 bg-background">
        <div className="flex flex-1 min-h-0">
          <FeedLeftPanel
            selectedTeamMember={selectedTeamMember}
            onTeamMemberSelect={setSelectedTeamMember}
            teamMembers={teamMembers}
            activityCounts={activityCounts}
          />
          <FeedCenter
            activities={filteredActivities}
            isLoading={isLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <FeedRightPanel />
        </div>
      </div>
    </EvanLayout>
  );
};

export default PipelineFeed;
