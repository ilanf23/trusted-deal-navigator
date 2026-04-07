import { Separator } from '@/components/ui/separator';
import { Search, Navigation, LayoutGrid, MessageSquare } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  icon: React.ElementType;
  shortcuts: Shortcut[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    icon: Navigation,
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette / quick search' },
      { keys: ['⌘', '/'], description: 'Toggle sidebar' },
      { keys: ['⌘', ','], description: 'Open settings' },
      { keys: ['Esc'], description: 'Close dialog or panel' },
    ],
  },
  {
    title: 'Search & Filters',
    icon: Search,
    shortcuts: [
      { keys: ['⌘', 'F'], description: 'Focus search in current view' },
      { keys: ['⌘', 'Shift', 'F'], description: 'Global search' },
      { keys: ['⌘', 'Shift', 'L'], description: 'Clear all filters' },
    ],
  },
  {
    title: 'Pipeline & Deals',
    icon: LayoutGrid,
    shortcuts: [
      { keys: ['N'], description: 'Create new lead (when pipeline focused)' },
      { keys: ['E'], description: 'Edit selected lead' },
      { keys: ['⌘', 'Enter'], description: 'Save and close current form' },
      { keys: ['Tab'], description: 'Move to next field' },
      { keys: ['Shift', 'Tab'], description: 'Move to previous field' },
    ],
  },
  {
    title: 'Communication',
    icon: MessageSquare,
    shortcuts: [
      { keys: ['C'], description: 'Compose new email (in inbox)' },
      { keys: ['R'], description: 'Reply to email (in inbox)' },
      { keys: ['⌘', 'Shift', 'Enter'], description: 'Send email' },
    ],
  },
];

const KeyboardShortcutsSection = () => {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Quick reference for keyboard shortcuts available throughout the app.
      </p>

      {shortcutGroups.map((group, groupIndex) => {
        const Icon = group.icon;
        return (
          <div key={group.title}>
            {groupIndex > 0 && <Separator className="mb-6" />}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-base font-medium">{group.title}</h3>
              </div>

              <div className="grid gap-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-xs text-muted-foreground mx-0.5">+</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-border bg-muted text-xs font-mono text-muted-foreground">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KeyboardShortcutsSection;
