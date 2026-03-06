import { Skeleton } from "@packages/ui/components/skeleton";

export function TransactionsSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}
