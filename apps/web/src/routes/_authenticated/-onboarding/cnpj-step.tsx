import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { Spinner } from "@packages/ui/components/spinner";
import type { MaskitoOptions } from "@maskito/core";
import { useMaskito } from "@maskito/react";
import dayjs from "dayjs";
import { Building2, CheckCircle2, MapPin } from "lucide-react";
import {
   forwardRef,
   useCallback,
   useEffect,
   useImperativeHandle,
   useState,
} from "react";
import { useMemo } from "react";

import { Debouncer } from "@tanstack/pacer";
import { orpc, type Inputs } from "@/integrations/orpc/client";
import type { StepHandle, StepState } from "./step-handle";

type CnpjData = NonNullable<
   Inputs["onboarding"]["createWorkspace"]["cnpjData"]
>;

const PORTE_MAP: Record<string, string> = {
   ME: "Microempresa",
   EPP: "Pequeno Porte",
   MEI: "MEI",
   DEMAIS: "Grande Porte",
};

const cnpjMaskOptions: MaskitoOptions = {
   mask: [
      /\d/,
      /\d/,
      ".",
      /\d/,
      /\d/,
      /\d/,
      ".",
      /\d/,
      /\d/,
      /\d/,
      "/",
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      "-",
      /\d/,
      /\d/,
   ],
};

interface CnpjStepProps {
   onNext: (data: CnpjData) => Promise<void>;
   onStateChange: (state: StepState) => void;
}

export const CnpjStep = forwardRef<StepHandle, CnpjStepProps>(function CnpjStep(
   { onNext, onStateChange },
   ref,
) {
   const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [isFetching, setIsFetching] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const cnpjInputRef = useMaskito({ options: cnpjMaskOptions });

   const canContinue = cnpjData !== null;
   const isPending = isFetching || isSubmitting;

   useImperativeHandle(
      ref,
      () => ({
         submit: async () => {
            if (!cnpjData || isSubmitting) return false;
            setIsSubmitting(true);
            try {
               await onNext(cnpjData);
               return true;
            } finally {
               setIsSubmitting(false);
            }
         },
         canContinue,
         isPending,
      }),
      [cnpjData, canContinue, isPending, isSubmitting, onNext],
   );

   useEffect(() => {
      onStateChange({ canContinue, isPending });
   }, [canContinue, isPending, onStateChange]);

   const fetchData = useCallback(async (digits: string) => {
      if (digits.length !== 14) return;

      setIsFetching(true);
      setCnpjData(null);
      setError(null);

      try {
         const data = await orpc.onboarding.fetchCnpjData.call({
            cnpj: digits,
         });
         setCnpjData(data);
      } catch (err) {
         const msg =
            err instanceof Error
               ? err.message
               : "CNPJ não encontrado ou inválido.";
         setError(msg);
      } finally {
         setIsFetching(false);
      }
   }, []);

   const debouncer = useMemo(
      () => new Debouncer(fetchData, { wait: 400 }),
      [fetchData],
   );

   const handleInput = useCallback(
      (value: string) => {
         const digits = value.replace(/\D/g, "");
         setCnpjData(null);
         setError(null);
         debouncer.maybeExecute(digits);
      },
      [debouncer],
   );

   const displayName =
      cnpjData?.nome_fantasia || cnpjData?.razao_social || null;
   const foundingYear = cnpjData?.data_inicio_atividade
      ? dayjs(cnpjData.data_inicio_atividade).format("YYYY")
      : null;
   const porte = cnpjData?.porte
      ? (PORTE_MAP[cnpjData.porte] ?? cnpjData.porte)
      : null;

   return (
      <div className="flex flex-col gap-6">
         <div className="flex flex-col gap-2 text-center">
            <h2 className="font-serif text-2xl font-semibold">
               CNPJ da empresa
            </h2>
            <p className="text-sm text-muted-foreground">
               Vamos buscar os dados da sua empresa automaticamente.
            </p>
         </div>

         <FieldGroup>
            <Field data-invalid={!!error}>
               <FieldLabel>CNPJ</FieldLabel>
               <div className="relative">
                  <Input
                     ref={cnpjInputRef}
                     autoFocus
                     disabled={isFetching}
                     inputMode="numeric"
                     onInput={(e) =>
                        handleInput((e.target as HTMLInputElement).value)
                     }
                     placeholder="00.000.000/0000-00"
                  />
                  {isFetching && (
                     <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2" />
                  )}
               </div>
               {error && <FieldError errors={[{ message: error }]} />}
            </Field>
         </FieldGroup>

         {cnpjData && displayName && (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-5">
               <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                     <Building2 className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-2">
                        <p className="font-semibold leading-tight">
                           {displayName}
                        </p>
                        <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                     </div>
                     {cnpjData.nome_fantasia && (
                        <p className="text-xs text-muted-foreground">
                           {cnpjData.razao_social}
                        </p>
                     )}
                     {cnpjData.cnae_fiscal_descricao && (
                        <p className="text-sm text-muted-foreground">
                           {cnpjData.cnae_fiscal_descricao}
                        </p>
                     )}
                  </div>
               </div>

               <div className="flex flex-wrap gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground ring-1 ring-border">
                     <MapPin className="size-3" />
                     {cnpjData.municipio}, {cnpjData.uf}
                  </span>
                  {porte && (
                     <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground ring-1 ring-border">
                        {porte}
                     </span>
                  )}
                  {foundingYear && (
                     <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground ring-1 ring-border">
                        Desde {foundingYear}
                     </span>
                  )}
                  {cnpjData.natureza_juridica && (
                     <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground ring-1 ring-border">
                        {cnpjData.natureza_juridica}
                     </span>
                  )}
               </div>
            </div>
         )}
      </div>
   );
});
