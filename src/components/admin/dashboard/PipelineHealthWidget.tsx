import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

const STAGE_COLORS: Record<string, string> = {
  discovery: 'hsl(217, 91%, 60%)',
  pre_qualification: 'hsl(217, 91%, 50%)',
  document_collection: 'hsl(217, 91%, 40%)',
  underwriting: 'hsl(30, 100%, 50%)',
  approval: 'hsl(30, 100%, 45%)',
  funded: 'hsl(142, 50%, 45%)',
  lost: 'hsl(0, 72%, 51%)',
};

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  pre_qualification: 'Pre-Qual',
  document_collection: 'Docs',
  underwriting: 'Underwriting',
  approval: 'Approval',
  funded: 'Funded',
  lost: 'Lost',
};

const PIPELINE_ORDER = ['discovery', 'pre_qualification', 'document_collection', 'underwriting', 'approval'];

interface PipelineHealthWidgetProps {
  pipelineData: any[] | undefined;
  formatCurrency: (v: number) => string;
}

export const PipelineHealthWidget = ({ pipelineData, formatCurrency }: PipelineHealthWidgetProps) => {
  const { stages, totalValue } = useMemo(() => {
    if (!pipelineData) return { stages: [], totalValue: 0 };

    const stageMap: Record<string, { count: number; amount: number }> = {};
    let total = 0;

    pipelineData.forEach((lead) => {
      const status = lead.status;
      if (!stageMap[status]) stageMap[status] = { count: 0, amount: 0 };
      stageMap[status].count++;
      const amt = (lead.lead_responses?.[0]?.loan_amount || 0) * 0.02;
      stageMap[status].amount += amt;
      total += amt;
    });

    const maxCount = Math.max(...Object.values(stageMap).map(s => s.count), 1);

    const stageList = PIPELINE_ORDER
      .filter(s => stageMap[s])
      .map(s => ({
        key: s,
        label: STAGE_LABELS[s] || s,
        count: stageMap[s].count,
        amount: stageMap[s].amount,
        color: STAGE_COLORS[s] || '#94a3b8',
        pct: Math.round((stageMap[s].count / maxCount) * 100),
      }));

    return { stages: stageList, totalValue: total };
  }, [pipelineData]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Pipeline Health
          </CardTitle>
          <Link to="/admin/pipeline">
            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted gap-1">
              View Pipeline <ArrowRight className="h-3 w-3" />
            </Badge>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {stages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No deals in pipeline</div>
        ) : (
          <div className="space-y-3">
            {stages.map((stage) => (
              <div key={stage.key} className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-20 shrink-0 truncate">
                  {stage.label}
                </span>
                <div className="flex-1 h-7 bg-muted/50 rounded-md overflow-hidden relative">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{ width: `${stage.pct}%`, backgroundColor: stage.color }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold text-foreground">
                    {stage.count}
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground w-16 text-right shrink-0">
                  {formatCurrency(stage.amount)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-sm text-muted-foreground">Total Pipeline</span>
              <span className="text-lg font-bold">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
