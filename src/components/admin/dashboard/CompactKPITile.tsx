import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrendDirection = 'up' | 'down' | 'neutral';
type MetricVariant = 'currency' | 'percentage' | 'count' | 'days';

interface SparklineData {
  values: number[];
}

interface CompactKPITileProps {
  label: string;
  value: number;
  previousValue?: number;
  deltaAbsolute?: number;
  deltaPercent?: number;
  trend?: TrendDirection;
  variant?: MetricVariant;
  sparkline?: SparklineData;
  comparisonLabel?: string;
  className?: string;
}

function formatValue(value: number, variant: MetricVariant): string {
  switch (variant) {
    case 'currency':
      if (Math.abs(value) >= 1_000_000)
        return `$${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
      return `$${value.toFixed(0)}`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'count':
      if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return value.toFixed(0);
    case 'days':
      return `${value.toFixed(0)}d`;
  }
}

function formatDelta(value: number, variant: MetricVariant): string {
  const prefix = value > 0 ? '+' : '';
  switch (variant) {
    case 'currency':
      if (Math.abs(value) >= 1_000_000)
        return `${prefix}$${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000)
        return `${prefix}$${(value / 1_000).toFixed(0)}K`;
      return `${prefix}$${value.toFixed(0)}`;
    case 'percentage':
      return `${prefix}${value.toFixed(1)}pp`;
    case 'count':
      return `${prefix}${value.toFixed(0)}`;
    case 'days':
      return `${prefix}${value.toFixed(0)}d`;
  }
}

function deriveTrend(
  deltaAbsolute?: number,
  deltaPercent?: number,
  explicit?: TrendDirection,
): TrendDirection {
  if (explicit) return explicit;
  const delta = deltaAbsolute ?? deltaPercent ?? 0;
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'neutral';
}

const trendConfig: Record<
  TrendDirection,
  { icon: typeof TrendingUp; color: string; bg: string }
> = {
  up: {
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  down: {
    icon: TrendingDown,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40',
  },
  neutral: {
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  },
};

function InlineSparkline({ values }: SparklineData) {
  if (!values || values.length < 2) return null;

  const width = 80;
  const height = 24;
  const padding = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((v - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ');

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const isUp = last.y <= prev.y;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="flex-shrink-0"
    >
      <path
        d={pathD}
        fill="none"
        stroke={isUp ? '#10b981' : '#ef4444'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={2}
        fill={isUp ? '#10b981' : '#ef4444'}
      />
    </svg>
  );
}

function AnimatedValue({
  value,
  variant,
}: {
  value: number;
  variant: MetricVariant;
}) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => formatValue(v, variant));
  const [rendered, setRendered] = useState(formatValue(value, variant));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    spring.set(value);
    const unsub = display.on('change', (v) => setRendered(v));
    return unsub;
  }, [value, spring, display]);

  return (
    <motion.span
      ref={ref}
      className="text-2xl font-bold tracking-tight text-foreground"
    >
      {rendered}
    </motion.span>
  );
}

export function CompactKPITile({
  label,
  value,
  previousValue,
  deltaAbsolute,
  deltaPercent,
  trend: explicitTrend,
  variant = 'count',
  sparkline,
  comparisonLabel,
  className,
}: CompactKPITileProps) {
  const computedDeltaAbsolute =
    deltaAbsolute ?? (previousValue != null ? value - previousValue : undefined);
  const computedDeltaPercent =
    deltaPercent ??
    (previousValue != null && previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : undefined);

  const direction = deriveTrend(
    computedDeltaAbsolute,
    computedDeltaPercent,
    explicitTrend,
  );
  const config = trendConfig[direction];
  const TrendIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'rounded-lg border border-border/60 bg-card p-4 shadow-sm',
        'flex flex-col gap-2',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {sparkline && <InlineSparkline values={sparkline.values} />}
      </div>

      <div className="flex items-end gap-3">
        <AnimatedValue value={value} variant={variant} />

        {(computedDeltaAbsolute != null || computedDeltaPercent != null) && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
              config.bg,
              config.color,
            )}
          >
            <TrendIcon className="h-3 w-3" />
            <span>
              {computedDeltaAbsolute != null &&
                formatDelta(computedDeltaAbsolute, variant)}
              {computedDeltaAbsolute != null &&
                computedDeltaPercent != null &&
                ' · '}
              {computedDeltaPercent != null &&
                `${computedDeltaPercent > 0 ? '+' : ''}${computedDeltaPercent.toFixed(1)}%`}
            </span>
          </div>
        )}
      </div>

      {comparisonLabel && (
        <span className="text-[11px] text-muted-foreground">
          {comparisonLabel}
        </span>
      )}
    </motion.div>
  );
}
