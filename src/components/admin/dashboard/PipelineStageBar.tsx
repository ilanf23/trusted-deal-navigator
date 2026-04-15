import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface PipelineStageData {
  stageId: string;
  stageName: string;
  dealCount: number;
  totalValue: number;
  weightedForecast: number;
  colorName?: string;
}

export interface PipelineStageBarProps {
  stages: PipelineStageData[];
  onStageClick?: (stageId: string) => void;
  className?: string;
  title?: string;
}

const STAGE_COLORS: Record<string, { bar: string; barHex: string; text: string; bg: string }> = {
  blue: { bar: 'bg-blue-500', barHex: '#3b82f6', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/50' },
  cyan: { bar: 'bg-cyan-500', barHex: '#06b6d4', text: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/50' },
  amber: { bar: 'bg-amber-500', barHex: '#f59e0b', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/50' },
  orange: { bar: 'bg-orange-500', barHex: '#f97316', text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/50' },
  red: { bar: 'bg-red-500', barHex: '#ef4444', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/50' },
  violet: { bar: 'bg-violet-500', barHex: '#8b5cf6', text: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/50' },
  purple: { bar: 'bg-purple-500', barHex: '#a855f7', text: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/50' },
  emerald: { bar: 'bg-emerald-500', barHex: '#10b981', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/50' },
  sky: { bar: 'bg-sky-500', barHex: '#0ea5e9', text: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/50' },
  indigo: { bar: 'bg-indigo-500', barHex: '#6366f1', text: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/50' },
  pink: { bar: 'bg-pink-500', barHex: '#ec4899', text: 'text-pink-700 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/50' },
  teal: { bar: 'bg-teal-500', barHex: '#14b8a6', text: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/50' },
  slate: { bar: 'bg-slate-400', barHex: '#94a3b8', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-200 dark:bg-slate-700/50' },
  rose: { bar: 'bg-rose-500', barHex: '#f43f5e', text: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/50' },
};

const COLOR_ORDER = [
  'blue', 'cyan', 'amber', 'orange', 'red', 'violet', 'purple',
  'emerald', 'sky', 'indigo', 'pink', 'teal', 'slate', 'rose',
];

function getStageColor(index: number, colorName?: string) {
  if (colorName && STAGE_COLORS[colorName]) return STAGE_COLORS[colorName];
  const key = COLOR_ORDER[index % COLOR_ORDER.length];
  return STAGE_COLORS[key];
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function PipelineStageBar({
  stages,
  onStageClick,
  className,
  title = 'Pipeline by Stage',
}: PipelineStageBarProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{
    x: number;
    y: number;
    stageId: string;
  } | null>(null);

  const totalValue = useMemo(
    () => stages.reduce((sum, s) => sum + s.totalValue, 0),
    [stages],
  );

  const totalDeals = useMemo(
    () => stages.reduce((sum, s) => sum + s.dealCount, 0),
    [stages],
  );

  const totalForecast = useMemo(
    () => stages.reduce((sum, s) => sum + s.weightedForecast, 0),
    [stages],
  );

  const hoveredData = hoveredStage
    ? stages.find((s) => s.stageId === hoveredStage)
    : null;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{totalDeals}</span> deals
            </span>
            <span>
              <span className="font-medium text-foreground">{formatCurrency(totalValue)}</span> value
            </span>
            <span>
              <span className="font-medium text-foreground">{formatCurrency(totalForecast)}</span> forecast
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div
          className="flex h-10 w-full overflow-hidden rounded-lg"
          role="img"
          aria-label={`Pipeline stages: ${stages.map((s) => `${s.stageName}: ${s.dealCount} deals`).join(', ')}`}
        >
          {stages.map((stage, i) => {
            const pct = totalValue > 0 ? (stage.totalValue / totalValue) * 100 : 0;
            if (pct === 0) return null;
            const color = getStageColor(i, stage.colorName);
            const isHovered = hoveredStage === stage.stageId;

            return (
              <motion.div
                key={stage.stageId}
                className={cn(
                  color.bar,
                  'relative flex cursor-pointer items-center justify-center transition-opacity',
                  hoveredStage && !isHovered && 'opacity-50',
                )}
                style={{ width: `${pct}%`, minWidth: pct > 0 ? 4 : 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1, opacity: hoveredStage && !isHovered ? 0.5 : 1 }}
                transition={{ duration: 0.3, ease: 'easeOut', delay: i * 0.04 }}
                onClick={() => onStageClick?.(stage.stageId)}
                onMouseEnter={(e) => {
                  setHoveredStage(stage.stageId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const container = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                  if (container) {
                    setTooltipInfo({
                      x: rect.left - container.left + rect.width / 2,
                      y: rect.top - container.top - 4,
                      stageId: stage.stageId,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredStage(null);
                  setTooltipInfo(null);
                }}
              >
                {pct >= 8 && (
                  <span className="truncate px-1 text-[11px] font-medium text-white drop-shadow-sm">
                    {stage.dealCount}
                  </span>
                )}
              </motion.div>
            );
          })}
          {totalValue === 0 && (
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted/40">
              <span className="text-xs text-muted-foreground">No pipeline data</span>
            </div>
          )}
        </div>

        {tooltipInfo && hoveredData && (
          <div
            className="pointer-events-none absolute z-50 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl"
            style={{
              left: tooltipInfo.x,
              top: tooltipInfo.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <p className="mb-1 font-medium text-foreground">{hoveredData.stageName}</p>
            <div className="space-y-0.5 text-muted-foreground">
              <p>{hoveredData.dealCount} deal{hoveredData.dealCount !== 1 ? 's' : ''}</p>
              <p>Value: {formatCurrency(hoveredData.totalValue)}</p>
              <p>Forecast: {formatCurrency(hoveredData.weightedForecast)}</p>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {stages.map((stage, i) => {
            const color = getStageColor(i, stage.colorName);
            const isHovered = hoveredStage === stage.stageId;

            return (
              <div
                key={stage.stageId}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                  isHovered && 'bg-accent',
                  onStageClick && 'cursor-pointer',
                )}
                onMouseEnter={() => setHoveredStage(stage.stageId)}
                onMouseLeave={() => setHoveredStage(null)}
                onClick={() => onStageClick?.(stage.stageId)}
              >
                <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', color.bar)} />
                <span className="truncate font-medium text-foreground">{stage.stageName}</span>
                <span className="ml-auto flex items-center gap-2 text-muted-foreground">
                  <span>{stage.dealCount}</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{formatCurrency(stage.totalValue)}</span>
                  <span className="hidden sm:inline">·</span>
                  <span className={cn('hidden sm:inline', color.text)}>
                    {formatCurrency(stage.weightedForecast)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
