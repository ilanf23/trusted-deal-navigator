import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { differenceInDays, parseISO } from 'date-fns';

type Lead = Database['public']['Tables']['potential']['Row'];

export interface VolumeLogSignal {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
}

export interface VolumeLogLead extends Lead {
  signals: VolumeLogSignal[];
  days_to_wu: number | null;
  days_to_close: number | null;
  assignedName?: string;
}

export interface VolumeLogStats {
  totalDeals: number;
  totalLoanAmount: number;
  totalPotentialRevenue: number;
  totalNetRevenue: number;
  wonCount: number;
  activeCount: number;
}

export function useLoanVolumeLog() {
  // Fetch leads with volume log fields populated
  const { data: rawLeads = [], isLoading, refetch } = useQuery({
    queryKey: ['volume-log-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  // Fetch team members for name resolution
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['vl-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  // Fetch latest communication dates per lead for stale detection
  const leadIds = useMemo(() => rawLeads.map(l => l.id), [rawLeads]);

  const { data: lastCommMap = {} } = useQuery({
    queryKey: ['vl-last-comms', leadIds.length],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      const { data, error } = await supabase
        .from('communications')
        .select('lead_id, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });
      if (error) return {};
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.lead_id && !map[row.lead_id]) {
          map[row.lead_id] = row.created_at;
        }
      }
      return map;
    },
    enabled: leadIds.length > 0,
  });

  // Fetch overdue task counts
  const { data: overdueTaskMap = {} } = useQuery({
    queryKey: ['vl-overdue-tasks', leadIds.length],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('tasks')
        .select('lead_id')
        .in('lead_id', leadIds)
        .lt('due_date', today)
        .eq('is_completed', false);
      if (error) return {};
      const map: Record<string, number> = {};
      for (const row of data || []) {
        if (row.lead_id) map[row.lead_id] = (map[row.lead_id] ?? 0) + 1;
      }
      return map;
    },
    enabled: leadIds.length > 0,
  });

  // Compute signals and enrich leads
  const leads: VolumeLogLead[] = useMemo(() => {
    const now = new Date();
    return rawLeads.map((lead) => {
      const signals: VolumeLogSignal[] = [];
      const isActive = (lead as any).volume_log_status === 'Active' || !(lead as any).volume_log_status;

      // stale_deal: no communication in 14+ days
      if (isActive) {
        const lastComm = lastCommMap[lead.id];
        if (lastComm) {
          const daysSince = differenceInDays(now, parseISO(lastComm));
          if (daysSince >= 14) {
            signals.push({
              type: 'stale_deal',
              severity: 'warning',
              title: 'Stale Deal',
              description: `No communication in ${daysSince} days`,
            });
          }
        } else if (lead.created_at) {
          const daysSinceCreated = differenceInDays(now, parseISO(lead.created_at));
          if (daysSinceCreated >= 14) {
            signals.push({
              type: 'stale_deal',
              severity: 'warning',
              title: 'Stale Deal',
              description: 'No communications recorded',
            });
          }
        }
      }

      // missing_lender: active deal past initial review without lender
      if (isActive && !(lead as any).lender_name) {
        const stage = (lead as any).loan_stage;
        if (stage && stage !== 'Initial Review' && stage !== 'Review Kill/Keep') {
          signals.push({
            type: 'missing_lender',
            severity: 'warning',
            title: 'Missing Lender',
            description: 'Active deal has no lender assigned',
          });
        }
      }

      // no_clx_agreement: active deal without CLX agreement
      if (isActive && !(lead as any).clx_agreement) {
        signals.push({
          type: 'no_clx_agreement',
          severity: 'warning',
          title: 'No CLX Agreement',
          description: 'CLX agreement not signed',
        });
      }

      // revenue_at_risk: won deal without actual net revenue
      if ((lead as any).won && (!(lead as any).actual_net_revenue || (lead as any).actual_net_revenue === 0) && (lead as any).potential_revenue > 0) {
        signals.push({
          type: 'revenue_at_risk',
          severity: 'critical',
          title: 'Revenue at Risk',
          description: 'Won deal with no actual net revenue recorded',
        });
      }

      // overdue_closing: target date passed, not won/lost
      if (isActive && (lead as any).target_closing_date) {
        const target = parseISO((lead as any).target_closing_date);
        if (target < now && !(lead as any).won) {
          signals.push({
            type: 'overdue_closing',
            severity: 'critical',
            title: 'Overdue Closing',
            description: `Target closing date passed`,
          });
        }
      }

      // outstanding_tasks: overdue tasks
      const overdueCount = overdueTaskMap[lead.id] ?? 0;
      if (overdueCount > 0) {
        signals.push({
          type: 'outstanding_tasks',
          severity: 'warning',
          title: 'Outstanding Tasks',
          description: `${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}`,
        });
      }

      // no_recent_call: no call in 30+ days
      const lastComm = lastCommMap[lead.id];
      if (isActive && lastComm) {
        const daysSince = differenceInDays(now, parseISO(lastComm));
        if (daysSince >= 30) {
          signals.push({
            type: 'no_recent_call',
            severity: 'info',
            title: 'No Recent Contact',
            description: `Last contact ${daysSince} days ago`,
          });
        }
      }

      // Computed fields
      let days_to_wu: number | null = null;
      if ((lead as any).wu_date && lead.created_at) {
        days_to_wu = differenceInDays(parseISO((lead as any).wu_date), parseISO(lead.created_at));
      }

      let days_to_close: number | null = null;
      if ((lead as any).target_closing_date && lead.created_at) {
        days_to_close = differenceInDays(parseISO((lead as any).target_closing_date), parseISO(lead.created_at));
      }

      return {
        ...lead,
        signals,
        days_to_wu,
        days_to_close,
        assignedName: lead.assigned_to ? teamMemberMap[lead.assigned_to] : undefined,
      };
    });
  }, [rawLeads, lastCommMap, overdueTaskMap, teamMemberMap]);

  // Stats
  const stats: VolumeLogStats = useMemo(() => ({
    totalDeals: leads.length,
    totalLoanAmount: leads.reduce((sum, l) => sum + (l.deal_value ?? 0), 0),
    totalPotentialRevenue: leads.reduce((sum, l) => sum + ((l as any).potential_revenue ?? 0), 0),
    totalNetRevenue: leads.reduce((sum, l) => sum + ((l as any).net_revenue ?? 0), 0),
    wonCount: leads.filter(l => (l as any).won).length,
    activeCount: leads.filter(l => (l as any).volume_log_status === 'Active' || !(l as any).volume_log_status).length,
  }), [leads]);

  return {
    leads,
    stats,
    isLoading,
    refetch,
    teamMembers,
    teamMemberMap,
  };
}
