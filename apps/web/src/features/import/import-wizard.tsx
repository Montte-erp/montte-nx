import { Credenza, CredenzaContent } from "@packages/ui/components/credenza";
import { Store, useStore } from "@tanstack/react-store";
import { fromThrowable } from "neverthrow";
import {
   useCallback,
   useEffect,
   useMemo,
   useState,
   useTransition,
} from "react";
import { z } from "zod";
import { guessMapping, mappingStorageKey } from "./lib/column-mapper";
import { applyMapping } from "./lib/map-rows";
import { UploadStep } from "./steps/upload-step";
import { MapStep } from "./steps/map-step";
import { PreviewStep } from "./steps/preview-step";
import { ConfirmStep } from "./steps/confirm-step";
import { IMPORT_STEPS } from "./types";
import type { ImportConfig, ImportStep, RawData } from "./types";

function StepBar({ step }: { step: ImportStep }) {
   const currentIdx = IMPORT_STEPS.indexOf(step);
   return (
      <div className="flex items-center gap-2">
         {IMPORT_STEPS.map((_, i) => (
            <div
               className={[
                  "h-1 rounded-full flex-1 transition-all",
                  i === currentIdx
                     ? "bg-primary"
                     : i < currentIdx
                       ? "bg-primary/40"
                       : "bg-muted",
               ].join(" ")}
               key={`step-${i + 1}`}
            />
         ))}
      </div>
   );
}

type WizardState<T> = {
   rawData: RawData | null;
   mapping: Record<string, string>;
   savedMappingApplied: boolean;
   mappedRows: T[];
   dedupScores: number[] | null;
};

export function ImportWizard<T>({
   config,
   step,
   onStepChange,
   onClose,
}: {
   config: ImportConfig<T>;
   step: ImportStep;
   onStepChange: (s: ImportStep) => void;
   onClose: () => void;
}) {
   const [store] = useState(
      () =>
         new Store<WizardState<T>>({
            rawData: null,
            mapping: {},
            savedMappingApplied: false,
            mappedRows: [],
            dedupScores: null,
         }),
   );

   const rawData = useStore(store, (s) => s.rawData);
   const mapping = useStore(store, (s) => s.mapping);
   const savedMappingApplied = useStore(store, (s) => s.savedMappingApplied);
   const mappedRows = useStore(store, (s) => s.mappedRows);
   const dedupScores = useStore(store, (s) => s.dedupScores);

   const [isPendingMap, startMapTransition] = useTransition();

   // F5 guard: if not on upload but no raw data, reset to upload
   useEffect(() => {
      if (step !== "upload" && store.state.rawData === null) {
         onStepChange("upload");
      }
   }, [step, store, onStepChange]);

   const handleParsed = useCallback(
      (raw: RawData) => {
         const saved = localStorage.getItem(
            mappingStorageKey(config.featureKey, raw.headers),
         );
         if (saved) {
            const safeParse = fromThrowable(JSON.parse);
            const parseResult = safeParse(saved);
            const validated = parseResult.isOk()
               ? z.record(z.string(), z.string()).safeParse(parseResult.value)
               : null;
            if (validated?.success) {
               store.setState((s) => ({
                  ...s,
                  rawData: raw,
                  mapping: validated.data,
                  savedMappingApplied: true,
               }));
               onStepChange("map");
               return;
            }
         }
         store.setState((s) => ({
            ...s,
            rawData: raw,
            mapping: guessMapping(raw.headers, config.columns),
            savedMappingApplied: false,
         }));
         onStepChange("map");
      },
      [config, store, onStepChange],
   );

   const handleMapProceed = useCallback(
      (finalMapping: Record<string, string>) => {
         if (!store.state.rawData) return;
         startMapTransition(async () => {
            const fieldRecords = applyMapping(
               store.state.rawData!,
               finalMapping,
            );
            const rows = config.mapRows(fieldRecords);
            const scores = config.dedup
               ? await config.dedup.checkDuplicates(rows)
               : null;
            store.setState((s) => ({
               ...s,
               mapping: finalMapping,
               mappedRows: rows,
               dedupScores: scores,
            }));
            onStepChange("preview");
         });
      },
      [config, store, onStepChange],
   );

   const stepBar = useMemo(() => <StepBar step={step} />, [step]);

   return (
      <Credenza open onOpenChange={(open) => !open && onClose()}>
         <CredenzaContent>
            {step === "upload" && (
               <UploadStep
                  config={config}
                  stepBar={stepBar}
                  onParsed={handleParsed}
               />
            )}
            {step === "map" && rawData && (
               <MapStep
                  config={config}
                  rawData={rawData}
                  mapping={mapping}
                  savedMappingApplied={savedMappingApplied}
                  stepBar={stepBar}
                  onMappingChange={(m) =>
                     store.setState((s) => ({ ...s, mapping: m }))
                  }
                  onProceed={handleMapProceed}
                  onBack={() => onStepChange("upload")}
                  onResetMapping={() => {
                     if (!rawData) return;
                     localStorage.removeItem(
                        mappingStorageKey(config.featureKey, rawData.headers),
                     );
                     store.setState((s) => ({
                        ...s,
                        savedMappingApplied: false,
                        mapping: guessMapping(rawData.headers, config.columns),
                     }));
                  }}
                  isPending={isPendingMap}
               />
            )}
            {step === "preview" && (
               <PreviewStep
                  config={config}
                  rows={mappedRows}
                  dedupScores={dedupScores}
                  stepBar={stepBar}
                  onProceed={() => onStepChange("confirm")}
                  onBack={() => onStepChange("map")}
               />
            )}
            {step === "confirm" && (
               <ConfirmStep
                  config={config}
                  rows={mappedRows}
                  stepBar={stepBar}
                  onBack={() => onStepChange("preview")}
               />
            )}
         </CredenzaContent>
      </Credenza>
   );
}
