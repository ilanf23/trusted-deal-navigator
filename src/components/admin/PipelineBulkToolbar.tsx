import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ArrowRight, MoreHorizontal, Trash2, X, Tag, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineBulkToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMoveBoxes: () => void;
  onDeleteBoxes?: () => void;
  className?: string;
}

const PipelineBulkToolbar = ({
  selectedCount,
  onClearSelection,
  onMoveBoxes,
  onDeleteBoxes,
  className,
}: PipelineBulkToolbarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 bg-[#0066FF] text-white rounded-lg shadow-lg animate-in slide-in-from-bottom-2 duration-200",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? 'box' : 'boxes'} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Quick Actions */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveBoxes}
          className="text-white hover:bg-white/10 gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          Move boxes
        </Button>

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white hover:bg-white/10"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onMoveBoxes} className="cursor-pointer">
              <ArrowRight className="h-4 w-4 mr-2" />
              Move boxes
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" disabled>
              <Tag className="h-4 w-4 mr-2" />
              Add tags
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" disabled>
              <User className="h-4 w-4 mr-2" />
              Assign owner
            </DropdownMenuItem>
            {onDeleteBoxes && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDeleteBoxes}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete boxes
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default PipelineBulkToolbar;
