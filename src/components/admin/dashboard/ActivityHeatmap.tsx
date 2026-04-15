import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ActivityDay {
  date: string;
  total: number;
  breakdown?: {
    dealsCreated?: number;
    stageChanges?: number;
    communications?: number;
  };
}

export interface ActivityHeatmapProps {
  data: ActivityDay[];
  days?: number;
  className?: string;
  title?: string;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CELL_SIZE = 14;
const CELL_GAP = 3;
const LABEL_WIDTH = 28;

function getIntensityLevel(count: number, max: number): number {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const INTENSITY_CLASSES: Record<number, string> = {
  0: 'fill-muted/40',
  1: 'fill-purple-200 dark:fill-purple-900',
  2: 'fill-purple-400 dark:fill-purple-700',
  3: 'fill-purple-600 dark:fill-purple-500',
  4: 'fill-purple-800 dark:fill-purple-300',
};

function buildGrid(data: ActivityDay[], rangeDays: number) {
  const map = new Map<string, ActivityDay>();
  for (const d of data) {
    map.set(d.date, d);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - rangeDays + 1);

  const jsDay = start.getDay();
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
  start.setDate(start.getDate() - mondayOffset);

  const cells: Array<{
    date: string;
    weekCol: number;
    dayRow: number;
    total: number;
    breakdown?: ActivityDay['breakdown'];
    inRange: boolean;
  }> = [];

  const cursor = new Date(start);
  let weekCol = 0;

  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - rangeDays + 1);
  rangeStart.setHours(0, 0, 0, 0);

  while (cursor <= today) {
    const jsD = cursor.getDay();
    const dayRow = jsD === 0 ? 6 : jsD - 1;
    const dateStr = cursor.toISOString().slice(0, 10);
    const entry = map.get(dateStr);
    const inRange = cursor >= rangeStart;

    cells.push({
      date: dateStr,
      weekCol,
      dayRow,
      total: entry?.total ?? 0,
      breakdown: entry?.breakdown,
      inRange,
    });

    cursor.setDate(cursor.getDate() + 1);

    const nextJsD = cursor.getDay();
    const nextDayRow = nextJsD === 0 ? 6 : nextJsD - 1;
    if (nextDayRow === 0 && cursor <= today) {
      weekCol++;
    }
  }

  return { cells, totalWeeks: weekCol + 1 };
}

function computeSummary(
  data: ActivityDay[],
  rangeDays: number,
): { totalEvents: number; mostActiveDay: string; currentStreak: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - rangeDays + 1);

  const map = new Map<string, number>();
  for (const d of data) {
    map.set(d.date, d.total);
  }

  let totalEvents = 0;
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];

  const cursor = new Date(rangeStart);
  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const count = map.get(dateStr) ?? 0;
    totalEvents += count;
    const jsD = cursor.getDay();
    const dayRow = jsD === 0 ? 6 : jsD - 1;
    dayTotals[dayRow] += count;
    cursor.setDate(cursor.getDate() + 1);
  }

  let maxDayIdx = 0;
  for (let i = 1; i < 7; i++) {
    if (dayTotals[i] > dayTotals[maxDayIdx]) maxDayIdx = i;
  }
  const mostActiveDay = totalEvents > 0 ? WEEKDAY_LABELS[maxDayIdx] : '-';

  let currentStreak = 0;
  const streakCursor = new Date(today);
  while (streakCursor >= rangeStart) {
    const dateStr = streakCursor.toISOString().slice(0, 10);
    if ((map.get(dateStr) ?? 0) > 0) {
      currentStreak++;
      streakCursor.setDate(streakCursor.getDate() - 1);
    } else {
      break;
    }
  }

  return { totalEvents, mostActiveDay, currentStreak };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function ActivityHeatmap({
  data,
  days = 90,
  className,
  title = 'Activity',
}: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    date: string;
    total: number;
    breakdown?: ActivityDay['breakdown'];
  } | null>(null);

  const { cells, totalWeeks } = useMemo(() => buildGrid(data, days), [data, days]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const c of cells) {
      if (c.inRange && c.total > m) m = c.total;
    }
    return m;
  }, [cells]);

  const summary = useMemo(() => computeSummary(data, days), [data, days]);

  const svgWidth = LABEL_WIDTH + totalWeeks * (CELL_SIZE + CELL_GAP);
  const svgHeight = 7 * (CELL_SIZE + CELL_GAP) - CELL_GAP;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="overflow-x-auto">
          <svg
            width={svgWidth}
            height={svgHeight + 16}
            viewBox={`0 0 ${svgWidth} ${svgHeight + 16}`}
            className="block"
          >
            {[0, 1, 2, 3, 4, 5, 6].map((row) => (
              <text
                key={row}
                x={0}
                y={row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + 4}
                className="fill-muted-foreground text-[10px]"
              >
                {row % 2 === 0 ? WEEKDAY_LABELS[row] : ''}
              </text>
            ))}

            {cells.map((cell) => (
              <rect
                key={cell.date}
                x={LABEL_WIDTH + cell.weekCol * (CELL_SIZE + CELL_GAP)}
                y={cell.dayRow * (CELL_SIZE + CELL_GAP)}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                className={cn(
                  'transition-colors',
                  cell.inRange
                    ? INTENSITY_CLASSES[getIntensityLevel(cell.total, maxCount)]
                    : 'fill-transparent',
                )}
                onMouseEnter={(e) => {
                  if (!cell.inRange) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const container = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                  if (container) {
                    setTooltip({
                      x: rect.left - container.left + rect.width / 2,
                      y: rect.top - container.top - 4,
                      date: cell.date,
                      total: cell.total,
                      breakdown: cell.breakdown,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </svg>
        </div>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-50 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <p className="mb-1 font-medium text-foreground">{formatDate(tooltip.date)}</p>
            <p className="text-muted-foreground">
              {tooltip.total} event{tooltip.total !== 1 ? 's' : ''}
            </p>
            {tooltip.breakdown && (
              <div className="mt-1 space-y-0.5 text-muted-foreground">
                {tooltip.breakdown.dealsCreated != null && tooltip.breakdown.dealsCreated > 0 && (
                  <p>{tooltip.breakdown.dealsCreated} deals created</p>
                )}
                {tooltip.breakdown.stageChanges != null && tooltip.breakdown.stageChanges > 0 && (
                  <p>{tooltip.breakdown.stageChanges} stage changes</p>
                )}
                {tooltip.breakdown.communications != null && tooltip.breakdown.communications > 0 && (
                  <p>{tooltip.breakdown.communications} communications</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{summary.totalEvents.toLocaleString()}</span>{' '}
            events
          </span>
          <span>
            Most active:{' '}
            <span className="font-medium text-foreground">{summary.mostActiveDay}</span>
          </span>
          <span>
            Streak:{' '}
            <span className="font-medium text-foreground">
              {summary.currentStreak} day{summary.currentStreak !== 1 ? 's' : ''}
            </span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <svg key={level} width={CELL_SIZE} height={CELL_SIZE}>
                <rect
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  className={INTENSITY_CLASSES[level]}
                />
              </svg>
            ))}
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
