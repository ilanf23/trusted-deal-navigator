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

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const th = (e.target as HTMLElement).closest('th');
    if (!th) return;
    const colIndex = th.cellIndex;
    const table = th.closest('table');
    if (!table) return;

    let maxContentWidth = 0;

    // Measure header content width
    const headerContent = th.querySelector('span');
    if (headerContent) maxContentWidth = headerContent.scrollWidth;

    // Measure all body cells at this column index
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row) => {
      const cell = row.children[colIndex] as HTMLElement | undefined;
      if (cell) {
        const inner = cell.firstElementChild as HTMLElement | null;
        maxContentWidth = Math.max(maxContentWidth, inner ? inner.scrollWidth : cell.scrollWidth);
      }
    });

    // Add padding (px-4 = 32px total) + buffer
    const autoWidth = Math.max(minWidth, Math.min(maxWidth, maxContentWidth + 40));
    onResize(columnId, autoWidth);

    // Brief purple pulse on the header for visual feedback
    const origBg = th.style.backgroundColor;
    th.style.transition = 'background-color 150ms ease';
    th.style.backgroundColor = '#d8cce8';
    setTimeout(() => { th.style.backgroundColor = origBg; }, 200);
  }, [columnId, onResize, minWidth, maxWidth]);

  return (
    <div className={cn("relative flex items-center", className)}>
      {children}
      {/* Resize handle — positioned within th's px-4 padding area */}
      <div
        className={cn(
          "absolute -right-4 top-0 bottom-0 w-3 cursor-col-resize group/resize z-10",
          "hover:bg-[#3b2778]/10 transition-colors",
          isResizing && "bg-[#3b2778]/20"
        )}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title="Drag to resize · Double-click to auto-fit"
      >
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-0.5 transition-all",
            "bg-slate-300 dark:bg-slate-600",
            "group-hover/resize:bg-[#3b2778]",
            isResizing && "bg-[#3b2778]"
          )}
        />
      </div>
    </div>
  );
};

export default ResizableColumnHeader;
