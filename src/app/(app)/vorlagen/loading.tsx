import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/shared/loading-skeletons";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton action={false} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TableSkeleton rows={4} cols={3} />
        <TableSkeleton rows={4} cols={2} />
      </div>
    </div>
  );
}
