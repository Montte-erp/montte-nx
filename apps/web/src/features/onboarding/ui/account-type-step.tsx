import { cn } from "@packages/ui/lib/utils";
import { Building2, User } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { StepHandle, StepState } from "./step-handle";

export type AccountType = "personal" | "business";

interface AccountTypeStepProps {
   onNext: (accountType: AccountType) => void;
   onStateChange: (state: StepState) => void;
}

const ACCOUNT_TYPE_OPTIONS: {
   value: AccountType;
   label: string;
   description: string;
   icon: typeof User;
}[] = [
   {
      value: "personal",
      label: "Uso Pessoal",
      description: "Para controlar suas finanças pessoais",
      icon: User,
   },
   {
      value: "business",
      label: "Empresa",
      description: "Para gerenciar um negócio ou empresa",
      icon: Building2,
   },
];

export const AccountTypeStep = forwardRef<StepHandle, AccountTypeStepProps>(
   function AccountTypeStep({ onNext, onStateChange }, ref) {
      const [selected, setSelected] = useState<AccountType | null>(null);

      useImperativeHandle(
         ref,
         () => ({
            submit: async () => {
               if (!selected) return false;
               onNext(selected);
               return true;
            },
            canContinue: selected !== null,
            isPending: false,
         }),
         [onNext, selected],
      );

      useEffect(() => {
         onStateChange({ canContinue: selected !== null, isPending: false });
      }, [onStateChange, selected]);

      return (
         <div className="space-y-6">
            <div className="space-y-2 text-center">
               <h2 className="font-serif text-2xl font-semibold">
                  Como você vai usar o Montte?
               </h2>
               <p className="text-sm text-muted-foreground">
                  Vamos personalizar sua experiência com base no seu perfil.
               </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
               {ACCOUNT_TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selected === option.value;

                  return (
                     <button
                        className={cn(
                           "flex flex-col items-center gap-4 rounded-xl border-2 p-8 text-center transition-all duration-150 hover:border-primary/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                           isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background",
                        )}
                        key={option.value}
                        onClick={() => setSelected(option.value)}
                        type="button"
                     >
                        <div
                           className={cn(
                              "flex size-14 items-center justify-center rounded-full border-2 transition-colors",
                              isSelected
                                 ? "border-primary bg-primary/10 text-primary"
                                 : "border-border bg-muted text-muted-foreground",
                           )}
                        >
                           <Icon className="size-6" />
                        </div>
                        <div className="space-y-1">
                           <p
                              className={cn(
                                 "font-semibold",
                                 isSelected
                                    ? "text-primary"
                                    : "text-foreground",
                              )}
                           >
                              {option.label}
                           </p>
                           <p className="text-sm text-muted-foreground">
                              {option.description}
                           </p>
                        </div>
                     </button>
                  );
               })}
            </div>
         </div>
      );
   },
);
