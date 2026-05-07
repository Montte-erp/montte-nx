import type { Outputs } from "@/integrations/orpc/client";

export type InboxListResult = Outputs["inbox"]["list"];
export type InboxItem = InboxListResult["items"][number];
export type InboxCounts = InboxListResult["counts"];
