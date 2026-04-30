import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  RevenueLineChart,
  type LineChartDataPoint,
} from '@/components/employee/dashboard/RevenueLineChart';
import type { TimeRange, Scope } from '@/components/admin/dashboard/RevenueComboChart';
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
  className?: string;
  annualGoal?: number;
}

type Granularity = 'daily' | 'weekly' | 'monthly';

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function deriveGranularity(range: TimeRange): Granularity {
  if (range === 'mtd') return 'daily';
  if (range === 'qtd') return 'weekly';
  return 'monthly';
}

const RevenueChart = ({ evanId, className, annualGoal = 1_500_000 }: RevenueChartProps) => {
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

  const chartData = useMemo((): LineChartDataPoint[] => {
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

    const aggregateBucket = (leads: typeof revenueData, bStart: Date, bEnd: Date) =>
      leads
        .filter((l) => {
          const d = new Date(l.won_at!);
          return d >= bStart && d <= bEnd;
        })
        .reduce((sum, l) => sum + getDealRevenue(l), 0);

    let cumulative = 0;

    return buckets.map((bStart) => {
      const bEnd = getBucketEnd(bStart);
      const safeEnd = bEnd > now ? now : bEnd;
      const revenue = Math.round(aggregateBucket(currentLeads, bStart, bEnd));
      cumulative += revenue;
      const goal = Math.round(
        ((safeEnd.getTime() - periodStart.getTime()) / MS_PER_YEAR) * annualGoal,
      );

      return {
        date: bStart,
        cumulative,
        goal,
        label: format(bStart, labelFmt),
      };
    });
  }, [revenueData, timeRange, scope, evanId, selectedSources, annualGoal]);

  return (
    <RevenueLineChart
      data={chartData}
      isLoading={isLoading}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      scope={scope}
      onScopeChange={setScope}
      sources={allSources}
      selectedSources={selectedSources}
      onSourcesChange={setSelectedSources}
      annualGoal={annualGoal}
      className={className}
    />
  );
};

export default RevenueChart;
