import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CalendarFilter } from '@/hooks/useCalendarData';
import {
  Plus,
  Link2,
  Unlink,
  RefreshCw,
  Loader2,
  Check,
  Upload,
  Download,
} from 'lucide-react';

interface CalendarSidebarProps {
  open: boolean;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  onCreateEvent: () => void;
  filters: CalendarFilter[];
  onToggleFilter: (filterId: string) => void;
  calendarStatus: { connected: boolean; email?: string } | null;
  isConnecting: boolean;
  isSyncing: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSyncToGoogle: () => void;
  onImportFromGoogle: () => void;
}

export function CalendarSidebar({
  open,
  currentDate,
  onDateSelect,
  onCreateEvent,
  filters,
  onToggleFilter,
  calendarStatus,
  isConnecting,
  isSyncing,
  onConnect,
  onDisconnect,
  onSyncToGoogle,
  onImportFromGoogle,
}: CalendarSidebarProps) {
  return (
    <div
      className={cn(
        'shrink-0 border-r border-border overflow-hidden transition-all duration-200 ease-in-out',
        open ? 'w-[256px]' : 'w-0'
      )}
    >
      <div className="w-[256px] h-full flex flex-col py-4 px-3 overflow-y-auto">
        <Button
          onClick={onCreateEvent}
          className="mb-4 rounded-full h-12 px-6 shadow-md gap-2 text-base font-medium"
          size="lg"
        >
          <Plus className="h-5 w-5" />
          Create
        </Button>

        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={(date) => date && onDateSelect(date)}
          className="p-0 [&_.rdp-month]:space-y-2"
          classNames={{
            months: 'flex flex-col',
            month: 'space-y-2',
            caption: 'flex justify-center pt-1 relative items-center',
            caption_label: 'text-xs font-medium',
            nav_button: 'h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md hover:bg-accent',
            nav_button_previous: 'absolute left-0',
            nav_button_next: 'absolute right-0',
            table: 'w-full border-collapse',
            head_row: 'flex',
            head_cell: 'text-muted-foreground rounded-md w-8 font-normal text-[0.65rem]',
            row: 'flex w-full mt-1',
            cell: 'h-8 w-8 text-center text-xs p-0 relative',
            day: 'h-8 w-8 p-0 font-normal rounded-full hover:bg-accent inline-flex items-center justify-center',
            day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
            day_today: 'bg-accent text-accent-foreground font-semibold',
            day_outside: 'text-muted-foreground opacity-40',
          }}
        />

        <div className="mt-5 space-y-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            My calendars
          </h3>
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onToggleFilter(filter.id)}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors text-sm"
            >
              <span
                className={cn(
                  'h-3.5 w-3.5 rounded-sm border-2 flex items-center justify-center shrink-0 transition-colors',
                  filter.enabled
                    ? filter.color + ' border-transparent'
                    : 'bg-transparent border-muted-foreground/40'
                )}
              >
                {filter.enabled && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              <span className={cn('text-sm', !filter.enabled && 'text-muted-foreground')}>
                {filter.label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-2 px-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Google Calendar
          </h3>
          {calendarStatus?.connected ? (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <span className="truncate">{calendarStatus.email}</span>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-8 text-xs gap-2"
                  onClick={onSyncToGoogle}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Push to Google
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-8 text-xs gap-2"
                  onClick={onImportFromGoogle}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Pull from Google
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-8 text-xs text-destructive hover:text-destructive gap-2"
                  onClick={onDisconnect}
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={onConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
