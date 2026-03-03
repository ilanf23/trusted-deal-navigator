import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Loader2, Search, ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ChecklistItem {
  id: string;
  text: string;
  is_checked: boolean;
}

interface TemplateWithItems {
  id: string;
  name: string;
  items: { text: string; position: number }[];
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
  const [templateSearch, setTemplateSearch] = useState('');
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);

  const checkedCount = items.filter((i) => i.is_checked).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  // Templates query
  const { data: templates = [] } = useQuery<TemplateWithItems[]>({
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

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, templateSearch]);

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

  const loadTemplate = (tmpl: TemplateWithItems) => {
    onItemsChange(
      tmpl.items.map((ti) => ({
        id: crypto.randomUUID(),
        text: ti.text,
        is_checked: false,
      }))
    );
    onTitleChange(tmpl.name);
    setTemplatePopoverOpen(false);
    setTemplateSearch('');
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

      {/* Template search bar */}
      {templates.length > 0 && (
        <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs border border-dashed border-border rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">Search templates...</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" sideOffset={4}>
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full text-xs bg-transparent pl-8 pr-3 py-1.5 outline-none placeholder:text-muted-foreground/50"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {filteredTemplates.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">No templates found</div>
              ) : (
                filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => loadTemplate(t)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-xs hover:bg-muted transition-colors",
                      "flex items-center justify-between gap-2"
                    )}
                  >
                    <span className="font-medium text-foreground truncate">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{t.items.length} items</span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
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
