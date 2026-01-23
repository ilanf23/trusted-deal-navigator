import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, MoreHorizontal, Trash2, X, Tag, User, ChevronDown, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
}

interface PipelineBulkToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMoveBoxes: () => void;
  onDeleteBoxes?: () => void;
  onAssignOwner?: (ownerId: string) => void;
  teamMembers?: TeamMember[];
  className?: string;
}

const PipelineBulkToolbar = ({
  selectedCount,
  onClearSelection,
  onMoveBoxes,
  onDeleteBoxes,
  onAssignOwner,
  teamMembers = [],
  className,
}: PipelineBulkToolbarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2 bg-slate-800 dark:bg-slate-900 text-white rounded-lg shadow-lg border border-slate-700",
        className
      )}
    >
      {/* Left side - selection info */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} {selectedCount === 1 ? 'box' : 'boxes'} selected
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Move to Stage/Pipeline */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveBoxes}
          className="text-white hover:bg-white/10 gap-1.5 h-8"
        >
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Move</span>
        </Button>

        {/* Assign Owner */}
        {onAssignOwner && teamMembers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 gap-1.5 h-8"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Assign</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-white dark:bg-slate-800 z-50">
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">Assign to</div>
              {teamMembers.map((member) => (
                <DropdownMenuItem
                  key={member.id}
                  onClick={() => onAssignOwner(member.id)}
                  className="cursor-pointer"
                >
                  {member.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Delete */}
        {onDeleteBoxes && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteBoxes}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5 h-8"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        )}

        {/* More Actions */}
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
          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-800 z-50">
            <DropdownMenuItem onClick={onMoveBoxes} className="cursor-pointer">
              <Layers className="h-4 w-4 mr-2" />
              Move boxes
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" disabled>
              <Tag className="h-4 w-4 mr-2" />
              Add tags
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
