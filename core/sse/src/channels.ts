import type { SseScope } from "./types";

export function channelFor(scope: SseScope): string {
   return `sse:${scope.kind}:${scope.id}`;
}
