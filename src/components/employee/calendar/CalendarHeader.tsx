import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/hooks/useCalendarData';
import { ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react';

interface CalendarHeaderProps {
  title: string;
  viewMode: ViewMode;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onViewChange: (mode: ViewMode) => void;
  onToggleSidebar: () => void;
}

const VIEW_OPTIONS: { mode: ViewMode; label: string }[] = [
  { mode: 'day', label: 'Day' },
  { mode: 'week', label: 'Week' },
  { mode: 'month', label: 'Month' },
  { mode: 'agenda', label: 'Schedule' },
];

export function CalendarHeader({
  title,
  viewMode,
  onToday,
  onPrev,
  onNext,
  onViewChange,
  onToggleSidebar,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="h-9 w-9 shrink-0"
      >
        <PanelLeft className="h-5 w-5" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onToday}
        className="h-8 px-4 text-sm font-medium"
      >
        Today
      </Button>

      <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>

      <h2 className="text-lg font-semibold flex-1 ml-2">{title}</h2>

      <div className="flex border rounded-lg overflow-hidden">
        {VIEW_OPTIONS.map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => onViewChange(mode)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === mode
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
