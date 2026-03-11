import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';
import { startOfYear, format } from 'date-fns';
import type { TimePeriod } from '@/pages/admin/Dashboard';

interface RevenueBreakdownProps {
  timePeriod: TimePeriod;
  periodTotal: number;
  formatCurrency: (v: number) => string;
}

export const RevenueBreakdown = ({ timePeriod, periodTotal, formatCurrency }: RevenueBreakdownProps) => {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - startOfYear(now).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const weekOfYear = Math.ceil(dayOfYear / 7);
  const monthOfYear = now.getMonth() + 1;
  const dayOfMonth = now.getDate();
  const weekOfMonth = Math.ceil(dayOfMonth / 7);

  const increments = timePeriod === 'ytd'
    ? [
        { label: 'Per Day', value: periodTotal / dayOfYear, count: dayOfYear, unit: 'days' },
        { label: 'Per Week', value: periodTotal / weekOfYear, count: weekOfYear, unit: 'weeks' },
        { label: 'Per Month', value: periodTotal / monthOfYear, count: monthOfYear, unit: 'months' },
      ]
    : [
        { label: 'Per Day', value: periodTotal / dayOfMonth, count: dayOfMonth, unit: 'days' },
        { label: 'Per Week', value: periodTotal / Math.max(1, weekOfMonth), count: weekOfMonth, unit: 'weeks' },
      ];

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            P&L Revenue Breakdown
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {timePeriod === 'ytd' ? 'Year to Date' : 'Month to Date'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {increments.map((inc) => (
            <div key={inc.label} className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{inc.label}</p>
              <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(inc.value)}</p>
              <p className="text-xs text-muted-foreground mt-1">Based on {inc.count} {inc.unit}</p>
            </div>
          ))}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(periodTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {timePeriod === 'ytd' ? `Jan 1 - ${format(now, 'MMM d')}` : format(now, 'MMMM yyyy')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
