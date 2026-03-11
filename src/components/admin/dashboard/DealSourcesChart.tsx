import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const SOURCE_COLORS = [
  'hsl(217, 91%, 50%)',
  'hsl(30, 100%, 50%)',
  'hsl(217, 91%, 65%)',
  'hsl(30, 100%, 65%)',
  'hsl(217, 91%, 35%)',
  'hsl(30, 100%, 35%)',
];

interface DealSourcesChartProps {
  leadsData: any[] | undefined;
}

export const DealSourcesChart = ({ leadsData }: DealSourcesChartProps) => {
  const dealSourceData = useMemo(() => {
    if (!leadsData) return [];

    const sourceMap: Record<string, number> = {};
    leadsData.forEach((lead) => {
      const source = lead.source || 'Other';
      sourceMap[source] = (sourceMap[source] || 0) + 1;
    });

    const total = Object.values(sourceMap).reduce((sum, count) => sum + count, 0);

    return Object.entries(sourceMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count], index) => ({
        name,
        value: total > 0 ? Math.round((count / total) * 100) : 0,
        color: SOURCE_COLORS[index] || '#94a3b8',
      }));
  }, [leadsData]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Deal Sources</CardTitle>
        <CardDescription>Lead origin breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          {dealSourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dealSourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {dealSourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value}%`, '']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              No data available
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {dealSourceData.map((source) => (
            <div key={source.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
              <span className="text-xs text-muted-foreground truncate">{source.name}</span>
              <span className="text-xs font-medium ml-auto">{source.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
