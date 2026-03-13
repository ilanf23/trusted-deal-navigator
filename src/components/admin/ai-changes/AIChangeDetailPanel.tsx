import { format } from 'date-fns';
import { X, Undo2, Redo2, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AIChange } from '@/hooks/useAIChanges';
import AIChangeDiff from './AIChangeDiff';

interface AIChangeDetailPanelProps {
  change: AIChange;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const AIChangeDetailPanel = ({ change, onClose, onUndo, onRedo }: AIChangeDetailPanelProps) => {
  return (
    <div className="w-[380px] border rounded-lg bg-background shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Change Detail</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm font-medium">{change.description}</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Time</p>
              <p className="text-xs">{format(new Date(change.created_at), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">User</p>
              <p className="text-xs">{change.team_member?.name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Mode</p>
              <Badge variant="outline" className="text-[10px] capitalize">{change.mode}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Badge variant="outline" className="text-[10px] capitalize">{change.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Table</p>
              <p className="text-xs font-mono">{change.target_table}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Operation</p>
              <p className="text-xs capitalize">{change.operation}</p>
            </div>
          </div>

          {/* AI Reasoning */}
          {change.ai_reasoning && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">AI Reasoning</p>
              <p className="text-xs bg-muted/50 rounded-md p-2">{change.ai_reasoning}</p>
            </div>
          )}

          {/* Diff */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Changes</p>
            <AIChangeDiff
              operation={change.operation}
              oldValues={change.old_values}
              newValues={change.new_values}
            />
          </div>

          {/* Model */}
          {change.model_used && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Model</p>
              <p className="text-xs font-mono">{change.model_used}</p>
            </div>
          )}

          {/* Batch info */}
          {change.batch_id && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Batch</p>
              <p className="text-xs font-mono">{change.batch_id.slice(0, 8)}...</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="border-t p-3 flex gap-2">
        {(change.status === 'applied' || change.status === 'redone') && (
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onUndo}>
            <Undo2 className="h-3 w-3 mr-1.5" />
            Undo Change
          </Button>
        )}
        {change.status === 'undone' && (
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onRedo}>
            <Redo2 className="h-3 w-3 mr-1.5" />
            Redo Change
          </Button>
        )}
      </div>
    </div>
  );
};

export default AIChangeDetailPanel;
