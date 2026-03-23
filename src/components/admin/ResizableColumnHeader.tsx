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
          "absolute -right-5 -top-3 -bottom-3 w-2 cursor-col-resize group/resize z-10",
          "hover:bg-[#3b2778]/20 transition-colors",
          isResizing && "bg-[#3b2778]/30"
        )}
        onMouseDown={handleMouseDown}
      >
        <div 
          className={cn(
            "absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 transition-all",
            "bg-[#3b2778]",
            "opacity-0 group-hover/col:opacity-100 group-hover/resize:opacity-100",
            isResizing && "opacity-100"
          )}
        />
      </div>
    </div>
  );
};

export default ResizableColumnHeader;
