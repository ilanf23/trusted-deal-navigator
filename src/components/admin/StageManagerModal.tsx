import { useState, useEffect } from 'react';
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
import { GripVertical, Plus, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import HelpTooltip from '@/components/ui/help-tooltip';
import ColorWheel from '@/components/ui/color-wheel';

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface StageManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: Stage[];
  onSave: (stages: Stage[]) => void;
  pipelineName?: string;
  onPipelineNameChange?: (name: string) => void;
}

// Color themes - each theme generates a gradient of colors for stages
const colorThemes = [
  { name: 'Blue to Orange', colors: ['#0066FF', '#1a75ff', '#3385ff', '#FF8000', '#e67300', '#10b981'] },
  { name: 'Ocean', colors: ['#0891b2', '#06b6d4', '#22d3ee', '#2dd4bf', '#14b8a6', '#10b981'] },
  { name: 'Sunset', colors: ['#f59e0b', '#f97316', '#ef4444', '#dc2626', '#b91c1c', '#10b981'] },
  { name: 'Purple', colors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#6366f1', '#10b981'] },
  { name: 'Forest', colors: ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#10b981'] },
  { name: 'Monochrome', colors: ['#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#10b981'] },
];

// Individual preset colors
const presetColors = [
  '#0066FF', '#3385ff', '#FF8000', '#e67300', '#10b981', '#059669',
  '#8b5cf6', '#6366f1', '#ec4899', '#ef4444', '#f59e0b', '#64748b',
];

const StageManagerModal = ({ 
  open, 
  onOpenChange, 
  stages, 
  onSave,
  pipelineName = 'Pipeline',
  onPipelineNameChange
}: StageManagerModalProps) => {
  const [localStages, setLocalStages] = useState<Stage[]>(stages);
  const [localPipelineName, setLocalPipelineName] = useState(pipelineName);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<number | null>(null);

  // Reset local state when modal opens
  useEffect(() => {
    if (open) {
      setLocalStages(stages);
      setLocalPipelineName(pipelineName);
      setSelectedTheme(null);
    }
  }, [open, stages, pipelineName]);

  const handleApplyTheme = (themeIndex: number) => {
    setSelectedTheme(themeIndex);
    const theme = colorThemes[themeIndex];
    const newStages = localStages.map((stage, index) => ({
      ...stage,
      color: theme.colors[index % theme.colors.length]
    }));
    setLocalStages(newStages);
  };

  const handleAddStage = () => {
    const lastColor = localStages[localStages.length - 1]?.color || '#64748b';
    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: 'New Stage',
      color: lastColor,
    };
    setLocalStages([...localStages, newStage]);
  };

  const handleRemoveStage = (id: string) => {
    if (localStages.length <= 2) {
      return;
    }
    setLocalStages(localStages.filter(s => s.id !== id));
  };

  const handleUpdateStage = (id: string, field: keyof Stage, value: string) => {
    setLocalStages(localStages.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
    // Clear theme selection when individual color is changed
    if (field === 'color') {
      setSelectedTheme(null);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newStages = [...localStages];
    const draggedStage = newStages[draggedIndex];
    newStages.splice(draggedIndex, 1);
    newStages.splice(index, 0, draggedStage);
    setLocalStages(newStages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    onSave(localStages);
    if (onPipelineNameChange && localPipelineName !== pipelineName) {
      onPipelineNameChange(localPipelineName);
    }
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalStages(stages);
    setLocalPipelineName(pipelineName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Manage Pipeline Stages</DialogTitle>
          <DialogDescription>
            Customize your pipeline name, stages, and colors. Changes are applied when you save.
          </DialogDescription>
        </DialogHeader>

        {/* Pipeline Name */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Pipeline Name</label>
            <HelpTooltip content="Click to edit your pipeline's name. This appears in the header and sidebar." />
          </div>
          <Input
            value={localPipelineName}
            onChange={(e) => setLocalPipelineName(e.target.value)}
            className="text-lg font-semibold"
            placeholder="Enter pipeline name..."
          />
        </div>

        {/* Color Theme Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Color Theme</label>
            <HelpTooltip content="Select a theme to apply a coordinated color scheme across all stages. You can still customize individual stage colors after." />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {colorThemes.map((theme, index) => (
              <button
                key={theme.name}
                type="button"
                onClick={() => handleApplyTheme(index)}
                className={cn(
                  "relative p-2 rounded-lg border-2 transition-all hover:scale-[1.02]",
                  selectedTheme === index 
                    ? "border-[#0066FF] shadow-md" 
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="flex gap-0.5 mb-1">
                  {theme.colors.slice(0, 5).map((color, i) => (
                    <div
                      key={i}
                      className="flex-1 h-4 first:rounded-l last:rounded-r"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-medium text-slate-600">{theme.name}</span>
                {selectedTheme === index && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#0066FF] rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Stages List */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Stages</label>
            <HelpTooltip content="Drag to reorder, click colors to customize, or rename stages directly. Leads flow from top to bottom." />
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {localStages.map((stage, index) => (
              <div
                key={stage.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 transition-all",
                  draggedIndex === index && "opacity-50 scale-[0.98]"
                )}
              >
                <div className="cursor-grab text-slate-400 hover:text-slate-600">
                  <GripVertical className="h-5 w-5" />
                </div>
                
                <span className="text-xs font-medium text-slate-400 w-4">{index + 1}</span>
                
                {/* Color Picker Button */}
                <Popover 
                  open={openColorPicker === stage.id} 
                  onOpenChange={(isOpen) => setOpenColorPicker(isOpen ? stage.id : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg flex-shrink-0 border-2 border-white shadow-md hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: stage.color }}
                      title="Click to change color"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4" align="start">
                    <div className="space-y-4">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Choose Color
                      </div>
                      
                      {/* Interactive Color Wheel */}
                      <div className="flex gap-4">
                        <ColorWheel
                          value={stage.color}
                          onChange={(color) => handleUpdateStage(stage.id, 'color', color)}
                          size={120}
                        />
                        <div className="flex-1 flex flex-col justify-center">
                          <div className="text-xs text-slate-500 mb-1">Current Color</div>
                          <div 
                            className="w-full h-10 rounded-lg border-2 border-white shadow-md mb-3"
                            style={{ backgroundColor: stage.color }}
                          />
                          <div className="text-xs text-slate-500 mb-1">Hex Value</div>
                          <Input
                            value={stage.color}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                                handleUpdateStage(stage.id, 'color', val);
                              }
                            }}
                            className="h-8 text-sm font-mono uppercase"
                            placeholder="#0066FF"
                          />
                        </div>
                      </div>
                      
                      {/* Preset Colors */}
                      <div>
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                          Preset Colors
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {presetColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                handleUpdateStage(stage.id, 'color', color);
                                setOpenColorPicker(null);
                              }}
                              className={cn(
                                "w-8 h-8 rounded-lg transition-all hover:scale-110 border-2",
                                stage.color.toLowerCase() === color.toLowerCase() 
                                  ? "border-slate-900 shadow-md" 
                                  : "border-white shadow-sm"
                              )}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <div className="flex-1">
                  <Input
                    value={stage.name}
                    onChange={(e) => handleUpdateStage(stage.id, 'name', e.target.value)}
                    className="h-8 text-sm font-medium border-slate-200"
                    placeholder="Stage name"
                  />
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                  onClick={() => handleRemoveStage(stage.id)}
                  disabled={localStages.length <= 2}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleAddStage}
          className="w-full border-dashed border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Stage
        </Button>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-[#0066FF] hover:bg-[#0055dd]"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StageManagerModal;
