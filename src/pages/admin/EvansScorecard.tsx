import { useState } from 'react';
import EvanLayout from '@/components/evan/EvanLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, TrendingDown, DollarSign, Loader2 } from 'lucide-react';

type TimePeriod = 'mtd' | 'ytd';

const EvansScorecard = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd');

  // Placeholder data - will be replaced with real data
  const scorecardData = {
    ytd: {
      revenue: 242000,
      target: 1500000,
      deals: 12,
      avgDealSize: 20166,
      callsMade: 320,
      emailsSent: 890,
      meetingsBooked: 45,
    },
    mtd: {
      revenue: 35000,
      target: 125000,
      deals: 2,
      avgDealSize: 17500,
      callsMade: 48,
      emailsSent: 124,
      meetingsBooked: 8,
    },
  };

  const data = scorecardData[timePeriod];
  const progressPercent = Math.round((data.revenue / data.target) * 100);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <EvanLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Scorecard</h1>
            <p className="text-muted-foreground">Track your performance metrics</p>
          </div>
          
          <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="mtd">MTD</TabsTrigger>
              <TabsTrigger value="ytd">YTD</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Revenue Progress Card */}
        <Card className="border-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-white/70 text-sm font-medium uppercase tracking-wider">
                  {timePeriod === 'ytd' ? '2026 Revenue Goal' : 'Monthly Target'}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl md:text-5xl font-bold">{formatCurrency(data.revenue)}</span>
                  <span className="text-xl text-white/60">/ {formatCurrency(data.target)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                <Target className="h-8 w-8 text-white/80" />
                <div>
                  <p className="text-3xl font-bold">{progressPercent}%</p>
                  <p className="text-xs text-white/70">of target</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deals Closed</p>
                  <p className="text-2xl font-bold mt-1">{data.deals}</p>
                </div>
                <div className="p-2 rounded-full bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(data.avgDealSize)}</p>
                </div>
                <div className="p-2 rounded-full bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Calls Made</p>
                  <p className="text-2xl font-bold mt-1">{data.callsMade}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {timePeriod.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Emails Sent</p>
                  <p className="text-2xl font-bold mt-1">{data.emailsSent}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {timePeriod.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Meetings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Meetings Booked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-primary">{data.meetingsBooked}</div>
              <div className="text-muted-foreground">
                meetings scheduled {timePeriod === 'ytd' ? 'this year' : 'this month'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </EvanLayout>
  );
};

export default EvansScorecard;
