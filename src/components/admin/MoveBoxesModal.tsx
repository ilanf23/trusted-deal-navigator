import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Folder, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Pipeline {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  is_main: boolean;
}

interface MoveBoxesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: string[];
  currentPipelineId?: string;
  onMoveComplete: () => void;
}

const MoveBoxesModal = ({
  open,
  onOpenChange,
  selectedLeadIds,
  currentPipelineId,
  onMoveComplete,
}: MoveBoxesModalProps) => {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');

  // Fetch all available pipelines
  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery({
    queryKey: ['available-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, color, icon, is_main')
        .order('is_main', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: open,
  });

  // Filter out current pipeline
  const availablePipelines = pipelines.filter(p => p.id !== currentPipelineId);

  // Move mutation
  const moveMutation = useMutation({
    mutationFn: async ({ leadIds, targetPipelineId }: { leadIds: string[]; targetPipelineId: string }) => {
      // Get the first stage of the target pipeline
      const { data: targetStages, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', targetPipelineId)
        .order('position')
        .limit(1);

      if (stagesError) throw stagesError;

      const targetStageId = targetStages?.[0]?.id;

      // For each lead, update or insert into pipeline_leads
      for (const leadId of leadIds) {
        // Check if lead already exists in target pipeline
        const { data: existing } = await supabase
          .from('pipeline_leads')
          .select('id')
          .eq('pipeline_id', targetPipelineId)
          .eq('lead_id', leadId)
          .single();

        if (existing) {
          // Update existing entry
          const { error: updateError } = await supabase
            .from('pipeline_leads')
            .update({
              stage_id: targetStageId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
        } else {
          // Insert new entry
          const { error: insertError } = await supabase
            .from('pipeline_leads')
            .insert({
              pipeline_id: targetPipelineId,
              lead_id: leadId,
              stage_id: targetStageId,
            });

          if (insertError) throw insertError;
        }

        // Remove from current pipeline if specified
        if (currentPipelineId) {
          await supabase
            .from('pipeline_leads')
            .delete()
            .eq('pipeline_id', currentPipelineId)
            .eq('lead_id', leadId);
        }
      }

      return { count: leadIds.length, targetPipelineId };
    },
    onSuccess: (data) => {
      const targetPipeline = pipelines.find(p => p.id === data.targetPipelineId);
      toast.success(`Moved ${data.count} ${data.count === 1 ? 'box' : 'boxes'} to ${targetPipeline?.name || 'pipeline'}`);
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onMoveComplete();
      onOpenChange(false);
      setSelectedPipelineId('');
    },
    onError: (error: Error) => {
      toast.error(`Failed to move boxes: ${error.message}`);
    },
  });

  const handleMove = () => {
    if (!selectedPipelineId) {
      toast.error('Please select a target pipeline');
      return;
    }
    moveMutation.mutate({
      leadIds: selectedLeadIds,
      targetPipelineId: selectedPipelineId,
    });
  };

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-[#0066FF]" />
            Move {selectedLeadIds.length} {selectedLeadIds.length === 1 ? 'Box' : 'Boxes'}
          </DialogTitle>
          <DialogDescription>
            Select the pipeline you want to move the selected boxes to. All associated data (emails, comments, files, reminders) will be moved with the boxes.
          </DialogDescription>
        </DialogHeader>

        {loadingPipelines ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#0066FF]" />
          </div>
        ) : availablePipelines.length === 0 ? (
          <div className="py-8 text-center">
            <Folder className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No other pipelines available.</p>
            <p className="text-xs text-slate-400 mt-1">Create a new pipeline first to move boxes.</p>
          </div>
        ) : (
          <>
            <div className="py-4">
              <RadioGroup
                value={selectedPipelineId}
                onValueChange={setSelectedPipelineId}
                className="space-y-2"
              >
                {availablePipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      selectedPipelineId === pipeline.id
                        ? "border-[#0066FF] bg-[#0066FF]/5"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                    onClick={() => setSelectedPipelineId(pipeline.id)}
                  >
                    <RadioGroupItem value={pipeline.id} id={pipeline.id} />
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: pipeline.color || '#0066FF' }}
                    />
                    <Label
                      htmlFor={pipeline.id}
                      className="flex-1 cursor-pointer font-medium text-slate-700"
                    >
                      {pipeline.name}
                      {pipeline.is_main && (
                        <span className="ml-2 text-xs text-amber-600 font-normal">(Main)</span>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Warning about stage matching */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700">
                <p className="font-medium">Stage matching reminder</p>
                <p className="mt-0.5">
                  Ensure Stage and Column names are identical in both pipelines to preserve data correctly. Boxes will be placed in the first stage of the target pipeline.
                </p>
              </div>
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!selectedPipelineId || moveMutation.isPending || availablePipelines.length === 0}
            className="bg-[#0066FF] hover:bg-[#0066FF]/90"
          >
            {moveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Move to {selectedPipeline?.name || 'Pipeline'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveBoxesModal;
