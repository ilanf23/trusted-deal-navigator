import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Kanban, 
  Users2, 
  Flame, 
  FileText, 
  Check,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreatePipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  onPipelineCreated?: (pipelineId: string) => void;
}

interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  stages: { name: string; color: string }[];
}

const templates: PipelineTemplate[] = [
  {
    id: 'sales',
    name: 'Sales Pipeline',
    description: 'Standard loan/deal flow from discovery to funded',
    icon: Kanban,
    color: '#0066FF',
    stages: [
      { name: 'Discovery', color: '#0066FF' },
      { name: 'Pre-Qualification', color: '#1a75ff' },
      { name: 'Doc Collection', color: '#3385ff' },
      { name: 'Underwriting', color: '#FF8000' },
      { name: 'Approval', color: '#e67300' },
      { name: 'Funded', color: '#10b981' },
    ],
  },
  {
    id: 'referral',
    name: 'Referral Tracking',
    description: 'Track referral sources and partner relationships',
    icon: Users2,
    color: '#8b5cf6',
    stages: [
      { name: 'New Referral', color: '#8b5cf6' },
      { name: 'Contacted', color: '#a78bfa' },
      { name: 'Meeting Scheduled', color: '#6366f1' },
      { name: 'Active Partner', color: '#10b981' },
    ],
  },
  {
    id: 'hot_deals',
    name: 'Hot Deals',
    description: 'VIP and time-sensitive opportunities',
    icon: Flame,
    color: '#ef4444',
    stages: [
      { name: 'Hot Lead', color: '#ef4444' },
      { name: 'In Progress', color: '#f97316' },
      { name: 'Final Review', color: '#f59e0b' },
      { name: 'Closed Won', color: '#10b981' },
    ],
  },
  {
    id: 'blank',
    name: 'Blank Pipeline',
    description: 'Start from scratch with custom stages',
    icon: FileText,
    color: '#64748b',
    stages: [
      { name: 'Stage 1', color: '#64748b' },
      { name: 'Stage 2', color: '#94a3b8' },
      { name: 'Completed', color: '#10b981' },
    ],
  },
];

const CreatePipelineModal = ({ 
  open, 
  onOpenChange, 
  ownerId,
  onPipelineCreated 
}: CreatePipelineModalProps) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'template' | 'details'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null);
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDescription, setPipelineDescription] = useState('');

  const createPipelineMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error('No template selected');
      
      // Create the pipeline
      const { data: pipeline, error: pipelineError } = await supabase
        .from('pipelines')
        .insert({
          owner_id: ownerId,
          name: pipelineName || selectedTemplate.name,
          description: pipelineDescription || selectedTemplate.description,
          color: selectedTemplate.color,
          template_type: selectedTemplate.id,
          is_main: false,
        })
        .select()
        .single();
      
      if (pipelineError) throw pipelineError;
      
      // Create the stages
      const stagesData = selectedTemplate.stages.map((stage, index) => ({
        pipeline_id: pipeline.id,
        name: stage.name,
        color: stage.color,
        position: index,
      }));
      
      const { error: stagesError } = await supabase
        .from('pipeline_stages')
        .insert(stagesData);
      
      if (stagesError) throw stagesError;
      
      return pipeline;
    },
    onSuccess: (pipeline) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success(`"${pipelineName || selectedTemplate?.name}" pipeline created!`);
      onPipelineCreated?.(pipeline.id);
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create pipeline: ${error.message}`);
    },
  });

  const handleClose = () => {
    setStep('template');
    setSelectedTemplate(null);
    setPipelineName('');
    setPipelineDescription('');
    onOpenChange(false);
  };

  const handleTemplateSelect = (template: PipelineTemplate) => {
    setSelectedTemplate(template);
    setPipelineName(template.name);
    setPipelineDescription(template.description);
  };

  const handleContinue = () => {
    if (selectedTemplate) {
      setStep('details');
    }
  };

  const handleBack = () => {
    setStep('template');
  };

  const handleCreate = () => {
    createPipelineMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {step === 'template' ? 'Create New Pipeline' : 'Pipeline Details'}
          </DialogTitle>
          <DialogDescription>
            {step === 'template' 
              ? 'Choose a template to get started quickly, or create a blank pipeline.'
              : 'Customize your pipeline name and description.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'template' ? (
          <div className="grid grid-cols-2 gap-3 py-4">
            {templates.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedTemplate?.id === template.id;
              
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className={cn(
                    "relative p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02]",
                    isSelected 
                      ? "border-[#0066FF] bg-[#0066FF]/5 shadow-md" 
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  )}
                >
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#0066FF] rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${template.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: template.color }} />
                  </div>
                  
                  <h3 className="font-semibold text-slate-900 mb-1">{template.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{template.description}</p>
                  
                  {/* Stage preview */}
                  <div className="flex gap-0.5 mt-3">
                    {template.stages.slice(0, 5).map((stage, i) => (
                      <div
                        key={i}
                        className="flex-1 h-1.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                    ))}
                    {template.stages.length > 5 && (
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {template.stages.length} stages
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Selected template preview */}
            {selectedTemplate && (
              <div 
                className="p-3 rounded-lg border flex items-center gap-3"
                style={{ backgroundColor: `${selectedTemplate.color}10`, borderColor: `${selectedTemplate.color}30` }}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedTemplate.color }}
                >
                  <selectedTemplate.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Template</div>
                  <div className="font-medium text-sm">{selectedTemplate.name}</div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="pipeline-name">Pipeline Name</Label>
              <Input
                id="pipeline-name"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="Enter pipeline name..."
                className="text-base"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pipeline-description">Description (optional)</Label>
              <Input
                id="pipeline-description"
                value={pipelineDescription}
                onChange={(e) => setPipelineDescription(e.target.value)}
                placeholder="Brief description of this pipeline..."
              />
            </div>
            
            {/* Stages preview */}
            {selectedTemplate && (
              <div className="space-y-2">
                <Label>Stages</Label>
                <div className="flex gap-1">
                  {selectedTemplate.stages.map((stage, i) => (
                    <div
                      key={i}
                      className="flex-1 py-2 px-1 rounded text-center text-[10px] font-medium text-white truncate"
                      style={{ backgroundColor: stage.color }}
                      title={stage.name}
                    >
                      {stage.name}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  You can customize stages after creating the pipeline.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'template' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleContinue}
                disabled={!selectedTemplate}
                className="bg-[#0066FF] hover:bg-[#0055dd]"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={createPipelineMutation.isPending || !pipelineName.trim()}
                className="bg-[#0066FF] hover:bg-[#0055dd]"
              >
                {createPipelineMutation.isPending ? 'Creating...' : 'Create Pipeline'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePipelineModal;