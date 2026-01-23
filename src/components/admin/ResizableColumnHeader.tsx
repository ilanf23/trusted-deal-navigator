import { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ResizableColumnHeaderProps {
  columnId: string;
  currentWidth: string;
  onResize: (columnId: string, newWidth: number) => void;
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
  maxWidth?: number;
}

const ResizableColumnHeader = ({
  columnId,
  currentWidth,
  onResize,
  children,
  className,
  minWidth = 60,
  maxWidth = 500,
}: ResizableColumnHeaderProps) => {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const parseWidth = (width: string): number => {
    return parseInt(width.replace('px', ''), 10) || 100;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = parseWidth(currentWidth);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + deltaX));
      onResize(columnId, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnId, currentWidth, onResize, minWidth, maxWidth]);

  return (
    <div className={cn("relative flex items-center", className)}>
      {children}
      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group/resize z-10",
          "hover:bg-primary/30 transition-colors",
          isResizing && "bg-primary/50"
        )}
        onMouseDown={handleMouseDown}
      >
        <div 
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full transition-all",
            "bg-slate-300 dark:bg-slate-600",
            "group-hover/resize:bg-primary group-hover/resize:h-6",
            isResizing && "bg-primary h-6"
          )}
        />
      </div>
    </div>
  );
};

export default ResizableColumnHeader;
