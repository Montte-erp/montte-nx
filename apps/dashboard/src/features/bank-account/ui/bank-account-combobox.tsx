import {
   Autocomplete,
   type AutocompleteOption,
} from "@packages/ui/components/autocomplete";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import type React from "react";
import { Suspense, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

interface BankAccountComboboxProps {
   value?: string;
   onValueChange?: (value: string) => void;
   onBlur?: React.FocusEventHandler<HTMLButtonElement>;
}

function BankAccountComboboxContent({
   value,
   onValueChange,
   onBlur,
}: BankAccountComboboxProps) {
   const trpc = useTRPC();
   const { data: banks = [] } = useSuspenseQuery(
      trpc.brasilApi.banks.getAll.queryOptions(),
   );

   const formattedBanks: AutocompleteOption[] = banks.map((bank) => ({
      label: bank.fullName,
      value: bank.fullName,
   }));

   const selectedOption = useMemo(
      () => formattedBanks.find((bank) => bank.value === value),
      [formattedBanks, value],
   );

   const handleValueChange = (option: AutocompleteOption) => {
      onValueChange?.(option.value);
   };

   const handleBlur = () => {
      if (onBlur) {
         const mockEvent = {} as React.FocusEvent<HTMLButtonElement>;
         onBlur(mockEvent);
      }
   };

   return (
      <Autocomplete
         emptyMessage="Nenhum resultado encontrado"
         onBlur={handleBlur}
         onValueChange={handleValueChange}
         options={formattedBanks}
         placeholder="Selecione seu banco"
         value={selectedOption}
      />
   );
}

function ErrorFallback({ error }: { error: Error }) {
   return (
      <div className="text-sm text-red-600 p-2 border rounded-md">
         {error.message}
      </div>
   );
}

function LoadingFallback() {
   return <Skeleton className="h-10 w-full" />;
}

export function BankAccountCombobox(props: BankAccountComboboxProps) {
   return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
         <Suspense fallback={<LoadingFallback />}>
            <BankAccountComboboxContent {...props} />
         </Suspense>
      </ErrorBoundary>
   );
}
