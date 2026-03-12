import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useSplitView } from '@/contexts/SplitViewContext';
import SplitViewPanel from './SplitViewPanel';

const SplitViewContainer = () => {
  const { leftPage, rightPage, setPanelSizes } = useSplitView();

  const handleLayout = (sizes: number[]) => {
    if (sizes.length === 2) {
      setPanelSizes([sizes[0], sizes[1]]);
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" onLayout={handleLayout} className="h-full">
      <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
        <SplitViewPanel side="left" pageKey={leftPage} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
        <SplitViewPanel side="right" pageKey={rightPage} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default SplitViewContainer;
