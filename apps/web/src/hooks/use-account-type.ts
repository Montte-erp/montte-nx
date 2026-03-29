export function useAccountType() {
   return {
      accountType: "business" as const,
      isBusiness: true,
      isPersonal: false,
   } as const;
}
