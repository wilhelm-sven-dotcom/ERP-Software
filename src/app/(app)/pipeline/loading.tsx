import { PageHeaderSkeleton } from "@/components/shared/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton action={false} />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2 rounded-lg border p-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
