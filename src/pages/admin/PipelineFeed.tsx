import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import FeedLeftPanel from '@/components/feed/FeedLeftPanel';
import FeedCenter from '@/components/feed/FeedCenter';
import FeedRightPanel from '@/components/feed/FeedRightPanel';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useFeedData, type FeedActivityType } from '@/hooks/useFeedData';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { Bell, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const FILTER_TYPE_MAP: Record<string, FeedActivityType> = {
  'Email': 'email',
  'Phone Call': 'call',
  'SMS': 'sms',
  'Note': 'note',
  'New Lead': 'lead_created',
  'Task': 'task_created',
  'Stage Change': 'stage_change',
};

const PipelineFeed = () => {
  const { data: activities = [], isLoading } = useFeedData();
  const { teamMember } = useTeamMember();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  // ── Notification queries ──
  const { data: unreadNotifications = [] } = useQuery({
    queryKey: ['feed-unread-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_rating_notifications')
        .select('*')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: overdueTasks = [] } = useQuery({
    queryKey: ['feed-overdue-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, lead_id')
        .eq('status', 'todo')
        .lt('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const notificationCount = unreadNotifications.length + overdueTasks.length;

  const handleMarkRead = async (notifId: string) => {
    await supabase
      .from('call_rating_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notifId);
    queryClient.invalidateQueries({ queryKey: ['feed-unread-notifications'] });
  };

  const [selectedTeamMember, setSelectedTeamMember] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && teamMember?.name) {
      setSelectedTeamMember(teamMember.name);
      initializedRef.current = true;
    }
  }, [teamMember?.name]);

  const [searchQuery, setSearchQuery] = useState('');

  // ── Top bar: inject title + search into AdminLayout header ──
  const { setPageTitle, setSearchComponent } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('Feed');
    return () => {
      setPageTitle(null);
      setSearchComponent(null);
    };
  }, []);

  useEffect(() => {
    setSearchComponent(
      <input
        type="text"
        placeholder="Search by name, email, domain or phone number"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full h-8 pl-3 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 transition-all dark:bg-muted/50 dark:border-border dark:text-foreground dark:placeholder:text-muted-foreground/60"
      />
    );
  }, [searchQuery]);

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

    // Apply type filters
    if (selectedFilters.size > 0) {
      const allowedTypes = new Set<string>();
      for (const label of selectedFilters) {
        const mapped = FILTER_TYPE_MAP[label];
        if (mapped) allowedTypes.add(mapped);
      }
      result = result.filter((a) => allowedTypes.has(a.type));
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
  }, [activities, selectedTeamMember, selectedFilters, searchQuery]);

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

  // Compute per-filter counts for badge display
  const filterCounts = useMemo(() => {
    const source = selectedTeamMember
      ? activities.filter((a) => a.actorName.toLowerCase().includes(selectedTeamMember.toLowerCase()))
      : activities;

    const counts: Record<string, number> = {};
    for (const [label, type] of Object.entries(FILTER_TYPE_MAP)) {
      counts[label] = source.filter((a) => a.type === type).length;
    }
    return counts;
  }, [activities, selectedTeamMember]);

  return (
    <EvanLayout>
      <div data-full-bleed className="flex flex-col h-[calc(100vh-3.5rem-1px)] md:h-[calc(100vh-4rem-1px)] w-full bg-white">
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
              selectedFilters={selectedFilters}
              onFiltersChange={setSelectedFilters}
              filterCounts={filterCounts}
              isSheet
            />
          </SheetContent>
        </Sheet>

        {/* Mobile Sheet drawer for right panel */}
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
              selectedFilters={selectedFilters}
              onFiltersChange={setSelectedFilters}
              filterCounts={filterCounts}
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
            currentTeamMemberId={teamMember?.id || null}
          />
          <FeedRightPanel />
        </div>
      </div>

      {/* Lead detail dialog */}
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
