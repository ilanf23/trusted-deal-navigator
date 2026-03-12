import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRightLeft, Maximize2 } from 'lucide-react';
import { pagesBySection, pageRegistry } from './pageRegistry';
import { useSplitView } from '@/contexts/SplitViewContext';

interface PageSelectorProps {
  side: 'left' | 'right';
}

const sectionOrder = ['Top', 'CRM', 'Workspace', 'Tools'];

const PageSelector = ({ side }: PageSelectorProps) => {
  const { leftPage, rightPage, setLeftPage, setRightPage, swapPanels, exitSplitView } = useSplitView();

  const currentPage = side === 'left' ? leftPage : rightPage;
  const setPage = side === 'left' ? setLeftPage : setRightPage;
  const entry = pageRegistry.get(currentPage);

  const handleExpand = () => {
    // Exit split view — the current browser route stays as-is
    exitSplitView();
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
      <Select value={currentPage} onValueChange={setPage}>
        <SelectTrigger className="h-7 w-[180px] text-xs border-none bg-transparent shadow-none focus:ring-0 focus:ring-offset-0">
          <div className="flex items-center gap-1.5">
            {entry && <entry.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {sectionOrder.map(section => {
            const items = pagesBySection[section];
            if (!items?.length) return null;
            return (
              <SelectGroup key={section}>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground pl-2">
                  {section}
                </SelectLabel>
                {items.map(page => (
                  <SelectItem key={page.key} value={page.key} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <page.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {page.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-0.5">
        {side === 'left' && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={swapPanels} className="h-6 w-6">
                  <ArrowRightLeft className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Swap panels</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleExpand} className="h-6 w-6">
                <Maximize2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Exit split view</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default PageSelector;
