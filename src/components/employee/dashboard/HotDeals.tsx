import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Flame, AlertTriangle, Clock, FileWarning, DollarSign } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

interface HotDealsProps {
  evanId?: string;
}

export const HotDeals = ({ evanId }: HotDealsProps) => {
  const today = new Date();

  const { data: deals } = useQuery({
    queryKey: ['hot-deals', evanId],
    queryFn: async () => {
      if (!evanId) return null;

      const { data: leads } = await supabase
        .from('leads')
        .select('*, lead_responses(*)')
        .eq('assigned_to', evanId)
        .neq('status', 'won')
        .neq('status', 'funded');

      if (!leads) return null;

      const categorizedDeals = {
        closeToClosing: [] as any[],
        stuckTooLong: [] as any[],
        missingDocs: [] as any[],
        highValue: [] as any[],
      };

      leads.forEach(lead => {
        const daysInStage = differenceInDays(today, new Date(lead.updated_at));
        const loanAmount = (lead as any).lead_responses?.[0]?.loan_amount || 0;

        // Close to closing (ready for approval or pre-approval issued)
        if (lead.status === 'ready_for_wu_approval' || lead.status === 'pre_approval_issued' || lead.status === 'approval') {
          categorizedDeals.closeToClosing.push({ ...lead, daysInStage, loanAmount });
        }

        // Stuck too long (7+ days in same stage, not initial_review/discovery)
        if (daysInStage >= 7 && lead.status !== 'initial_review' && lead.status !== 'discovery') {
          categorizedDeals.stuckTooLong.push({ ...lead, daysInStage, loanAmount });
        }

        // Missing docs (in onboarding without responses)
        if ((lead.status === 'onboarding' || lead.status === 'document_collection') && !(lead as any).lead_responses?.length) {
          categorizedDeals.missingDocs.push({ ...lead, daysInStage, loanAmount });
        }

        // High value (loan amount > $500k)
        if (loanAmount >= 500000) {
          categorizedDeals.highValue.push({ ...lead, daysInStage, loanAmount });
        }
      });

      return categorizedDeals;
    },
    enabled: !!evanId,
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return value > 0 ? `$${value.toFixed(0)}` : 'N/A';
  };

  const sections = [
    {
      title: 'Close to Closing',
      icon: Flame,
      deals: deals?.closeToClosing || [],
    },
    {
      title: 'Stuck Too Long',
      icon: Clock,
      deals: deals?.stuckTooLong || [],
    },
    {
      title: 'Missing Docs',
      icon: FileWarning,
      deals: deals?.missingDocs || [],
    },
    {
      title: 'High Value',
      icon: DollarSign,
      deals: deals?.highValue || [],
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          Hot & At-Risk Deals
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] px-6">
          <div className="space-y-4 pb-4">
            {sections.map((section) => (
              <div key={section.title}>
                <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-muted/50">
                  <section.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {section.title}
                  </span>
                  <Badge variant="secondary" className="ml-auto">
                    {section.deals.length}
                  </Badge>
                </div>
                {section.deals.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-2">No deals</p>
                ) : (
                  <div className="space-y-1">
                    {section.deals.slice(0, 3).map((deal: any) => (
                      <div
                        key={deal.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{deal.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {deal.company_name || 'No company'} • {deal.daysInStage}d in stage
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {formatCurrency(deal.loanAmount)}
                        </Badge>
                      </div>
                    ))}
                    {section.deals.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        +{section.deals.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
