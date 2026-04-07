import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useTeamMember } from '@/hooks/useTeamMember';
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
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Folder, Loader2, Layers, Plus, Check, X } from 'lucide-react';
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
  { status: 'initial_review', title: 'Initial Review', color: '#0066FF' },
  { status: 'moving_to_underwriting', title: 'Moving to UW', color: '#0891b2' },
  { status: 'onboarding', title: 'Onboarding', color: '#d97706' },
  { status: 'underwriting', title: 'Underwriting', color: '#FF8000' },
  { status: 'ready_for_wu_approval', title: 'Ready for Approval', color: '#7c3aed' },
  { status: 'pre_approval_issued', title: 'Pre-Approval Issued', color: '#8b5cf6' },
  { status: 'won', title: 'Won', color: '#059669' },
];

// Preset colors for new pipelines
const pipelineColors = [
  '#0066FF', // Blue
  '#FF8000', // Orange
  '#10b981', // Green
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ef4444', // Red
];

const MoveBoxesModal = ({
  open,
  onOpenChange,
  selectedLeadIds,
  currentPipelineId,
  onMoveComplete,
}: MoveBoxesModalProps) => {
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<LeadStatus | ''>('');
  const [activeTab, setActiveTab] = useState<'stage' | 'pipeline'>('stage');
  
  // New pipeline creation state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineColor, setNewPipelineColor] = useState(pipelineColors[0]);

  // Reset selections when modal opens
  useEffect(() => {
    if (open) {
      setSelectedPipelineId('');
      setSelectedStage('');
      setActiveTab('stage');
      setIsCreatingNew(false);
      setNewPipelineName('');
      setNewPipelineColor(pipelineColors[0]);
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

  // Create new pipeline mutation
  const createPipelineMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!teamMember?.id) {
        throw new Error('You must be logged in to create a pipeline');
      }

      // Create the pipeline
      const { data: newPipeline, error: pipelineError } = await supabase
        .from('pipelines')
        .insert({
          name,
          color,
          is_main: false,
          owner_id: teamMember.id,
        })
        .select()
        .single();

      if (pipelineError) throw pipelineError;

      // Create default stages for the new pipeline
      const defaultStages = [
        { name: 'Discovery', position: 0, color: '#0066FF' },
        { name: 'Pre-Qual', position: 1, color: '#1a75ff' },
        { name: 'Doc Collection', position: 2, color: '#3385ff' },
        { name: 'Underwriting', position: 3, color: '#FF8000' },
        { name: 'Approval', position: 4, color: '#e67300' },
        { name: 'Funded', position: 5, color: '#059669' },
      ];

      const { error: stagesError } = await supabase
        .from('pipeline_stages')
        .insert(
          defaultStages.map(stage => ({
            pipeline_id: newPipeline.id,
            name: stage.name,
            position: stage.position,
            color: stage.color,
          }))
        );

      if (stagesError) throw stagesError;

      return newPipeline;
    },
    onSuccess: (newPipeline) => {
      toast.success(`Pipeline "${newPipeline.name}" created!`);
      queryClient.invalidateQueries({ queryKey: ['available-pipelines'] });
      setIsCreatingNew(false);
      setNewPipelineName('');
      // Auto-select the newly created pipeline
      setSelectedPipelineId(newPipeline.id);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create pipeline: ${error.message}`);
    },
  });

  // Move to stage mutation (updates lead status directly)
  const moveStageMutation = useMutation({
    mutationFn: async ({ leadIds, targetStage }: { leadIds: string[]; targetStage: LeadStatus }) => {
      const updates: { status: LeadStatus; qualified_at?: string; converted_at?: string } = { status: targetStage };
      
      if (targetStage === 'moving_to_underwriting' || targetStage === 'pre_qualification') {
        updates.qualified_at = new Date().toISOString();
      } else if (targetStage === 'won' || targetStage === 'funded') {
        updates.converted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('pipeline')
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

      // Update each deal's pipeline_id and stage_id directly on the pipeline table
      for (const leadId of leadIds) {
        const { error: updateError } = await supabase
          .from('pipeline')
          .update({
            pipeline_id: targetPipelineId,
            stage_id: targetStageId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);

        if (updateError) throw updateError;
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

  const handleCreatePipeline = () => {
    if (!newPipelineName.trim()) {
      toast.error('Please enter a pipeline name');
      return;
    }
    createPipelineMutation.mutate({
      name: newPipelineName.trim(),
      color: newPipelineColor,
    });
  };

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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
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
          <TabsContent value="pipeline" className="mt-4 space-y-4">
            {loadingPipelines ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#0066FF]" />
              </div>
            ) : (
              <>
                {/* Existing Pipelines */}
                {availablePipelines.length > 0 && (
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
                )}

                {/* Create New Pipeline Section */}
                {!isCreatingNew ? (
                  <Button
                    variant="outline"
                    className="w-full border-dashed border-2 h-12"
                    onClick={() => setIsCreatingNew(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Pipeline
                  </Button>
                ) : (
                  <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">New Pipeline</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setIsCreatingNew(false);
                          setNewPipelineName('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="pipeline-name" className="text-xs text-slate-500">
                        Pipeline Name
                      </Label>
                      <Input
                        id="pipeline-name"
                        placeholder="e.g., Hot Deals, Referrals..."
                        value={newPipelineName}
                        onChange={(e) => setNewPipelineName(e.target.value)}
                        className="bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {pipelineColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={cn(
                              "h-8 w-8 rounded-full border-2 transition-all flex items-center justify-center",
                              newPipelineColor === color
                                ? "border-slate-900 scale-110"
                                : "border-transparent hover:scale-105"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewPipelineColor(color)}
                          >
                            {newPipelineColor === color && (
                              <Check className="h-4 w-4 text-white" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleCreatePipeline}
                      disabled={!newPipelineName.trim() || createPipelineMutation.isPending}
                      className="w-full bg-[#0066FF] hover:bg-[#0066FF]/90"
                    >
                      {createPipelineMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Pipeline
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Warning about stage matching */}
                {(availablePipelines.length > 0 || selectedPipelineId) && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-700">
                      <p className="font-medium">Stage matching reminder</p>
                      <p className="mt-0.5">
                        Boxes will be placed in the first stage of the target pipeline.
                      </p>
                    </div>
                  </div>
                )}
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
