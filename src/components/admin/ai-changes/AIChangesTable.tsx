import { format } from 'date-fns';
import { Loader2, Undo2, Redo2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AIChange, AIBatch } from '@/hooks/useAIChanges';

interface AIChangesTableProps {
  changes: AIChange[];
  batches: AIBatch[];
  isLoading: boolean;
  selectedChangeId: string | null;
  onSelectChange: (change: AIChange) => void;
  onUndo: (changeId: string) => void;
  onRedo: (changeId: string) => void;
  onUndoBatch: (batchId: string) => void;
}

const statusColors: Record<string, string> = {
  applied: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  undone: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  redone: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const operationLabels: Record<string, string> = {
  insert: 'Create',
  update: 'Update',
  delete: 'Delete',
};

const AIChangesTable = ({
  changes,
  batches,
  isLoading,
  selectedChangeId,
  onSelectChange,
  onUndo,
  onRedo,
  onUndoBatch,
}: AIChangesTableProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-sm text-muted-foreground">No AI changes found</p>
        <p className="text-xs text-muted-foreground mt-1">Changes made by the AI assistant will appear here</p>
      </div>
    );
  }

  // Group changes by batch
  const grouped = new Map<string | null, AIChange[]>();
  for (const change of changes) {
    const key = change.batch_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(change);
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Time</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Mode</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change, i) => {
              const isFirstInBatch = change.batch_id && (i === 0 || changes[i - 1]?.batch_id !== change.batch_id);
              const batchChanges = change.batch_id ? grouped.get(change.batch_id) : null;
              const batch = change.batch_id ? batches.find(b => b.id === change.batch_id) : null;

              return (
                <tr
                  key={change.id}
                  onClick={() => onSelectChange(change)}
                  className={cn(
                    "border-b hover:bg-muted/30 cursor-pointer transition-colors",
                    selectedChangeId === change.id && "bg-primary/5",
                    change.batch_id && !isFirstInBatch && "border-l-2 border-l-primary/20"
                  )}
                >
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(change.created_at), 'MMM d, h:mm a')}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {change.team_member?.name || 'Unknown'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {change.mode}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {operationLabels[change.operation] || change.operation}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{change.target_table}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs max-w-[300px] truncate">
                    {change.description}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={cn("text-[10px]", statusColors[change.status])}>
                      {change.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(change.status === 'applied' || change.status === 'redone') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); onUndo(change.id); }}
                          title="Undo"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {change.status === 'undone' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); onRedo(change.id); }}
                          title="Redo"
                        >
                          <Redo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AIChangesTable;
