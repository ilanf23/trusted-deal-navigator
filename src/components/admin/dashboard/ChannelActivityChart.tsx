import { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EChartsReact from 'echarts-for-react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

const TOOLTIP_DIM_COLOR = '#9ca3af';

type TooltipParam = {
  name?: string;
  value?: number | string;
  dataIndex?: number;
  seriesIndex?: number;
  seriesName?: string;
  color?: string;
  componentType?: string;
};

type ChartMouseEvent = {
  componentType?: string;
  seriesName?: string;
  seriesIndex?: number;
  dataIndex?: number;
};

export interface ChannelActivityData {
  date: string;
  channels: Record<string, number>;
}

export interface ChannelActivityChartProps {
  data: ChannelActivityData[];
  days?: number;
  className?: string;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  isLoading?: boolean;
  valueMode?: 'currency' | 'count';
  chartType?: 'area' | 'bar';
}

const GRADIENT_PALETTE = [
  { solid: '#80FFA5', stops: ['rgb(128, 255, 165)', 'rgb(1, 191, 236)'] },
  { solid: '#00DDFF', stops: ['rgb(0, 221, 255)', 'rgb(77, 119, 255)'] },
  { solid: '#37A2FF', stops: ['rgb(55, 162, 255)', 'rgb(116, 21, 219)'] },
  { solid: '#FF0087', stops: ['rgb(255, 0, 135)', 'rgb(135, 0, 157)'] },
  { solid: '#FFBF00', stops: ['rgb(255, 191, 0)', 'rgb(224, 62, 76)'] },
];

function getChannelDisplayName(channel: string): string {
  return channel.charAt(0).toUpperCase() + channel.slice(1).replace(/_/g, ' ');
}

function getPalette(index: number) {
  return GRADIENT_PALETTE[index % GRADIENT_PALETTE.length];
}

function formatCurrency(value: number): string {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLabel(date: string): string {
  if (/^\d{4}-\d{2}$/.test(date)) {
    const [year, month] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatChartValue(value: number, valueMode: 'currency' | 'count'): string {
  return valueMode === 'currency' ? formatCurrency(value) : value.toLocaleString();
}

function isTooltipParamArray(params: unknown): params is TooltipParam[] {
  return Array.isArray(params);
}

function isChartMouseEvent(params: unknown): params is ChartMouseEvent {
  return typeof params === 'object' && params !== null;
}

function getFallbackActiveSeries(params: TooltipParam[]): string | null {
  const visibleParams = params.filter(param => Number(param.value) > 0);
  if (visibleParams.length === 0) return null;
  return visibleParams[visibleParams.length - 1]?.seriesName ?? null;
}

function getSeriesColor(seriesName: string | undefined, allChannels: string[]): string {
  if (!seriesName) return '#111827';
  const index = allChannels.findIndex(channel => getChannelDisplayName(channel) === seriesName);
  return index >= 0 ? getPalette(index).solid : '#111827';
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
  className,
  title = 'Deal Size by Channel',
  subtitle,
  headerAction,
  isLoading = false,
  valueMode = 'currency',
  chartType = 'area',
}: ChannelActivityChartProps) {
  const hoveredSeriesRef = useRef<string | null>(null);
  const chartRef = useRef<EChartsReact | null>(null);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Sort data by date to ensure chronological order
    return [...data].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const allChannels = useMemo(() => {
    const totals = new Map<string, number>();
    for (const d of chartData) {
      for (const [channel, value] of Object.entries(d.channels)) {
        totals.set(channel, (totals.get(channel) || 0) + value);
      }
    }
    return Array.from(totals.entries())
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([channel]) => channel);
  }, [chartData]);

  const option: EChartsOption = useMemo(() => {
    const labels = chartData.map(d => formatDateLabel(d.date));
    const isBar = chartType === 'bar';
    const totalsByDate = chartData.map(d =>
      Object.values(d.channels).reduce((a, b) => a + b, 0),
    );
    const topLabelOption = {
      show: true,
      position: 'top',
      fontSize: 11,
      fontWeight: 600,
      color: '#111827',
      formatter: (params: TooltipParam) => {
        const total = totalsByDate[params.dataIndex] ?? 0;
        if (total <= 0) return '';
        return formatChartValue(total, valueMode);
      },
    };

    return {
      color: allChannels.map((_, index) => getPalette(index).solid),
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: isBar ? 'shadow' : 'cross',
          label: {
            backgroundColor: '#6a7985',
          },
        },
        formatter: (params: unknown) => {
          if (!isTooltipParamArray(params) || params.length === 0) return '';

          const date = params[0].name;
          const hovered = hoveredSeriesRef.current ?? getFallbackActiveSeries(params);
          let html = `<div style="font-weight:600;margin-bottom:8px;">${date}</div>`;

          for (const param of params) {
            if (param.value > 0) {
              const isActive = hovered === param.seriesName;
              const rowColor = isActive ? getSeriesColor(param.seriesName, allChannels) : TOOLTIP_DIM_COLOR;
              const fontWeight = isActive ? 700 : 400;
              const opacity = isActive ? 1 : 0.62;
              html += `<div style="display:flex;gap:8px;justify-content:space-between;min-width:180px;color:${rowColor};opacity:${opacity};font-weight:${fontWeight};">
                <span>● ${param.seriesName}</span>
                <strong style="color:${rowColor};">${valueMode === 'currency' ? formatCurrencyFull(Number(param.value) || 0) : Number(param.value || 0).toLocaleString()}</strong>
              </div>`;
            }
          }

          return html;
        },
      },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '4%',
        top: allChannels.length > 0 ? isBar ? '14%' : '18%' : '8%',
        containLabel: true,
      },
      legend: {
        type: 'scroll',
        top: 0,
        itemGap: 12,
        data: allChannels.map(getChannelDisplayName),
        textStyle: {
          fontSize: 11,
          color: '#6b7280',
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: isBar,
        axisTick: {
          show: isBar ? false : undefined,
        },
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
          formatter: (value: number) => valueMode === 'currency' ? formatCurrency(value) : value.toLocaleString(),
        },
      },
      series: allChannels.map((channel, index) => {
        const palette = getPalette(index);
        if (isBar) {
          const isTopSeries = index === allChannels.length - 1;
          return {
            name: getChannelDisplayName(channel),
            type: 'bar',
            stack: 'Total',
            label: isTopSeries ? topLabelOption : { show: false },
            emphasis: {
              focus: 'series',
            },
            data: chartData.map(d => d.channels[channel] || 0),
          };
        }

        return {
          name: getChannelDisplayName(channel),
          type: 'line',
          stack: 'Total',
          smooth: true,
          lineStyle: {
            width: 0,
          },
          showSymbol: false,
          label: index === allChannels.length - 1 ? {
            show: true,
            position: 'top',
            formatter: (params: TooltipParam) => {
              if (params.value <= 0) return '';
              const value = Number(params.value) || 0;
              return valueMode === 'currency' ? formatCurrency(value) : value.toLocaleString();
            },
          } : undefined,
          areaStyle: {
            opacity: 0.8,
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: palette.stops[0] },
              { offset: 1, color: palette.stops[1] },
            ]),
          },
          emphasis: {
            focus: 'series',
          },
          data: chartData.map(d => d.channels[channel] || 0),
        };
      }),
    };
  }, [chartData, allChannels, valueMode, chartType]);

  const totalDealSize = useMemo(() => {
    return chartData.reduce((sum, d) => sum + Object.values(d.channels).reduce((a, b) => a + b, 0), 0);
  }, [chartData]);

  const topChannel = useMemo(() => {
    if (allChannels.length === 0) return null;
    const totals: Record<string, number> = {};
    for (const channel of allChannels) {
      totals[channel] = chartData.reduce((sum, d) => sum + (d.channels[channel] || 0), 0);
    }
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    return top
      ? `${getChannelDisplayName(top[0])} (${valueMode === 'currency' ? formatCurrency(top[1]) : top[1].toLocaleString()})`
      : '-';
  }, [chartData, allChannels, valueMode]);

  const onChartEvents = useMemo(() => ({
    mouseover: (params: unknown) => {
      if (!isChartMouseEvent(params) || params.componentType !== 'series' || !params.seriesName) return;
      if (hoveredSeriesRef.current === params.seriesName) return;
      hoveredSeriesRef.current = params.seriesName;
      const inst = chartRef.current?.getEchartsInstance();
      if (inst) {
        inst.dispatchAction({
          type: 'showTip',
          seriesIndex: params.seriesIndex,
          dataIndex: params.dataIndex,
        });
      }
    },
    mousemove: (params: unknown) => {
      if (!isChartMouseEvent(params) || params.componentType !== 'series' || !params.seriesName) return;
      hoveredSeriesRef.current = params.seriesName;
    },
    globalout: () => {
      if (hoveredSeriesRef.current === null) return;
      hoveredSeriesRef.current = null;
    },
  }), []);

  if (isLoading) {
    return <ChannelActivityChartSkeleton className={className} />;
  }

  const hasChartValues = totalDealSize > 0 && allChannels.length > 0;
  const totalLabel = valueMode === 'currency' ? 'Total Deal Size' : 'Total Activity';

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {headerAction && (
            <div className="shrink-0">{headerAction}</div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-72">
            {hasChartValues ? (
              <EChartsReact
                ref={chartRef}
                option={option}
                style={{ width: '100%', height: '100%' }}
                opts={{ renderer: 'svg' }}
                notMerge={true}
                onEvents={onChartEvents}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  No {valueMode === 'currency' ? 'deal size' : 'activity'} by channel for this period.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{totalLabel}</p>
              <p className="text-xl font-semibold">
                {valueMode === 'currency' ? formatCurrencyFull(totalDealSize) : totalDealSize.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Top Channel</p>
              <p className="text-xl font-semibold">{topChannel}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {allChannels.map((channel, index) => (
              <div key={channel} className="flex items-center gap-2 text-xs">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: getPalette(index).solid }}
                />
                <span className="text-muted-foreground">
                  {getChannelDisplayName(channel)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
