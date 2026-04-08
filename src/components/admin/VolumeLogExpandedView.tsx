import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { LeadDealSheetTab } from '@/components/admin/LeadDealSheetTab';

type Lead = Database['public']['Tables']['potential']['Row'];

const VolumeLogExpandedView = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useQuery({
    queryKey: ['volume-log-lead', leadId],
    queryFn: async () => {
      if (!leadId) throw new Error('No lead ID');
      const { data, error } = await supabase
        .from('potential')
        .select('*')
        .eq('id', leadId)
        .single();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <EmployeeLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </EmployeeLayout>
    );
  }

  if (!lead) {
    return (
      <EmployeeLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Lead not found</p>
          <Button variant="ghost" onClick={() => navigate('/admin/pipeline/volume-log')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Volume Log
          </Button>
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      <div className="volume-log-expanded-view system-font h-full flex flex-col">
        <style>{`
          .volume-log-expanded-view,
          .volume-log-expanded-view *:not(svg):not(svg *) {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          }
        `}</style>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/pipeline/volume-log')}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{lead.name}</h1>
            {lead.company_name && (
              <p className="text-sm text-muted-foreground">{lead.company_name}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <LeadDealSheetTab
            lead={lead}
            onFieldSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['volume-log-lead', leadId] });
              queryClient.invalidateQueries({ queryKey: ['volume-log-leads'] });
            }}
          />
        </div>
      </div>
    </EmployeeLayout>
  );
};

export default VolumeLogExpandedView;
