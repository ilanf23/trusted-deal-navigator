import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Folder, Loader2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

type LeadStatus = Database['public']['Enums']['lead_status'];

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

// Main pipeline stages (matching EvansPipeline.tsx)
const stages: { status: LeadStatus; title: string; color: string }[] = [
  { status: 'discovery', title: 'Discovery', color: '#0066FF' },
  { status: 'pre_qualification', title: 'Pre-Qual', color: '#1a75ff' },
  { status: 'document_collection', title: 'Doc Collection', color: '#3385ff' },
  { status: 'underwriting', title: 'Underwriting', color: '#FF8000' },
  { status: 'approval', title: 'Approval', color: '#e67300' },
  { status: 'funded', title: 'Funded', color: '#059669' },
];

const MoveBoxesModal = ({
  open,
  onOpenChange,
  selectedLeadIds,
  currentPipelineId,
  onMoveComplete,
}: MoveBoxesModalProps) => {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<LeadStatus | ''>('');
  const [activeTab, setActiveTab] = useState<'stage' | 'pipeline'>('stage');

  // Reset selections when modal opens
  useEffect(() => {
    if (open) {
      setSelectedPipelineId('');
      setSelectedStage('');
      setActiveTab('stage');
    }
  }, [open]);

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

  // Filter out current pipeline for pipeline moves
  const availablePipelines = pipelines.filter(p => p.id !== currentPipelineId);

  // Move to stage mutation (updates lead status directly)
  const moveStageMutation = useMutation({
    mutationFn: async ({ leadIds, targetStage }: { leadIds: string[]; targetStage: LeadStatus }) => {
      const updates: { status: LeadStatus; qualified_at?: string; converted_at?: string } = { status: targetStage };
      
      if (targetStage === 'pre_qualification') {
        updates.qualified_at = new Date().toISOString();
      } else if (targetStage === 'funded') {
        updates.converted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .in('id', leadIds);
      
      if (error) throw error;
      return { count: leadIds.length, targetStage };
    },
    onSuccess: (data) => {
      const stageName = stages.find(s => s.status === data.targetStage)?.title || data.targetStage;
      toast.success(`Moved ${data.count} ${data.count === 1 ? 'box' : 'boxes'} to ${stageName}`);
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onMoveComplete();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to move boxes: ${error.message}`);
    },
  });

  // Move to pipeline mutation
  const movePipelineMutation = useMutation({
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
    },
    onError: (error: Error) => {
      toast.error(`Failed to move boxes: ${error.message}`);
    },
  });

  const handleMove = () => {
    if (activeTab === 'stage') {
      if (!selectedStage) {
        toast.error('Please select a target stage');
        return;
      }
      moveStageMutation.mutate({
        leadIds: selectedLeadIds,
        targetStage: selectedStage,
      });
    } else {
      if (!selectedPipelineId) {
        toast.error('Please select a target pipeline');
        return;
      }
      movePipelineMutation.mutate({
        leadIds: selectedLeadIds,
        targetPipelineId: selectedPipelineId,
      });
    }
  };

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
  const selectedStageInfo = stages.find(s => s.status === selectedStage);
  const isPending = moveStageMutation.isPending || movePipelineMutation.isPending;
  const canSubmit = activeTab === 'stage' ? !!selectedStage : !!selectedPipelineId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-[#0066FF]" />
            Move {selectedLeadIds.length} {selectedLeadIds.length === 1 ? 'Box' : 'Boxes'}
          </DialogTitle>
          <DialogDescription>
            Move selected boxes to a different stage or pipeline. All associated data will be preserved.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'stage' | 'pipeline')} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="stage" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Move to Stage
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Move to Pipeline
            </TabsTrigger>
          </TabsList>

          {/* Stage Selection Tab */}
          <TabsContent value="stage" className="mt-4">
            <RadioGroup
              value={selectedStage}
              onValueChange={(v) => setSelectedStage(v as LeadStatus)}
              className="space-y-2"
            >
              {stages.map((stage) => (
                <div
                  key={stage.status}
                  className={cn(
                    "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    selectedStage === stage.status
                      ? "border-[#0066FF] bg-[#0066FF]/5"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  )}
                  onClick={() => setSelectedStage(stage.status)}
                >
                  <RadioGroupItem value={stage.status} id={`stage-${stage.status}`} />
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <Label
                    htmlFor={`stage-${stage.status}`}
                    className="flex-1 cursor-pointer font-medium text-slate-700"
                  >
                    {stage.title}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </TabsContent>

          {/* Pipeline Selection Tab */}
          <TabsContent value="pipeline" className="mt-4">
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

                {/* Warning about stage matching */}
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md mt-4">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-700">
                    <p className="font-medium">Stage matching reminder</p>
                    <p className="mt-0.5">
                      Boxes will be placed in the first stage of the target pipeline.
                    </p>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!canSubmit || isPending}
            className="bg-[#0066FF] hover:bg-[#0066FF]/90"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                {activeTab === 'stage' 
                  ? `Move to ${selectedStageInfo?.title || 'Stage'}`
                  : `Move to ${selectedPipeline?.name || 'Pipeline'}`
                }
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveBoxesModal;
