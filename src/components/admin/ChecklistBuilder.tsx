import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Loader2 } from 'lucide-react';

export interface ChecklistItem {
  id: string;
  text: string;
  is_checked: boolean;
}

interface ChecklistBuilderProps {
  title: string;
  onTitleChange: (title: string) => void;
  items: ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
  newItemText: string;
  onNewItemTextChange: (text: string) => void;
  onSave: () => void;
  saving: boolean;
  onSaveAsTemplate: () => void;
}

export default function ChecklistBuilder({
  title,
  onTitleChange,
  items,
  onItemsChange,
  newItemText,
  onNewItemTextChange,
  onSave,
  saving,
  onSaveAsTemplate,
}: ChecklistBuilderProps) {
  const checkedCount = items.filter((i) => i.is_checked).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  // Templates query
  const { data: templates } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: async () => {
      const { data: tmpl } = await supabase
        .from('checklist_templates')
        .select('id, name')
        .order('created_at', { ascending: false });
      if (!tmpl || tmpl.length === 0) return [];
      const ids = tmpl.map((t) => t.id);
      const { data: tItems } = await supabase
        .from('checklist_template_items')
        .select('*')
        .in('template_id', ids)
        .order('position');
      return tmpl.map((t) => ({
        ...t,
        items: (tItems ?? []).filter((i) => i.template_id === t.id),
      }));
    },
  });

  const handleAddItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    onItemsChange([
      ...items,
      { id: crypto.randomUUID(), text, is_checked: false },
    ]);
    onNewItemTextChange('');
  };

  const toggleItem = (id: string) => {
    onItemsChange(
      items.map((i) => (i.id === id ? { ...i, is_checked: !i.is_checked } : i))
    );
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter((i) => i.id !== id));
  };

  const loadTemplate = (tmpl: { items: { text: string; position: number }[] }) => {
    onItemsChange(
      tmpl.items.map((ti) => ({
        id: crypto.randomUUID(),
        text: ti.text,
        is_checked: false,
      }))
    );
  };

  return (
    <div className="space-y-4">
      {/* Title input */}
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="w-full text-sm font-semibold bg-transparent border-b border-border pb-1 outline-none focus:border-blue-500 transition-colors placeholder:text-muted-foreground/50"
        placeholder="Checklist title..."
      />

      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{checkedCount}/{total} completed</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Template chips (shown when list is empty) */}
      {items.length === 0 && templates && templates.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Load from template:</span>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => loadTemplate(t)}
                className="inline-flex items-center px-2.5 py-1 text-[11px] font-medium rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Item list */}
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 group px-1 py-1 rounded-md hover:bg-muted/40 transition-colors"
            >
              <Checkbox
                checked={item.is_checked}
                onCheckedChange={() => toggleItem(item.id)}
                className="h-4 w-4"
              />
              <span
                className={`flex-1 text-xs ${
                  item.is_checked
                    ? 'line-through text-muted-foreground'
                    : 'text-foreground'
                }`}
              >
                {item.text}
              </span>
              <button
                onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add item input */}
      <input
        value={newItemText}
        onChange={(e) => onNewItemTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAddItem();
        }}
        placeholder="Add an item and press Enter..."
        className="w-full text-xs bg-transparent border border-dashed border-border rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors placeholder:text-muted-foreground/50"
      />

      {/* Actions row */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSaveAsTemplate}
          disabled={items.length === 0}
          className="text-xs text-muted-foreground hover:text-foreground h-8 px-3"
        >
          Save as template
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving || items.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 rounded-lg"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
          Save Checklist
        </Button>
      </div>
    </div>
  );
}
