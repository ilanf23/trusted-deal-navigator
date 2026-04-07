import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import SceneThemeToggle from '@/components/ui/SceneThemeToggle';
import { Separator } from '@/components/ui/separator';

const themeOptions = [
  {
    value: 'light',
    label: 'Light',
    description: 'A clean, bright appearance',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Easy on the eyes in low light',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Matches your OS preference',
    icon: Monitor,
  },
] as const;

const AppearanceSection = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">Theme</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how the application looks to you.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = theme === option.value;
          return (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors cursor-pointer',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-medium">Preview</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Toggle the scene to quickly switch between light and dark.
        </p>
        <SceneThemeToggle />
      </div>
    </div>
  );
};

export default AppearanceSection;
