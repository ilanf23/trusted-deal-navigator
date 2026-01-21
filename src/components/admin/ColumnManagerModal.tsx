import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  GripVertical, 
  Plus, 
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
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import HelpTooltip from '@/components/ui/help-tooltip';

type ColumnType = 'free_form' | 'date' | 'checkbox' | 'dropdown' | 'tag' | 'formula' | 'assigned_to' | 'contact';

interface PipelineColumn {
  id: string;
  pipeline_id: string;
  name: string;
  column_type: ColumnType;
  position: number;
  is_visible: boolean;
  is_frozen: boolean;
  options: string[];
  formula?: string;
  settings: Record<string, unknown>;
}

interface ColumnManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId?: string;
  onColumnsChange?: () => void;
}

const columnTypeConfig: Record<ColumnType, { icon: React.ElementType; label: string; description: string; color: string }> = {
  free_form: { icon: Type, label: 'Free Form', description: 'Text or numbers', color: '#64748b' },
  date: { icon: Calendar, label: 'Date', description: 'Date picker', color: '#0066FF' },
  checkbox: { icon: CheckSquare, label: 'Checkbox', description: 'Yes/No toggle', color: '#10b981' },
  dropdown: { icon: ChevronDown, label: 'Dropdown', description: 'Single selection', color: '#8b5cf6' },
  tag: { icon: Tag, label: 'Tag', description: 'Multiple selections', color: '#f59e0b' },
  formula: { icon: Code, label: 'Formula', description: 'Calculated field', color: '#ec4899' },
  assigned_to: { icon: UserCircle, label: 'Assigned To', description: 'Team member', color: '#06b6d4' },
  contact: { icon: Contact, label: 'Contact', description: 'Contact info', color: '#FF8000' },
};

const ColumnManagerModal = ({ 
  open, 
  onOpenChange, 
  pipelineId,
  onColumnsChange 
}: ColumnManagerModalProps) => {
  const queryClient = useQueryClient();
  const [localColumns, setLocalColumns] = useState<PipelineColumn[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingOptions, setEditingOptions] = useState<string | null>(null);
  const [newOptionText, setNewOptionText] = useState('');

  // Fetch existing columns
  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['pipeline-columns', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      const { data, error } = await supabase
        .from('pipeline_columns')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('position');
      if (error) throw error;
      return data as PipelineColumn[];
    },
    enabled: !!pipelineId && open,
  });

  useEffect(() => {
    if (open && columns) {
      setLocalColumns(columns.map(c => ({
        ...c,
        options: Array.isArray(c.options) ? c.options : []
      })));
    }
  }, [open, columns]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!pipelineId) throw new Error('No pipeline ID');
      
      // Get current columns from DB
      const { data: existing } = await supabase
        .from('pipeline_columns')
        .select('id')
        .eq('pipeline_id', pipelineId);
      
      const existingIds = new Set(existing?.map(c => c.id) || []);
      const localIds = new Set(localColumns.map(c => c.id));
      
      // Delete removed columns
      const toDelete = [...existingIds].filter(id => !localIds.has(id));
      if (toDelete.length > 0) {
        await supabase.from('pipeline_columns').delete().in('id', toDelete);
      }
      
      // Upsert all local columns
      for (let i = 0; i < localColumns.length; i++) {
        const col = localColumns[i];
        const isNew = col.id.startsWith('new-');
        
        if (isNew) {
          await supabase.from('pipeline_columns').insert({
            pipeline_id: pipelineId,
            name: col.name,
            column_type: col.column_type,
            position: i,
            is_visible: col.is_visible,
            is_frozen: col.is_frozen,
            options: col.options as unknown as Record<string, never>,
            formula: col.formula,
            settings: col.settings as unknown as Record<string, never>,
          });
        } else {
          await supabase.from('pipeline_columns').update({
            name: col.name,
            column_type: col.column_type,
            position: i,
            is_visible: col.is_visible,
            is_frozen: col.is_frozen,
            options: col.options as unknown as Record<string, never>,
            formula: col.formula,
            settings: col.settings as unknown as Record<string, never>,
          }).eq('id', col.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-columns'] });
      onColumnsChange?.();
      toast.success('Columns saved successfully');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save columns: ${error.message}`);
    },
  });

  const handleAddColumn = (type: ColumnType = 'free_form') => {
    const newColumn: PipelineColumn = {
      id: `new-${Date.now()}`,
      pipeline_id: pipelineId || '',
      name: `New ${columnTypeConfig[type].label}`,
      column_type: type,
      position: localColumns.length,
      is_visible: true,
      is_frozen: false,
      options: [],
      settings: {},
    };
    setLocalColumns([...localColumns, newColumn]);
  };

  const handleRemoveColumn = (id: string) => {
    setLocalColumns(localColumns.filter(c => c.id !== id));
  };

  const handleUpdateColumn = (id: string, updates: Partial<PipelineColumn>) => {
    setLocalColumns(localColumns.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const handleAddOption = (columnId: string) => {
    if (!newOptionText.trim()) return;
    const column = localColumns.find(c => c.id === columnId);
    if (column) {
      handleUpdateColumn(columnId, {
        options: [...column.options, newOptionText.trim()]
      });
      setNewOptionText('');
    }
  };

  const handleRemoveOption = (columnId: string, optionIndex: number) => {
    const column = localColumns.find(c => c.id === columnId);
    if (column) {
      handleUpdateColumn(columnId, {
        options: column.options.filter((_, i) => i !== optionIndex)
      });
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newColumns = [...localColumns];
    const dragged = newColumns[draggedIndex];
    newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, dragged);
    setLocalColumns(newColumns);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            Custom Columns
            <HelpTooltip content="Add custom fields to track any information about your leads. These columns appear in the pipeline table." />
          </DialogTitle>
          <DialogDescription>
            Add, remove, and reorder columns. Drag to change order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0066FF]" />
            </div>
          ) : localColumns.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Type className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No custom columns yet</p>
              <p className="text-xs">Click "Add Column" to create one</p>
            </div>
          ) : (
            localColumns.map((column, index) => {
              const config = columnTypeConfig[column.column_type];
              const Icon = config.icon;
              const needsOptions = column.column_type === 'dropdown' || column.column_type === 'tag';
              
              return (
                <div
                  key={column.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "p-3 bg-slate-50 rounded-lg border border-slate-200 transition-all",
                    draggedIndex === index && "opacity-50 scale-[0.98]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="cursor-grab text-slate-400 hover:text-slate-600">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <Input
                        value={column.name}
                        onChange={(e) => handleUpdateColumn(column.id, { name: e.target.value })}
                        className="h-8 text-sm font-medium border-slate-200"
                        placeholder="Column name"
                      />
                    </div>
                    
                    <Select
                      value={column.column_type}
                      onValueChange={(value: ColumnType) => handleUpdateColumn(column.id, { column_type: value, options: [] })}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(columnTypeConfig).map(([type, cfg]) => (
                          <SelectItem key={type} value={type} className="text-xs">
                            <div className="flex items-center gap-2">
                              <cfg.icon className="w-3 h-3" style={{ color: cfg.color }} />
                              {cfg.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleUpdateColumn(column.id, { is_visible: !column.is_visible })}
                        title={column.is_visible ? 'Hide column' : 'Show column'}
                      >
                        {column.is_visible ? (
                          <Eye className="h-4 w-4 text-slate-500" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-slate-400" />
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                        onClick={() => handleRemoveColumn(column.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Options editor for dropdown/tag types */}
                  {needsOptions && (
                    <div className="mt-3 ml-11 pl-3 border-l-2 border-slate-200">
                      <div className="text-xs font-medium text-slate-500 mb-2">Options</div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {column.options.map((opt, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-xs py-0.5 pr-1 gap-1"
                          >
                            {opt}
                            <button
                              onClick={() => handleRemoveOption(column.id, i)}
                              className="ml-1 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                        {column.options.length === 0 && (
                          <span className="text-xs text-slate-400">No options added</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={editingOptions === column.id ? newOptionText : ''}
                          onChange={(e) => {
                            setEditingOptions(column.id);
                            setNewOptionText(e.target.value);
                          }}
                          onFocus={() => setEditingOptions(column.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddOption(column.id);
                            }
                          }}
                          placeholder="Add option..."
                          className="h-7 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleAddOption(column.id)}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Formula editor */}
                  {column.column_type === 'formula' && (
                    <div className="mt-3 ml-11 pl-3 border-l-2 border-slate-200">
                      <div className="text-xs font-medium text-slate-500 mb-2">Formula (JavaScript)</div>
                      <Input
                        value={column.formula || ''}
                        onChange={(e) => handleUpdateColumn(column.id, { formula: e.target.value })}
                        placeholder="e.g., row.deal_size * 0.1"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Column Buttons */}
        <div className="border-t pt-3">
          <div className="text-xs font-medium text-slate-500 mb-2">Add Column</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(columnTypeConfig).map(([type, config]) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => handleAddColumn(type as ColumnType)}
              >
                <config.icon className="w-3 h-3" style={{ color: config.color }} />
                {config.label}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-[#0066FF] hover:bg-[#0055dd]"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Columns'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ColumnManagerModal;