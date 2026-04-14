import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface QuickEventData {
  start: Date;
  end: Date;
  allDay: boolean;
  position: { top: number; left: number };
}

interface QuickEventPopoverProps {
  data: QuickEventData;
  onSave: (title: string, start: Date, end: Date) => void;
  onMoreOptions: (title: string, start: Date, end: Date) => void;
  onClose: () => void;
}

export function QuickEventPopover({
  data,
  onSave,
  onMoreOptions,
  onClose,
}: QuickEventPopoverProps) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), data.start, data.end);
  };

  const handleMoreOptions = () => {
    onMoreOptions(title.trim(), data.start, data.end);
  };

  const timeLabel = data.allDay
    ? format(data.start, 'EEEE, MMMM d')
    : `${format(data.start, 'EEE, MMM d · h:mm a')} – ${format(data.end, 'h:mm a')}`;

  const { top, left } = data.position;
  const clampedLeft = Math.min(left, window.innerWidth - 320);
  const clampedTop = Math.min(top, window.innerHeight - 200);

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-[300px] bg-popover border border-border rounded-lg shadow-lg"
      style={{ top: clampedTop, left: clampedLeft }}
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-xs text-muted-foreground">{timeLabel}</span>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-accent"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-3 pt-2 space-y-3">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add title"
          className="border-0 border-b border-border rounded-none px-0 text-base font-medium focus-visible:ring-0 focus-visible:border-primary"
        />

        <div className="flex items-center gap-2 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleMoreOptions}
            className="text-xs"
          >
            More options
          </Button>
          <Button type="submit" size="sm" disabled={!title.trim()} className="text-xs">
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
