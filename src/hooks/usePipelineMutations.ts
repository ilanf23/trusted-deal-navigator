import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePipelineMutations = (pipelineId: string | undefined) => {
  const queryClient = useQueryClient();

  const moveLeadToStage = useMutation({
    mutationFn: async ({ pipelineLeadId, newStageId, newStageName, oldStageName, leadId }: {
      pipelineLeadId: string;
      newStageId: string;
      newStageName?: string;
      oldStageName?: string;
      leadId?: string;
    }) => {
      const { error } = await supabase
        .from('pipeline_leads')
        .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
        .eq('id', pipelineLeadId);
      if (error) throw error;
      // Log stage change activity if we have lead info
      if (leadId && oldStageName && newStageName) {
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'stage_change',
          title: `Moved from ${oldStageName} to ${newStageName}`,
          content: JSON.stringify({ from: oldStageName, to: newStageName }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads', pipelineId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activity-timeline'] });
      toast.success('Deal moved successfully');
    },
    onError: () => {
      toast.error('Failed to move deal');
    },
  });

  const addLeadToPipeline = useMutation({
    mutationFn: async ({ leadData, stageId }: {
      leadData: { name: string; company_name?: string; email?: string; phone?: string; assigned_to?: string | null };
      stageId: string;
    }) => {
      // Create the lead first
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: leadData.name,
          company_name: leadData.company_name || null,
          email: leadData.email || null,
          phone: leadData.phone || null,
          assigned_to: leadData.assigned_to || null,
          status: 'initial_review' as any, // default status
        })
        .select()
        .single();
      if (leadError) throw leadError;

      // Add to pipeline
      const { error: plError } = await supabase
        .from('pipeline_leads')
        .insert({
          pipeline_id: pipelineId!,
          lead_id: lead.id,
          stage_id: stageId,
        });
      if (plError) throw plError;

      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads', pipelineId] });
    },
    onError: () => {
      toast.error('Failed to create opportunity');
    },
  });

  const removeLeadFromPipeline = useMutation({
    mutationFn: async (pipelineLeadId: string) => {
      const { error } = await supabase
        .from('pipeline_leads')
        .delete()
        .eq('id', pipelineLeadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads', pipelineId] });
      toast.success('Lead removed from pipeline');
    },
    onError: () => {
      toast.error('Failed to remove lead');
    },
  });

  const bulkRemoveLeadsFromPipeline = useMutation({
    mutationFn: async (pipelineLeadIds: string[]) => {
      const { error } = await supabase
        .from('pipeline_leads')
        .delete()
        .in('id', pipelineLeadIds);
      if (error) throw error;
      return pipelineLeadIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads', pipelineId] });
      toast.success(`${ids.length} lead(s) removed from pipeline`);
    },
    onError: () => {
      toast.error('Failed to remove leads');
    },
  });

  return { moveLeadToStage, addLeadToPipeline, removeLeadFromPipeline, bulkRemoveLeadsFromPipeline };
};
