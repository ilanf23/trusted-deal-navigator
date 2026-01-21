import { useState } from 'react';
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
import { GripVertical, Plus, Trash2, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const colorOptions = [
  { name: 'Blue', value: '#0066FF' },
  { name: 'Light Blue', value: '#3385ff' },
  { name: 'Orange', value: '#FF8000' },
  { name: 'Dark Orange', value: '#e67300' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Slate', value: '#64748b' },
];

const StageManagerModal = ({ open, onOpenChange, stages, onSave }: StageManagerModalProps) => {
  const [localStages, setLocalStages] = useState<Stage[]>(stages);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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
              
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              
              <div className="flex-1">
                <Input
                  value={stage.name}
                  onChange={(e) => handleUpdateStage(stage.id, 'name', e.target.value)}
                  className="h-8 text-sm font-medium border-slate-200"
                  placeholder="Stage name"
                />
              </div>
              
              <div className="flex items-center gap-1">
                <div className="relative group">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Palette className="h-4 w-4 text-slate-500" />
                  </Button>
                  <div className="absolute right-0 top-full mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 grid grid-cols-4 gap-1">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => handleUpdateStage(stage.id, 'color', color.value)}
                        className={cn(
                          "w-6 h-6 rounded-full transition-transform hover:scale-110",
                          stage.color === color.value && "ring-2 ring-offset-1 ring-slate-400"
                        )}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
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
