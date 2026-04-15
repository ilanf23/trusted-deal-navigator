import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  RevenueComboChart,
  type ComboChartDataPoint,
  type TimeRange,
  type Scope,
} from '@/components/admin/dashboard/RevenueComboChart';
import { getDealRevenue } from '@/components/admin/dashboard/useDashboardData';
import {
  format,
  startOfMonth,
  startOfYear,
  startOfQuarter,
  subMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfWeek,
  endOfMonth,
} from 'date-fns';

interface RevenueChartProps {
  evanId: string | undefined;
  annualGoal?: number;
}

type Granularity = 'daily' | 'weekly' | 'monthly';

function deriveGranularity(range: TimeRange): Granularity {
  if (range === 'mtd') return 'daily';
  if (range === 'qtd') return 'weekly';
  return 'monthly';
}

const RevenueChart = ({ evanId, annualGoal = 1500000 }: RevenueChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('ytd');
  const [scope, setScope] = useState<Scope>('company');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ['revenue-chart-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, source, won_at, assigned_to, deal_value, potential_revenue, fee_percent')
        .eq('deal_outcome', 'won');
      if (error) throw error;
      return data;
    },
  });

  const allSources = useMemo(() => {
    if (!revenueData) return [];
    const sources = new Set(revenueData.map((d) => d.source).filter(Boolean) as string[]);
    return Array.from(sources).sort();
  }, [revenueData]);

  const chartData = useMemo((): ComboChartDataPoint[] => {
    if (!revenueData) return [];

    const now = new Date();
    const granularity = deriveGranularity(timeRange);

    let periodStart: Date;
    switch (timeRange) {
      case 'mtd': periodStart = startOfMonth(now); break;
      case 'qtd': periodStart = startOfQuarter(now); break;
      case 'ytd': periodStart = startOfYear(now); break;
      case '12m': periodStart = subMonths(now, 12); break;
      case 'all': periodStart = new Date(2020, 0, 1); break;
    }

    const periodDurationMs = now.getTime() - periodStart.getTime();
    const prevStart = new Date(periodStart.getTime() - periodDurationMs);
    const prevEnd = new Date(periodStart.getTime() - 1);

    const filterLeads = (leads: typeof revenueData, start: Date, end: Date) =>
      leads.filter((lead) => {
        if (!lead.won_at) return false;
        const d = new Date(lead.won_at);
        if (d < start || d > end) return false;
        if (scope === 'personal' && lead.assigned_to !== evanId) return false;
        if (selectedSources.length > 0 && !selectedSources.includes(lead.source || '')) return false;
        return true;
      });

    const currentLeads = filterLeads(revenueData, periodStart, now);
    const previousLeads = filterLeads(revenueData, prevStart, prevEnd);

    const getBuckets = (start: Date, end: Date): Date[] => {
      const safeEnd = end > now ? now : end;
      let raw: Date[];
      switch (granularity) {
        case 'daily': raw = eachDayOfInterval({ start, end: safeEnd }); break;
        case 'weekly': raw = eachWeekOfInterval({ start, end: safeEnd }, { weekStartsOn: 1 }); break;
        case 'monthly': raw = eachMonthOfInterval({ start, end: safeEnd }); break;
      }
      return raw.filter((d) => d >= start);
    };

    const getBucketEnd = (bucketStart: Date): Date => {
      switch (granularity) {
        case 'daily': return endOfDay(bucketStart);
        case 'weekly': return endOfWeek(bucketStart, { weekStartsOn: 1 });
        case 'monthly': return endOfMonth(bucketStart);
      }
    };

    const getLabelFormat = (): string => {
      const needsYear = timeRange === '12m' || timeRange === 'all';
      switch (granularity) {
        case 'daily': return timeRange === 'mtd' ? 'd' : needsYear ? 'MMM d, yy' : 'MMM d';
        case 'weekly': return needsYear ? 'MMM d, yy' : 'MMM d';
        case 'monthly': return needsYear ? "MMM ''yy" : 'MMM';
      }
    };

    const buckets = getBuckets(periodStart, now);
    if (buckets.length === 0) return [];

    const labelFmt = getLabelFormat();
    const bucketsPerYear = granularity === 'daily' ? 365 : granularity === 'weekly' ? 52 : 12;
    const goalPerBucket = annualGoal / bucketsPerYear;

    const aggregateBucket = (leads: typeof revenueData, bStart: Date, bEnd: Date) =>
      leads
        .filter((l) => {
          const d = new Date(l.won_at!);
          return d >= bStart && d <= bEnd;
        })
        .reduce((sum, l) => sum + getDealRevenue(l), 0);

    const prevBuckets = getBuckets(prevStart, prevEnd);
    const prevBucketRevenues = prevBuckets.map((bStart) =>
      aggregateBucket(previousLeads, bStart, getBucketEnd(bStart)),
    );

    let cumulative = 0;
    let prevCumulative = 0;

    return buckets.map((bStart, i) => {
      const bEnd = getBucketEnd(bStart);
      const revenue = Math.round(aggregateBucket(currentLeads, bStart, bEnd));
      cumulative += revenue;
      prevCumulative += Math.round(prevBucketRevenues[i] || 0);

      return {
        label: format(bStart, labelFmt),
        revenue,
        cumulative,
        target: Math.round(goalPerBucket * (i + 1)),
        previous: prevCumulative,
      };
    });
  }, [revenueData, timeRange, scope, evanId, selectedSources, annualGoal]);

  return (
    <RevenueComboChart
      data={chartData}
      isLoading={isLoading}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      scope={scope}
      onScopeChange={setScope}
      sources={allSources}
      selectedSources={selectedSources}
      onSourcesChange={setSelectedSources}
    />
  );
};

export default RevenueChart;
