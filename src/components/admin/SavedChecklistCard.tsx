import { useState, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface SavedChecklist {
  id: string;
  lead_id: string;
  title: string;
  created_by: string | null;
  activity_id: string | null;
  created_at: string;
  items: SavedChecklistItem[];
}

export interface SavedChecklistItem {
  id: string;
  checklist_id: string;
  text: string;
  is_checked: boolean;
  position: number;
}

interface SavedChecklistCardProps {
  checklist: SavedChecklist;
  formatDate: (dateStr: string) => string;
  leadId: string;
}

export default function SavedChecklistCard({ checklist, formatDate, leadId }: SavedChecklistCardProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);

  const checkedCount = checklist.items.filter((i) => i.is_checked).length;
  const total = checklist.items.length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
  const isComplete = checkedCount === total && total > 0;

  const handleToggleItem = useCallback(async (itemId: string, currentChecked: boolean) => {
    setTogglingItem(itemId);
    const { error } = await supabase
      .from('underwriting_checklist_items')
      .update({ is_checked: !currentChecked })
      .eq('id', itemId);
    setTogglingItem(null);
    if (error) {
      toast.error('Failed to update item');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['lead-saved-checklists', leadId] });
  }, [leadId, queryClient]);

  return (
    <div className={`rounded-xl bg-card border transition-colors ${expanded ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-border hover:border-border'}`}>
      <button
        type="button"
        className="flex gap-3 p-3 w-full text-left cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
          <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-foreground">{checklist.title || 'Checklist'}</span>
            <span className="text-[10px] text-muted-foreground">{formatDate(checklist.created_at)}</span>
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-4 ${
                isComplete
                  ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                  : ''
              }`}
            >
              {checkedCount}/{total}
            </Badge>
          </div>
          {/* Mini progress bar */}
          <div className="h-1 w-full max-w-[200px] bg-muted rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isComplete ? 'bg-emerald-500' : 'bg-blue-600'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="space-y-0.5">
            {checklist.items
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-muted/40 transition-colors"
                >
                  {togglingItem === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Checkbox
                      checked={item.is_checked}
                      onCheckedChange={() => handleToggleItem(item.id, item.is_checked)}
                      className="h-4 w-4"
                    />
                  )}
                  <span
                    className={`flex-1 text-xs ${
                      item.is_checked
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
          </div>
          {checklist.created_by && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Created by {checklist.created_by}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
