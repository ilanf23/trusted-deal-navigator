import { cn } from '@/lib/utils';

interface AIChangeDiffProps {
  operation: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any>;
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const AIChangeDiff = ({ operation, oldValues, newValues }: AIChangeDiffProps) => {
  if (operation === 'insert') {
    return (
      <div className="space-y-1.5">
        {Object.entries(newValues).map(([key, value]) => (
          <div key={key} className="flex gap-2 text-xs">
            <span className="text-muted-foreground font-mono min-w-[80px]">{key}:</span>
            <span className="text-green-600 dark:text-green-400 font-mono break-all">
              + {formatValue(value)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (operation === 'delete' && oldValues) {
    return (
      <div className="space-y-1.5">
        {Object.entries(oldValues).map(([key, value]) => (
          <div key={key} className="flex gap-2 text-xs">
            <span className="text-muted-foreground font-mono min-w-[80px]">{key}:</span>
            <span className="text-red-600 dark:text-red-400 font-mono break-all">
              - {formatValue(value)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Update: show old → new for each changed field
  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues),
  ]);

  return (
    <div className="space-y-2">
      {Array.from(allKeys).map((key) => {
        const oldVal = oldValues?.[key];
        const newVal = newValues[key];
        const changed = formatValue(oldVal) !== formatValue(newVal);

        return (
          <div key={key} className="rounded-md border p-2">
            <p className="text-[10px] font-mono text-muted-foreground mb-1">{key}</p>
            <div className="flex flex-col gap-0.5">
              {oldVal !== undefined && (
                <div className={cn(
                  "text-xs font-mono px-1.5 py-0.5 rounded",
                  changed ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "text-muted-foreground"
                )}>
                  {changed && <span className="mr-1">-</span>}
                  {formatValue(oldVal)}
                </div>
              )}
              {newVal !== undefined && (
                <div className={cn(
                  "text-xs font-mono px-1.5 py-0.5 rounded",
                  changed ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "text-muted-foreground"
                )}>
                  {changed && <span className="mr-1">+</span>}
                  {formatValue(newVal)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AIChangeDiff;
