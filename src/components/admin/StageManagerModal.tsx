import { useState, useRef } from 'react';
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
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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
}

// Brand and suggested colors
const presetColors = [
  '#0066FF', // Brand Blue
  '#3385ff', // Light Blue
  '#FF8000', // Brand Orange
  '#e67300', // Dark Orange
  '#10b981', // Green
  '#059669', // Dark Green
  '#8b5cf6', // Purple
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#64748b', // Slate
];

const StageManagerModal = ({ open, onOpenChange, stages, onSave }: StageManagerModalProps) => {
  const [localStages, setLocalStages] = useState<Stage[]>(stages);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null);

  const handleAddStage = () => {
    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: 'New Stage',
      color: '#64748b',
    };
    setLocalStages([...localStages, newStage]);
  };

  const handleRemoveStage = (id: string) => {
    if (localStages.length <= 2) {
      return; // Keep at least 2 stages
    }
    setLocalStages(localStages.filter(s => s.id !== id));
  };

  const handleUpdateStage = (id: string, field: keyof Stage, value: string) => {
    setLocalStages(localStages.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
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
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalStages(stages); // Reset to original
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Manage Pipeline Stages</DialogTitle>
          <DialogDescription>
            Drag to reorder stages, edit names, or change colors. Click save when done.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2 max-h-[400px] overflow-y-auto">
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
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Choose Color
                    </div>
                    
                    {/* Color Wheel Input */}
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={stage.color}
                          onChange={(e) => handleUpdateStage(stage.id, 'color', e.target.value)}
                          className="w-16 h-16 rounded-full cursor-pointer border-0 p-0 appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white [&::-webkit-color-swatch]:shadow-lg [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-2 [&::-moz-color-swatch]:border-white"
                          title="Color wheel"
                        />
                      </div>
                      <div className="flex-1">
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
