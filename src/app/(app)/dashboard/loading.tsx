import {
  CardGridSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/shared/loading-skeletons";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton action={false} />
      <CardGridSkeleton count={4} />
      <div className="mt-4">
        <TableSkeleton rows={5} cols={3} />
      </div>
    </div>
  );
}
