import { format } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import type { TimePeriod } from '@/pages/admin/Dashboard';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

interface DashboardHeaderProps {
  firstName: string;
  timePeriod: TimePeriod;
  setTimePeriod: (v: TimePeriod) => void;
  isFetching: boolean;
}

export const DashboardHeader = ({ firstName, timePeriod, setTimePeriod, isFetching }: DashboardHeaderProps) => {
  const now = new Date();
  const hour = now.getHours();

  const greeting = hour < 12
    ? `Good morning, ${firstName}!`
    : hour < 16
      ? `Happy ${format(now, 'EEEE')}, ${firstName}!`
      : `Good afternoon, ${firstName}!`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 md:gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">{greeting}</h1>
          <DbTableBadge tables={['leads', 'active_calls', 'evan_tasks']} />
        </div>
        <p className="text-base md:text-lg text-muted-foreground mt-1.5">
          {format(now, 'EEEE, MMMM d')}
          <span className="mx-2.5 text-border">&middot;</span>
          Here's your performance overview
        </p>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <TabsList className="bg-muted/50 h-8 p-0.5 rounded-lg">
            <TabsTrigger
              value="mtd"
              className="text-xs px-3 h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              MTD
            </TabsTrigger>
            <TabsTrigger
              value="ytd"
              className="text-xs px-3 h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              YTD
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
};
