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
import { toast } from 'sonner';
import { 
  GripVertical, 
  Trash2, 
  Type,
  Calendar,
  CheckSquare,
  ChevronDown,
  Tag,
  Code,
  UserCircle,
  Contact,
  Eye,
  EyeOff,
  Sparkles,
  Clock,
  Hash,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import HelpTooltip from '@/components/ui/help-tooltip';
import type { PipelineColumn, ColumnType, MagicColumnType } from '@/components/admin/PipelineColumnHeader';
import { customColumnTypes, allMagicColumns } from '@/components/admin/PipelineColumnHeader';

interface ColumnManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: PipelineColumn[];
  onColumnsChange: (columns: PipelineColumn[]) => void;
}

const columnTypeIcons: Record<string, React.ElementType> = {
  free_form: Type,
  date: Calendar,
  checkbox: CheckSquare,
  dropdown: ChevronDown,
  tag: Tag,
  formula: Code,
  assigned_to: UserCircle,
  contact: Contact,
};

const columnTypeColors: Record<string, string> = {
  free_form: '#64748b',
  date: '#0066FF',
  checkbox: '#10b981',
  dropdown: '#8b5cf6',
  tag: '#f59e0b',
  formula: '#ec4899',
  assigned_to: '#06b6d4',
  contact: '#FF8000',
};

const ColumnManagerModal = ({ 
  open, 
  onOpenChange, 
  columns,
  onColumnsChange,
}: ColumnManagerModalProps) => {
  const [localColumns, setLocalColumns] = useState<PipelineColumn[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync local state when modal opens
  useEffect(() => {
    if (open) {
      setLocalColumns([...columns]);
    }
  }, [open, columns]);

  // Get editable columns (exclude drag_handle, checkbox, avatar)
  const editableColumns = localColumns.filter(c => 
    !['drag_handle', 'checkbox', 'avatar'].includes(c.id)
  );
  
  // Get custom/magic columns only (user-added)
  const customColumns = editableColumns.filter(c => 
    c.type === 'custom' || c.type === 'magic'
  );

  const handleAddColumn = (type: ColumnType) => {
    const typeConfig = customColumnTypes.find(c => c.type === type);
    const newColumn: PipelineColumn = {
      id: `custom-${type}-${Date.now()}`,
      name: `New ${typeConfig?.label || 'Column'}`,
      type: 'custom',
      columnType: type,
      isVisible: true,
      isFrozen: false,
      canDelete: true,
      canRename: true,
      width: '120px',
    };
    setLocalColumns([...localColumns, newColumn]);
    toast.success(`Added column: ${newColumn.name}`);
  };

  const handleAddMagicColumn = (magicType: MagicColumnType) => {
    const config = allMagicColumns.find(m => m.type === magicType);
    if (!config) return;
    
    // Check if already exists
    if (localColumns.some(c => c.magicType === magicType)) {
      toast.error('This magic column already exists');
      return;
    }
    
    const newColumn: PipelineColumn = {
      id: `magic-${magicType}-${Date.now()}`,
      name: config.label,
      type: 'magic',
      magicType: magicType,
      isVisible: true,
      isFrozen: false,
      canDelete: true,
      canRename: false,
      width: '100px',
    };
    setLocalColumns([...localColumns, newColumn]);
    toast.success(`Added magic column: ${newColumn.name}`);
  };

  const handleRemoveColumn = (id: string) => {
    const column = localColumns.find(c => c.id === id);
    if (!column?.canDelete) {
      toast.error('This column cannot be deleted');
      return;
    }
    setLocalColumns(localColumns.filter(c => c.id !== id));
    toast.success(`Removed column: ${column.name}`);
  };

  const handleUpdateColumn = (id: string, updates: Partial<PipelineColumn>) => {
    setLocalColumns(localColumns.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const handleToggleVisibility = (id: string) => {
    const column = localColumns.find(c => c.id === id);
    if (column) {
      handleUpdateColumn(id, { isVisible: !column.isVisible });
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Find actual indices in full column array
    const draggedCol = editableColumns[draggedIndex];
    const targetCol = editableColumns[index];
    
    const actualDraggedIdx = localColumns.findIndex(c => c.id === draggedCol.id);
    const actualTargetIdx = localColumns.findIndex(c => c.id === targetCol.id);
    
    const newColumns = [...localColumns];
    const [removed] = newColumns.splice(actualDraggedIdx, 1);
    newColumns.splice(actualTargetIdx, 0, removed);
    
    setLocalColumns(newColumns);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    onColumnsChange(localColumns);
    onOpenChange(false);
    toast.success('Column settings saved');
  };

  const getColumnIcon = (column: PipelineColumn) => {
    if (column.type === 'magic') {
      return Sparkles;
    }
    if (column.columnType && columnTypeIcons[column.columnType]) {
      return columnTypeIcons[column.columnType];
    }
    return Type;
  };

  const getColumnColor = (column: PipelineColumn) => {
    if (column.type === 'magic') return '#a855f7';
    if (column.columnType && columnTypeColors[column.columnType]) {
      return columnTypeColors[column.columnType];
    }
    return '#64748b';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            Manage Columns
            <HelpTooltip content="Add, remove, reorder, and toggle visibility of columns in your pipeline table." />
          </DialogTitle>
          <DialogDescription className="text-sm">
            Drag to reorder. Click the eye to show/hide columns.
          </DialogDescription>
        </DialogHeader>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Foundational Columns Section */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Core Columns</h3>
            <div className="space-y-1.5">
              {editableColumns.filter(c => c.type === 'foundational').map((column, idx) => {
                const Icon = getColumnIcon(column);
                const color = getColumnColor(column);
                
                return (
                  <div
                    key={column.id}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{column.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleToggleVisibility(column.id)}
                    >
                      {column.isVisible ? (
                        <Eye className="h-4 w-4 text-slate-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-slate-400" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Columns Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Custom Columns</h3>
            {customColumns.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                <Type className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">No custom columns</p>
                <p className="text-xs text-slate-400">Add columns below to track custom data</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {customColumns.map((column, idx) => {
                  const editableIdx = editableColumns.findIndex(c => c.id === column.id);
                  const Icon = getColumnIcon(column);
                  const color = getColumnColor(column);
                  
                  return (
                    <div
                      key={column.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, editableIdx)}
                      onDragOver={(e) => handleDragOver(e, editableIdx)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-move",
                        draggedIndex === editableIdx && "opacity-50 scale-[0.98] shadow-lg"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                      
                      {column.canRename ? (
                        <Input
                          value={column.name}
                          onChange={(e) => handleUpdateColumn(column.id, { name: e.target.value })}
                          className="h-7 flex-1 text-sm border-slate-200"
                        />
                      ) : (
                        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                          {column.name}
                          {column.type === 'magic' && (
                            <span className="ml-1.5 text-[10px] text-purple-500 font-normal">(auto)</span>
                          )}
                        </span>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleToggleVisibility(column.id)}
                      >
                        {column.isVisible ? (
                          <Eye className="h-4 w-4 text-slate-500" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-slate-400" />
                        )}
                      </Button>
                      
                      {column.canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                          onClick={() => handleRemoveColumn(column.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Add Column Section */}
        <div className="border-t bg-slate-50 dark:bg-slate-800/50 px-5 py-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Column</h3>
          
          {/* Custom Column Types */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {customColumnTypes.map((type) => {
              const Icon = columnTypeIcons[type.type] || Type;
              const color = columnTypeColors[type.type] || '#64748b';
              return (
                <Button
                  key={type.type}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-white dark:bg-slate-900"
                  onClick={() => handleAddColumn(type.type as ColumnType)}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  {type.label}
                </Button>
              );
            })}
          </div>
          
          {/* Magic Columns */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-slate-400 mr-1 flex items-center">
              <Sparkles className="w-3 h-3 mr-1 text-purple-400" /> Magic:
            </span>
            {allMagicColumns.slice(0, 6).map((magic) => {
              const exists = localColumns.some(c => c.magicType === magic.type);
              return (
                <Button
                  key={magic.type}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 text-[11px] gap-1 bg-white dark:bg-slate-900 border-purple-200 text-purple-700",
                    exists && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => handleAddMagicColumn(magic.type)}
                  disabled={exists}
                >
                  {magic.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t gap-2 flex-wrap">
          <Button 
            variant="ghost" 
            onClick={() => {
              // Reset to only foundational columns
              const foundationalOnly = localColumns.filter(c => c.type === 'foundational');
              setLocalColumns(foundationalOnly);
              toast.success('Removed all custom columns');
            }}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 mr-auto"
          >
            Reset to Defaults
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-[#0066FF] hover:bg-[#0055dd]">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ColumnManagerModal;