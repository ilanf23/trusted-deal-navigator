import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EChartsReact from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

export interface ChannelActivityData {
  date: string;
  channels: Record<string, number>;
}

export interface ChannelActivityChartProps {
  data: ChannelActivityData[];
  days?: number;
  className?: string;
  title?: string;
  isLoading?: boolean;
}

// Channel colors - distinct colors for different sources
const CHANNEL_COLORS: Record<string, string> = {
  crm: '#7c3aed', // Purple-600
  referral: '#db2777', // Pink-600
  inbound: '#0891b2', // Cyan-600
  direct: '#d97706', // Amber-600
  partner: '#059669', // Emerald-600
  broker: '#1d4ed8', // Blue-600
  cold_call: '#84cc16', // Lime-500
  email: '#f59e0b', // Amber-500
  outbound: '#8b5cf6', // Violet-500
  unknown: '#6b7280', // Gray-500
};

function getChannelColor(channel: string): string {
  return CHANNEL_COLORS[channel.toLowerCase()] || CHANNEL_COLORS.unknown;
}

export function ChannelActivityChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export function ChannelActivityChart({
  data,
  days = 90,
  className,
  title = 'Activity by Channel',
  isLoading = false,
}: ChannelActivityChartProps) {
  if (isLoading) {
    return <ChannelActivityChartSkeleton className={className} />;
  }

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Sort data by date to ensure chronological order
    return [...data].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const allChannels = useMemo(() => {
    const channels = new Set<string>();
    for (const d of chartData) {
      Object.keys(d.channels).forEach(ch => channels.add(ch));
    }
    return Array.from(channels).sort();
  }, [chartData]);

  const option: EChartsOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#666',
        textStyle: {
          color: '#fff',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';

          const date = params[0].name;
          let html = `<div class="font-semibold mb-2">${date}</div>`;

          for (const param of params) {
            if (param.value > 0) {
              html += `<div style="color: ${param.color}">● ${param.seriesName}: ${param.value}</div>`;
            }
          }

          return html;
        },
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: chartData.map(d => {
          const date = new Date(d.date);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        }),
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: '#e5e7eb',
          },
        },
        axisLabel: {
          fontSize: 11,
          color: '#6b7280',
        },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: '#f3f4f6',
          },
        },
        axisLabel: {
          fontSize: 11,
          color: '#6b7280',
        },
      },
      series: allChannels.map(channel => ({
        name: channel.charAt(0).toUpperCase() + channel.slice(1).replace(/_/g, ' '),
        type: 'area',
        stack: 'Total',
        smooth: true,
        emphasis: {
          focus: 'series',
        },
        areaStyle: {
          opacity: 0.7,
        },
        lineStyle: {
          width: 2,
        },
        itemStyle: {
          color: getChannelColor(channel),
        },
        data: chartData.map(d => d.channels[channel] || 0),
      })),
      color: allChannels.map(ch => getChannelColor(ch)),
    };
  }, [chartData, allChannels]);

  const totalActivity = useMemo(() => {
    return chartData.reduce((sum, d) => sum + Object.values(d.channels).reduce((a, b) => a + b, 0), 0);
  }, [chartData]);

  const topChannel = useMemo(() => {
    if (allChannels.length === 0) return null;
    const totals: Record<string, number> = {};
    for (const channel of allChannels) {
      totals[channel] = chartData.reduce((sum, d) => sum + (d.channels[channel] || 0), 0);
    }
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0].charAt(0).toUpperCase() + top[0].slice(1).replace(/_/g, ' ')} (${top[1]})` : '-';
  }, [chartData, allChannels]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-64">
            <EChartsReact
              option={option}
              style={{ width: '100%', height: '100%' }}
              opts={{ renderer: 'svg' }}
              notMerge={true}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Activity</p>
              <p className="text-xl font-semibold">{totalActivity.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Top Channel</p>
              <p className="text-xl font-semibold">{topChannel}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {allChannels.map(channel => (
              <div key={channel} className="flex items-center gap-2 text-xs">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: getChannelColor(channel) }}
                />
                <span className="text-muted-foreground">
                  {channel.charAt(0).toUpperCase() + channel.slice(1).replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
