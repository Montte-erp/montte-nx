import { Skeleton } from "@packages/ui/components/skeleton";

export function MembersSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div>
               <Skeleton className="h-8 w-32" />
               <Skeleton className="h-4 w-64 mt-1" />
            </div>
            <Skeleton className="h-8 w-24" />
         </div>

         <Skeleton className="h-9 w-full" />

         <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
         </div>
      </div>
   );
}
