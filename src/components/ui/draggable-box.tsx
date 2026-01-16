import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { GripVertical, Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from './button';

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface DraggableBoxProps {
  id: string;
  title: string;
  icon?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  defaultCorner?: Corner;
  headerContent?: ReactNode;
  className?: string;
  isMinimized?: boolean;
  onMinimize?: () => void;
  minimizedContent?: ReactNode;
}

const SNAP_THRESHOLD = 50;
const EDGE_PADDING = 16;

export function DraggableBox({
  id,
  title,
  icon,
  isOpen,
  onClose,
  children,
  defaultWidth = 420,
  defaultHeight = 500,
  minWidth = 300,
  minHeight = 300,
  maxWidth = 800,
  maxHeight = 900,
  defaultCorner = 'bottom-right',
  headerContent,
  className,
  isMinimized = false,
  onMinimize,
  minimizedContent,
}: DraggableBoxProps) {
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem(`draggable-${id}-position`);
    if (saved) return JSON.parse(saved);
    return getCornerPosition(defaultCorner, defaultWidth, defaultHeight);
  });
  
  const [size, setSize] = useState<Size>(() => {
    const saved = localStorage.getItem(`draggable-${id}-size`);
    if (saved) return JSON.parse(saved);
    return { width: defaultWidth, height: defaultHeight };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  
  const boxRef = useRef<HTMLDivElement>(null);

  function getCornerPosition(corner: Corner, width: number, height: number): Position {
    const padding = EDGE_PADDING;
    switch (corner) {
      case 'top-left':
        return { x: padding, y: padding };
      case 'top-right':
        return { x: window.innerWidth - width - padding, y: padding };
      case 'bottom-left':
        return { x: padding, y: window.innerHeight - height - padding };
      case 'bottom-right':
        return { x: window.innerWidth - width - padding, y: window.innerHeight - height - padding };
    }
  }

  // Save position and size to localStorage
  useEffect(() => {
    if (!isDragging && !isResizing) {
      localStorage.setItem(`draggable-${id}-position`, JSON.stringify(position));
      localStorage.setItem(`draggable-${id}-size`, JSON.stringify(size));
    }
  }, [position, size, isDragging, isResizing, id]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - size.width - EDGE_PADDING),
        y: Math.min(prev.y, window.innerHeight - size.height - EDGE_PADDING),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size]);

  // Dragging logic
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      // Boundary checking
      newX = Math.max(EDGE_PADDING, Math.min(newX, window.innerWidth - size.width - EDGE_PADDING));
      newY = Math.max(EDGE_PADDING, Math.min(newY, window.innerHeight - size.height - EDGE_PADDING));

      // Corner snapping
      const corners: { corner: Corner; x: number; y: number }[] = [
        { corner: 'top-left', x: EDGE_PADDING, y: EDGE_PADDING },
        { corner: 'top-right', x: window.innerWidth - size.width - EDGE_PADDING, y: EDGE_PADDING },
        { corner: 'bottom-left', x: EDGE_PADDING, y: window.innerHeight - size.height - EDGE_PADDING },
        { corner: 'bottom-right', x: window.innerWidth - size.width - EDGE_PADDING, y: window.innerHeight - size.height - EDGE_PADDING },
      ];

      for (const c of corners) {
        if (Math.abs(newX - c.x) < SNAP_THRESHOLD && Math.abs(newY - c.y) < SNAP_THRESHOLD) {
          newX = c.x;
          newY = c.y;
          break;
        }
      }

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, size]);

  // Resizing logic
  useEffect(() => {
    if (!isResizing || !resizeDirection) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = boxRef.current?.getBoundingClientRect();
      if (!rect) return;

      let newWidth = size.width;
      let newHeight = size.height;
      let newX = position.x;
      let newY = position.y;

      if (resizeDirection.includes('e')) {
        newWidth = Math.min(maxWidth, Math.max(minWidth, e.clientX - position.x));
      }
      if (resizeDirection.includes('w')) {
        const delta = position.x - e.clientX;
        const proposedWidth = size.width + delta;
        if (proposedWidth >= minWidth && proposedWidth <= maxWidth) {
          newWidth = proposedWidth;
          newX = e.clientX;
        }
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.min(maxHeight, Math.max(minHeight, e.clientY - position.y));
      }
      if (resizeDirection.includes('n')) {
        const delta = position.y - e.clientY;
        const proposedHeight = size.height + delta;
        if (proposedHeight >= minHeight && proposedHeight <= maxHeight) {
          newHeight = proposedHeight;
          newY = e.clientY;
        }
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDirection, position, size, minWidth, minHeight, maxWidth, maxHeight]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleResizeStart = (direction: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
  };

  const snapToCorner = (corner: Corner) => {
    setPosition(getCornerPosition(corner, size.width, size.height));
  };

  if (!isOpen) return null;

  // Minimized state
  if (isMinimized && minimizedContent) {
    const minimizedPos = getCornerPosition('bottom-right', 150, 50);
    return (
      <div
        className="fixed z-50"
        style={{ left: position.x, top: position.y }}
      >
        {minimizedContent}
      </div>
    );
  }

  return (
    <>
      {/* Drag/Resize overlay */}
      {(isDragging || isResizing) && (
        <div className="fixed inset-0 z-40 cursor-move" style={{ cursor: isResizing ? 'nwse-resize' : 'move' }} />
      )}

      <div
        ref={boxRef}
        className={cn(
          "fixed z-50 bg-card border rounded-lg shadow-2xl flex flex-col overflow-hidden",
          isDragging && "opacity-90",
          className
        )}
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
        }}
      >
        {/* Resize handles */}
        <div
          className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-10"
          onMouseDown={handleResizeStart('nw')}
        />
        <div
          className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-10"
          onMouseDown={handleResizeStart('ne')}
        />
        <div
          className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-10"
          onMouseDown={handleResizeStart('sw')}
        />
        <div
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-10"
          onMouseDown={handleResizeStart('se')}
        />
        <div
          className="absolute top-0 left-3 right-3 h-1 cursor-n-resize"
          onMouseDown={handleResizeStart('n')}
        />
        <div
          className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize"
          onMouseDown={handleResizeStart('s')}
        />
        <div
          className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize"
          onMouseDown={handleResizeStart('w')}
        />
        <div
          className="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize"
          onMouseDown={handleResizeStart('e')}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between p-3 border-b bg-muted/50 cursor-move shrink-0 select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            {icon}
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            {headerContent}
            {/* Corner snap buttons */}
            <div className="flex gap-0.5 mr-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[10px]"
                onClick={() => snapToCorner('top-left')}
                title="Snap to top-left"
              >
                ↖
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[10px]"
                onClick={() => snapToCorner('top-right')}
                title="Snap to top-right"
              >
                ↗
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[10px]"
                onClick={() => snapToCorner('bottom-left')}
                title="Snap to bottom-left"
              >
                ↙
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[10px]"
                onClick={() => snapToCorner('bottom-right')}
                title="Snap to bottom-right"
              >
                ↘
              </Button>
            </div>
            {onMinimize && (
              <Button variant="ghost" size="icon" onClick={onMinimize} className="h-7 w-7">
                <Minimize2 className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
