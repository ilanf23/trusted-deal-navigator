import { Skeleton } from "@/components/ui/skeleton";

const PageSkeleton = () => (
  <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading page">
    <Skeleton className="h-8 w-64" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
    <Skeleton className="h-64 w-full" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  </div>
);

export default PageSkeleton;
