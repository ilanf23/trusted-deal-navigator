import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Building2, Mail, Phone, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  initial_review: { label: 'Initial Review', color: 'bg-blue-500' },
  moving_to_underwriting: { label: 'Moving to UW', color: 'bg-cyan-500' },
  onboarding: { label: 'Onboarding', color: 'bg-amber-500' },
  underwriting: { label: 'Underwriting', color: 'bg-orange-500' },
  ready_for_wu_approval: { label: 'Ready for Approval', color: 'bg-purple-500' },
  pre_approval_issued: { label: 'Pre-Approval Issued', color: 'bg-violet-500' },
  won: { label: 'Won', color: 'bg-green-500' },
  lost: { label: 'Lost', color: 'bg-red-500' },
  discovery: { label: 'Discovery', color: 'bg-slate-500' },
  questionnaire: { label: 'Questionnaire', color: 'bg-indigo-500' },
  pre_qualification: { label: 'Pre-Qual', color: 'bg-blue-400' },
  document_collection: { label: 'Docs', color: 'bg-yellow-500' },
  approval: { label: 'Approval', color: 'bg-purple-400' },
  funded: { label: 'Funded', color: 'bg-green-400' },
  review_kill_keep: { label: 'Review Kill/Keep', color: 'bg-red-500' },
  waiting_on_needs_list: { label: 'Waiting Needs List', color: 'bg-amber-400' },
  waiting_on_client: { label: 'Waiting on Client', color: 'bg-yellow-500' },
  complete_files_for_review: { label: 'Complete Files', color: 'bg-teal-500' },
  need_structure_from_brad: { label: 'Need Structure', color: 'bg-indigo-400' },
  maura_underwriting: { label: 'UW Review', color: 'bg-pink-500' },
  brad_underwriting: { label: 'Senior UW', color: 'bg-sky-500' },
  need_structure: { label: 'Need Structure', color: 'bg-indigo-400' },
  underwriting_review: { label: 'UW Review', color: 'bg-pink-500' },
  senior_underwriting: { label: 'Senior UW', color: 'bg-sky-500' },
  uw_paused: { label: 'UW Paused', color: 'bg-gray-500' },
};

export const EvanLeadsWidget = () => {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['evan-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Lead[];
    },
  });

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          My Leads
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Status Summary */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(statusConfig).map(([status, config]) => (
            <Badge
              key={status}
              variant="secondary"
              className={`${config.color} text-white`}
            >
              {config.label}: {statusCounts[status] || 0}
            </Badge>
          ))}
        </div>

        {/* Leads List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">Loading...</div>
          ) : leads.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">No leads assigned</div>
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{lead.name}</h4>
                        <Badge
                          variant="secondary"
                          className={`${statusConfig[lead.status].color} text-white text-xs`}
                        >
                          {statusConfig[lead.status].label}
                        </Badge>
                      </div>
                      {lead.company_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Building2 className="h-3 w-3" />
                          {lead.company_name}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {lead.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Updated {format(new Date(lead.updated_at), 'MMM d, h:mm a')}
                    </span>
                    {lead.source && (
                      <Badge variant="outline" className="text-xs">
                        {lead.source}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
