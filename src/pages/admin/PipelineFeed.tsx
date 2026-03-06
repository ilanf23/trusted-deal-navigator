import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import FeedLeftPanel from '@/components/feed/FeedLeftPanel';
import FeedCenter from '@/components/feed/FeedCenter';
import FeedRightPanel from '@/components/feed/FeedRightPanel';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useFeedData } from '@/hooks/useFeedData';
import { useTeamMember } from '@/hooks/useTeamMember';

const PipelineFeed = () => {
  const { data: activities = [], isLoading } = useFeedData();
  const { teamMember } = useTeamMember();

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
  const initializedRef = useRef(false);

  // Auto-select the logged-in team member's feed on first load
  useEffect(() => {
    if (!initializedRef.current && teamMember?.name) {
      setSelectedTeamMember(teamMember.name);
      initializedRef.current = true;
    }
  }, [teamMember?.name]);
  const [searchQuery, setSearchQuery] = useState('');
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<any>(null);

  const handleViewLead = useCallback(async (leadId: string) => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    if (!error && data) {
      setDetailLead(data);
    }
  }, []);

  const handleTeamMemberSelect = useCallback((member: string | null) => {
    setSelectedTeamMember(member);
    setLeftPanelOpen(false);
  }, []);

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
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const source = selectedTeamMember
      ? activities.filter((a) => a.actorName.toLowerCase().includes(selectedTeamMember.toLowerCase()))
      : activities;

    return {
      total: source.length,
      last30Days: source.filter((a) => a.rawDate >= thirtyDaysAgo).length,
      calls: source.filter((a) => a.type === 'call').length,
      emails: source.filter((a) => a.type === 'email').length,
      sms: source.filter((a) => a.type === 'sms').length,
      notes: source.filter((a) => a.type === 'note').length,
      tasks: source.filter((a) => a.type === 'task_created').length,
      leads: source.filter((a) => a.type === 'lead_created').length,
    };
  }, [activities, selectedTeamMember]);

  return (
    <EvanLayout>
      <div data-full-bleed className="flex flex-col h-[calc(100vh-3.5rem-1px)] md:h-[calc(100vh-4rem-1px)] w-full bg-muted/20">
        {/* Mobile Sheet drawer for left panel */}
        <Sheet open={leftPanelOpen} onOpenChange={setLeftPanelOpen}>
          <SheetContent side="left" className="p-0 w-[280px] border-r-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Team Filter</SheetTitle>
            </SheetHeader>
            <FeedLeftPanel
              selectedTeamMember={selectedTeamMember}
              onTeamMemberSelect={handleTeamMemberSelect}
              teamMembers={teamMembers}
              activityCounts={activityCounts}
              isSheet
            />
          </SheetContent>
        </Sheet>

        {/* Mobile Sheet drawer for right panel (due tasks & meetings) */}
        <Sheet open={rightPanelOpen} onOpenChange={setRightPanelOpen}>
          <SheetContent side="right" className="p-0 w-[300px] border-l-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Due Tasks & Meetings</SheetTitle>
            </SheetHeader>
            <FeedRightPanel isSheet />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 min-h-0">
          {/* Inline left panel — visible at lg+ */}
          <div className="hidden lg:block">
            <FeedLeftPanel
              selectedTeamMember={selectedTeamMember}
              onTeamMemberSelect={setSelectedTeamMember}
              teamMembers={teamMembers}
              activityCounts={activityCounts}
            />
          </div>
          <FeedCenter
            activities={filteredActivities}
            isLoading={isLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onToggleLeftPanel={() => setLeftPanelOpen(true)}
            onToggleRightPanel={() => setRightPanelOpen(true)}
            selectedTeamMember={selectedTeamMember}
            onViewLead={handleViewLead}
          />
          <FeedRightPanel />
        </div>
      </div>

      {/* Lead detail dialog — opens inline, closing stays on feed */}
      <LeadDetailDialog
        lead={detailLead}
        open={!!detailLead}
        onOpenChange={(open) => {
          if (!open) setDetailLead(null);
        }}
      />
    </EvanLayout>
  );
};

export default PipelineFeed;
