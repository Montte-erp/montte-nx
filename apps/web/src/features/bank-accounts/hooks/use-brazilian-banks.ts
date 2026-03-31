import type { ComboboxOption } from "@packages/ui/components/combobox";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface BrasilApiBank {
   ispb: string;
   name: string;
   code: number | null;
   fullName: string;
}

async function fetchBrazilianBanks(): Promise<BrasilApiBank[]> {
   const response = await fetch("https://brasilapi.com.br/api/banks/v1");
   if (!response.ok) throw new Error("Failed to fetch banks");
   return response.json();
}

export function useBrazilianBanks() {
   const { data: banks } = useSuspenseQuery({
      queryKey: ["brazilian-banks"],
      queryFn: fetchBrazilianBanks,
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: Number.POSITIVE_INFINITY,
   });

   const bankOptions: ComboboxOption[] = useMemo(
      () =>
         banks
            .filter((b) => b.code !== null)
            .sort((a, b) => (a.code ?? 0) - (b.code ?? 0))
            .map((b) => ({
               value: String(b.code),
               label: `${b.code} - ${b.name}`,
            })),
      [banks],
   );

   return { bankOptions };
}
