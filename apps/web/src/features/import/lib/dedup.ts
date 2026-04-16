export function getDedupStatus(score: number) {
   if (score >= 0.9) return "duplicate" as const;
   if (score >= 0.5) return "possible" as const;
   return "new" as const;
}
