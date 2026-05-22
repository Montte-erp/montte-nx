import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import { InboxSuggestedSignals } from "./inbox-suggested-signals";
import { InboxCard } from "./inbox-card";
import { InboxEmpty } from "./inbox-empty";
import type { InboxSeverityFilter } from "./inbox-filters";

interface Props {
   severity: InboxSeverityFilter;
}

export function InboxList({ severity }: Props) {
   const { data } = useSuspenseQuery(orpc.inbox.list.queryOptions());
   const items = data.items.filter((i) =>
      severity === "all" ? true : i.severity === severity,
   );

   if (items.length === 0)
      return (
         <div className="flex flex-col gap-2">
            <InboxSuggestedSignals
               fallback={<InboxEmpty />}
               severity={severity}
            />
         </div>
      );

   return (
      <div className="flex flex-col gap-2">
         <InboxSuggestedSignals severity={severity} />
         {items.map((item) => (
            <InboxCard key={item.id} item={item} />
         ))}
      </div>
   );
}
