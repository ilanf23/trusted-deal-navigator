import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Maximize2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type KanbanCardShellProps = {
  id: string;
  title: string;
  onClick: () => void;
  onExpand?: () => void;
  isDragging?: boolean;
  body?: ReactNode;
  footer?: ReactNode;
};

export function KanbanCardShell({
  id,
  title,
  onClick,
  onExpand,
  isDragging,
  body,
  footer,
}: KanbanCardShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="group/card cursor-grab active:cursor-grabbing shadow-sm border border-border/60 hover:shadow-md transition-shadow bg-card overflow-hidden"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <div className="p-3 pb-2.5">
          <div className="flex items-start justify-between gap-1 mb-2">
            <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">
              {title}
            </p>
            {onExpand && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand();
                }}
                className="shrink-0 mt-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity"
              >
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {body}
        </div>
        {footer && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/50 bg-muted/20">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
}
