import { Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import { pageRegistry } from './pageRegistry';
import PageSelector from './PageSelector';
import { AlertTriangle } from 'lucide-react';
import { AdminLayoutMountedContext } from '@/components/admin/AdminLayout';

interface SplitViewPanelProps {
  side: 'left' | 'right';
  pageKey: string;
}

// Error boundary to prevent one broken panel from crashing the whole app
class PanelErrorBoundary extends Component<
  { children: ReactNode; pageKey: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; pageKey: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SplitView] Panel "${this.props.pageKey}" error:`, error, info);
  }

  componentDidUpdate(prevProps: { pageKey: string }) {
    // Reset error when user switches pages
    if (prevProps.pageKey !== this.props.pageKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-medium">This page couldn't load in split view</p>
          <p className="text-xs text-center max-w-[250px]">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const PanelSkeleton = () => (
  <div className="flex-1 p-4 space-y-3 animate-pulse">
    <div className="h-6 w-48 bg-muted rounded" />
    <div className="h-4 w-full bg-muted rounded" />
    <div className="h-4 w-3/4 bg-muted rounded" />
    <div className="h-32 w-full bg-muted rounded mt-4" />
  </div>
);

const SplitViewPanel = ({ side, pageKey }: SplitViewPanelProps) => {
  const entry = pageRegistry.get(pageKey);

  if (!entry) {
    return (
      <div className="flex flex-col h-full">
        <PageSelector side={side} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Page not found
        </div>
      </div>
    );
  }

  const PageComponent = entry.component;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ contain: 'strict' }}>
      <PageSelector side={side} />
      <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4 relative" style={{ contain: 'paint' }}>
        <AdminLayoutMountedContext.Provider value={true}>
          <PanelErrorBoundary pageKey={pageKey}>
            <Suspense fallback={<PanelSkeleton />}>
              <PageComponent key={pageKey} />
            </Suspense>
          </PanelErrorBoundary>
        </AdminLayoutMountedContext.Provider>
      </div>
    </div>
  );
};

export default SplitViewPanel;
