import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import FeedLeftPanel from '@/components/feed/FeedLeftPanel';
import FeedCenter from '@/components/feed/FeedCenter';
import FeedRightPanel from '@/components/feed/FeedRightPanel';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useFeedData, type FeedActivityType } from '@/hooks/useFeedData';
import { usePageDatabases } from '@/hooks/usePageDatabases';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { Bell, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const FILTER_TYPE_MAP: Record<string, FeedActivityType | null> = {
  'Annual Follow Up': null,
  'CLX Agr. Out for eSignature': null,
  'Email': 'email',
  'Follow Up': null,
  'Form': null,
  'Lender Needs List': null,
  'Lender Q&A': null,
  'Mail': null,
  'Meeting': null,
  'Note': 'note',
  'Phone Call': 'call',
  'Prep Projections': null,
  'Review Financials': null,
  'SMS': 'sms',
  'To Do': null,
  'UW Paused - Need Info': null,
  'Zoom Call': 'call',
};

const PipelineFeed = () => {
  usePageDatabases([
    { table: 'lead_activities', access: 'read', usage: 'Activity-log entries across all deals shown in the feed.', via: 'src/hooks/useFeedData.ts' },
    { table: 'communications', access: 'read', usage: 'Call/email communications surfaced as feed items.', via: 'src/hooks/useFeedData.ts' },
    { table: 'tasks', access: 'read', usage: 'Completed/updated tasks shown in the feed.', via: 'src/hooks/useFeedData.ts' },
    { table: 'outbound_emails', access: 'read', usage: 'Sent emails surfaced as feed items.', via: 'src/hooks/useFeedData.ts' },
    { table: 'notes', access: 'read', usage: 'Lead/person notes shown in the feed.', via: 'src/hooks/useFeedData.ts' },
    { table: 'users', access: 'read', usage: 'Team member avatars + filter dropdown.', via: 'src/hooks/useAssignableUsers.ts, src/hooks/useTeamMember.ts' },
  ]);
  const { data: activities = [], isLoading } = useFeedData();
  const { teamMember } = useTeamMember();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: teamMembers = [] } = useAssignableUsers();

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

  const [selectedTeamMembers, setSelectedTeamMembers] = useState<Set<string>>(new Set());
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());

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
      <AdminTopBarSearch value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
    );
  }, [searchQuery]);

  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<any>(null);

  const handleViewLead = useCallback(async (leadId: string) => {
    const { data, error } = await supabase
      .from('potential')
      .select('*')
      .eq('id', leadId)
      .single();
    if (!error && data) {
      setDetailLead(data);
    }
  }, []);

  const handleTeamMemberSelect = useCallback((members: Set<string>) => {
    setSelectedTeamMembers(members);
    setLeftPanelOpen(false);
  }, []);

  const filteredActivities = useMemo(() => {
    let result = activities;

    if (selectedTeamMembers.size > 0) {
      // Build a set of selected team member IDs for assignedTo matching
      const selectedNames = Array.from(selectedTeamMembers).map(n => n.toLowerCase());
      const selectedIds = new Set(
        teamMembers.filter(tm => selectedNames.includes(tm.name.toLowerCase())).map(tm => tm.id)
      );
      result = result.filter(
        (a) =>
          selectedNames.some(name => a.actorName.toLowerCase().includes(name)) ||
          (a.assignedToId && selectedIds.has(a.assignedToId))
      );
    }

    // Apply type filters
    if (selectedFilters.size > 0) {
      const allowedTypes = new Set<string>();
      const contentKeywords: string[] = [];
      for (const label of selectedFilters) {
        const mapped = FILTER_TYPE_MAP[label];
        if (mapped) {
          allowedTypes.add(mapped);
        } else {
          contentKeywords.push(label.toLowerCase());
        }
      }
      result = result.filter((a) =>
        allowedTypes.has(a.type) ||
        contentKeywords.some(kw => a.content.toLowerCase().includes(kw) || a.type.toLowerCase().includes(kw))
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
  }, [activities, selectedTeamMembers, selectedFilters, searchQuery]);

  return (
    <EmployeeLayout>
      <div data-full-bleed className="flex flex-col h-[calc(100vh-3.5rem-1px)] md:h-[calc(100vh-4rem-1px)] w-full bg-[#f3f4f6]">
        {/* Mobile Sheet drawer for left panel */}
        <Sheet open={leftPanelOpen} onOpenChange={setLeftPanelOpen}>
          <SheetContent side="left" className="p-0 w-[280px] border-r-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Team Filter</SheetTitle>
            </SheetHeader>
            <FeedLeftPanel
              selectedTeamMembers={selectedTeamMembers}
              onTeamMembersChange={handleTeamMemberSelect}
              teamMembers={teamMembers}
              selectedFilters={selectedFilters}
              onFiltersChange={setSelectedFilters}
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
              selectedTeamMembers={selectedTeamMembers}
              onTeamMembersChange={setSelectedTeamMembers}
              teamMembers={teamMembers}
              selectedFilters={selectedFilters}
              onFiltersChange={setSelectedFilters}
            />
          </div>
          <FeedCenter
            activities={filteredActivities}
            isLoading={isLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onToggleLeftPanel={() => setLeftPanelOpen(true)}
            onToggleRightPanel={() => setRightPanelOpen(true)}
            selectedTeamMembers={selectedTeamMembers}
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
    </EmployeeLayout>
  );
};

export default PipelineFeed;
