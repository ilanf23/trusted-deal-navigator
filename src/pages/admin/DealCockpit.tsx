import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Target,
  Building2,
  Calendar,
  DollarSign,
  User,
  AlertTriangle,
  Clock,
  Phone,
  Mail,
  FileText,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ChevronRight,
  Users,
  Landmark,
  Handshake,
  Zap,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useTeamMember } from '@/hooks/useTeamMember';

// Types
interface Lead {
  id: string;
  name: string;
  company_name: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  lead_responses?: {
    loan_amount: number | null;
    loan_type: string | null;
    funding_timeline: string | null;
    city: string | null;
    state: string | null;
    property_owner_occupied: string | null;
  }[];
}

interface Communication {
  id: string;
  lead_id: string | null;
  communication_type: string;
  direction: string;
  content: string | null;
  created_at: string;
  transcript: string | null;
  duration_seconds: number | null;
}

// Status configuration
const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  pre_qualification: 'Pre-Qualification',
  document_collection: 'Document Collection',
  underwriting: 'Underwriting',
  approval: 'Approval',
  funded: 'Funded',
};

const LANE_CONFIG = {
  borrower: {
    title: 'Borrower Lane',
    owner: 'Evan',
    icon: User,
    color: 'bg-blue-500',
    stages: ['discovery', 'pre_qualification'],
  },
  lender: {
    title: 'Lender Lane',
    owner: 'Wendy',
    icon: Landmark,
    color: 'bg-purple-500',
    stages: ['document_collection', 'underwriting'],
  },
  close: {
    title: 'Close Lane',
    owner: 'Shared',
    icon: Handshake,
    color: 'bg-green-500',
    stages: ['approval'],
  },
};

const DealCockpit = () => {
  const { teamMember } = useTeamMember();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<'all' | 'calls' | 'emails' | 'docs' | 'notes' | 'decisions'>('all');

  // Fetch team member IDs
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members-cockpit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .in('name', ['Evan', 'Wendy']);
      if (error) throw error;
      return data;
    },
  });

  const evanId = teamMembers?.find((m) => m.name.toLowerCase() === 'evan')?.id;

  // Fetch active deals (non-funded leads)
  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['cockpit-deals', evanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          company_name,
          status,
          email,
          phone,
          created_at,
          updated_at,
          notes,
          lead_responses (
            loan_amount,
            loan_type,
            funding_timeline,
            city,
            state,
            property_owner_occupied
          )
        `)
        .neq('status', 'funded')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
    enabled: true,
  });

  // Get selected deal
  const selectedDeal = useMemo(() => {
    if (!selectedDealId) return deals[0] || null;
    return deals.find((d) => d.id === selectedDealId) || deals[0] || null;
  }, [selectedDealId, deals]);

  // Fetch communications for selected deal
  const { data: communications = [] } = useQuery({
    queryKey: ['cockpit-communications', selectedDeal?.id],
    queryFn: async () => {
      if (!selectedDeal?.id) return [];
      const { data, error } = await supabase
        .from('evan_communications')
        .select('*')
        .eq('lead_id', selectedDeal.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Communication[];
    },
    enabled: !!selectedDeal?.id,
  });

  // Calculate blockers
  const blockers = useMemo(() => {
    if (!deals.length) return [];

    return deals
      .map((deal) => {
        const daysSinceUpdate = differenceInDays(new Date(), new Date(deal.updated_at));
        if (daysSinceUpdate < 3) return null;

        let blocker = '';
        let owner = 'Evan';
        let unblockAction = '';

        switch (deal.status) {
          case 'discovery':
            blocker = 'No initial contact completed';
            unblockAction = 'Schedule discovery call';
            owner = 'Evan';
            break;
          case 'pre_qualification':
            blocker = 'Missing qualification info';
            unblockAction = 'Send questionnaire or call';
            owner = 'Evan';
            break;
          case 'document_collection':
            blocker = 'Waiting on documents';
            unblockAction = 'Follow up on missing docs';
            owner = 'Wendy';
            break;
          case 'underwriting':
            blocker = 'Underwriting stalled';
            unblockAction = 'Contact lender for status';
            owner = 'Wendy';
            break;
          case 'approval':
            blocker = 'Pending final approval';
            unblockAction = 'Push for signature';
            owner = 'Shared';
            break;
          default:
            return null;
        }

        return {
          dealId: deal.id,
          dealName: deal.name,
          companyName: deal.company_name,
          status: deal.status,
          blocker,
          owner,
          unblockAction,
          daysStuck: daysSinceUpdate,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.daysStuck || 0) - (a?.daysStuck || 0))
      .slice(0, 8);
  }, [deals]);

  // Group deals by lane
  const laneDeals = useMemo(() => {
    const result: Record<string, Lead[]> = {
      borrower: [],
      lender: [],
      close: [],
    };

    deals.forEach((deal) => {
      if (LANE_CONFIG.borrower.stages.includes(deal.status)) {
        result.borrower.push(deal);
      } else if (LANE_CONFIG.lender.stages.includes(deal.status)) {
        result.lender.push(deal);
      } else if (LANE_CONFIG.close.stages.includes(deal.status)) {
        result.close.push(deal);
      }
    });

    return result;
  }, [deals]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return communications;
    if (activityFilter === 'calls') return communications.filter((c) => c.communication_type === 'call');
    if (activityFilter === 'emails') return communications.filter((c) => c.communication_type === 'email');
    return communications;
  }, [communications, activityFilter]);

  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getDealResponse = (deal: Lead | null) => deal?.lead_responses?.[0] || null;

  if (dealsLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  const response = getDealResponse(selectedDeal);

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-80px)] flex flex-col gap-4 overflow-hidden">
        {/* Deal Selector */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Deal Cockpit</h1>
              <p className="text-xs text-muted-foreground">Never-leave deal management screen</p>
            </div>
          </div>
          <Select
            value={selectedDeal?.id || ''}
            onValueChange={(value) => setSelectedDealId(value)}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a deal" />
            </SelectTrigger>
            <SelectContent>
              {deals.map((deal) => (
                <SelectItem key={deal.id} value={deal.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{deal.name}</span>
                    {deal.company_name && (
                      <span className="text-muted-foreground">· {deal.company_name}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deal Snapshot (Zone 1) */}
        <Card className="shrink-0 bg-gradient-to-r from-primary/5 via-background to-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="grid grid-cols-4 gap-6">
              {/* Ask */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Ask</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(response?.loan_amount || null)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {response?.loan_type || 'Loan type TBD'}
                </p>
              </div>

              {/* Property */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Property</span>
                </div>
                <p className="text-lg font-semibold">
                  {response?.city && response?.state
                    ? `${response.city}, ${response.state}`
                    : 'Location TBD'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {response?.property_owner_occupied === 'yes' ? 'Owner Occupied' : 'Investment'}
                </p>
              </div>

              {/* Timeline */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Timeline</span>
                </div>
                <p className="text-lg font-semibold">
                  {response?.funding_timeline || 'TBD'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Started {selectedDeal ? format(new Date(selectedDeal.created_at), 'MMM d, yyyy') : '—'}
                </p>
              </div>

              {/* Key Numbers */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Target className="h-3.5 w-3.5" />
                  <span>Status</span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-sm py-1 px-3"
                >
                  {STAGE_LABELS[selectedDeal?.status || ''] || selectedDeal?.status}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {selectedDeal
                    ? `${differenceInDays(new Date(), new Date(selectedDeal.updated_at))} days in stage`
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content: Three Lanes + Blockers + Activity */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* Three Lanes (Zone 2) - 5 columns */}
          <div className="col-span-5 flex flex-col gap-3 min-h-0">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Deal Lanes
            </div>
            <div className="flex-1 grid grid-rows-3 gap-3 min-h-0">
              {(['borrower', 'lender', 'close'] as const).map((lane) => {
                const config = LANE_CONFIG[lane];
                const Icon = config.icon;
                const laneData = laneDeals[lane];

                return (
                  <Card key={lane} className="flex flex-col min-h-0">
                    <CardHeader className="py-2 px-3 shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${config.color}`}>
                            <Icon className="h-3.5 w-3.5 text-white" />
                          </div>
                          <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {laneData.length} deals
                          </Badge>
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px]">
                              {config.owner.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 px-3 flex-1 min-h-0">
                      <ScrollArea className="h-full">
                        <div className="space-y-1.5">
                          {laneData.slice(0, 5).map((deal) => (
                            <button
                              key={deal.id}
                              onClick={() => setSelectedDealId(deal.id)}
                              className={`w-full text-left p-2 rounded border transition-colors ${
                                selectedDeal?.id === deal.id
                                  ? 'bg-primary/10 border-primary/30'
                                  : 'hover:bg-muted/50 border-transparent'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium truncate">{deal.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatCurrency(deal.lead_responses?.[0]?.loan_amount || null)}
                                </span>
                              </div>
                            </button>
                          ))}
                          {laneData.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              No deals in this lane
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Blockers Panel (Zone 3) - 3 columns */}
          <div className="col-span-3 flex flex-col min-h-0">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Blockers
            </div>
            <Card className="flex-1 border-amber-200 dark:border-amber-900/50 min-h-0">
              <CardContent className="py-3 px-3 h-full">
                <ScrollArea className="h-full">
                  <div className="space-y-2">
                    {blockers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                        <p className="text-sm font-medium">All clear!</p>
                        <p className="text-xs">No stuck deals</p>
                      </div>
                    ) : (
                      blockers.map((blocker) => (
                        <div
                          key={blocker?.dealId}
                          className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                            selectedDeal?.id === blocker?.dealId
                              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedDealId(blocker?.dealId || null)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                <span className="text-xs font-medium truncate">
                                  {blocker?.dealName}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {blocker?.blocker}
                              </p>
                            </div>
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-1.5 py-0 shrink-0"
                            >
                              {blocker?.daysStuck}d
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              Owner: {blocker?.owner}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-primary">
                              <Zap className="h-2.5 w-2.5" />
                              <span>{blocker?.unblockAction}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Activity Feed (Zone 4) - 4 columns */}
          <div className="col-span-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Activity Feed
              </div>
              <Tabs value={activityFilter} onValueChange={(v) => setActivityFilter(v as any)}>
                <TabsList className="h-7">
                  <TabsTrigger value="all" className="text-[10px] px-2 h-5">All</TabsTrigger>
                  <TabsTrigger value="calls" className="text-[10px] px-2 h-5">Calls</TabsTrigger>
                  <TabsTrigger value="emails" className="text-[10px] px-2 h-5">Emails</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Card className="flex-1 min-h-0">
              <CardContent className="py-3 px-3 h-full">
                <ScrollArea className="h-full">
                  <div className="space-y-2">
                    {filteredActivities.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mb-2" />
                        <p className="text-sm font-medium">No activity yet</p>
                        <p className="text-xs">Communications will appear here</p>
                      </div>
                    ) : (
                      filteredActivities.map((activity) => {
                        const isCall = activity.communication_type === 'call';
                        const isEmail = activity.communication_type === 'email';
                        const Icon = isCall ? Phone : isEmail ? Mail : FileText;

                        return (
                          <div
                            key={activity.id}
                            className="p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className={`p-1.5 rounded ${
                                  isCall
                                    ? 'bg-green-100 dark:bg-green-900/50'
                                    : isEmail
                                    ? 'bg-blue-100 dark:bg-blue-900/50'
                                    : 'bg-muted'
                                }`}
                              >
                                <Icon
                                  className={`h-3 w-3 ${
                                    isCall
                                      ? 'text-green-600'
                                      : isEmail
                                      ? 'text-blue-600'
                                      : 'text-muted-foreground'
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium capitalize">
                                    {activity.direction} {activity.communication_type}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                                  </span>
                                </div>
                                {activity.content && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                                    {activity.content}
                                  </p>
                                )}
                                {isCall && activity.duration_seconds && (
                                  <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>
                                      {Math.floor(activity.duration_seconds / 60)}m{' '}
                                      {activity.duration_seconds % 60}s
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default DealCockpit;
