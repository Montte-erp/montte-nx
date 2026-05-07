import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import type { InboxCounts } from "./inbox-types";

export type InboxSeverityFilter = "all" | "urgent" | "warning" | "info";

interface Props {
   value: InboxSeverityFilter;
   counts: InboxCounts;
   onChange: (value: InboxSeverityFilter) => void;
}

export function InboxFilters({ value, counts, onChange }: Props) {
   return (
      <Tabs
         value={value}
         onValueChange={(v) => onChange(v as InboxSeverityFilter)}
      >
         <TabsList>
            <TabsTrigger value="all">Tudo ({counts.total})</TabsTrigger>
            <TabsTrigger value="urgent">Urgentes ({counts.urgent})</TabsTrigger>
            <TabsTrigger value="warning">Avisos ({counts.warning})</TabsTrigger>
            <TabsTrigger value="info">Info ({counts.info})</TabsTrigger>
         </TabsList>
      </Tabs>
   );
}
