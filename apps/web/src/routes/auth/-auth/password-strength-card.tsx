import { Check, X } from "lucide-react";

type Criterion = {
   label: string;
   test: (password: string) => boolean;
};

const CRITERIA: Criterion[] = [
   { label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
   { label: "Letra maiúscula", test: (p) => /[A-Z]/.test(p) },
   { label: "Número", test: (p) => /[0-9]/.test(p) },
   { label: "Caractere especial", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

type StrengthLevel = "fraca" | "razoavel" | "boa" | "forte";

function getStrength(password: string): { level: StrengthLevel; score: number } {
   const score = CRITERIA.filter((c) => c.test(password)).length;
   if (score <= 1) return { level: "fraca", score };
   if (score === 2) return { level: "razoavel", score };
   if (score === 3) return { level: "boa", score };
   return { level: "forte", score };
}

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; bars: number }> = {
   fraca: { label: "Senha fraca", color: "bg-destructive", bars: 1 },
   razoavel: { label: "Senha razoável", color: "bg-orange-500", bars: 2 },
   boa: { label: "Senha boa", color: "bg-yellow-500", bars: 3 },
   forte: { label: "Senha forte", color: "bg-green-500", bars: 4 },
};

export function PasswordStrengthCard({ password }: { password: string }) {
   if (!password) return null;

   const { level } = getStrength(password);
   const config = STRENGTH_CONFIG[level];

   return (
      <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
         <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
               <div
                  key={`strength-bar-${i + 1}`}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                     i < config.bars ? config.color : "bg-muted"
                  }`}
               />
            ))}
         </div>
         <p className="text-xs text-muted-foreground">{config.label}</p>
         <div className="flex flex-col gap-2">
            {CRITERIA.map((criterion) => {
               const passes = criterion.test(password);
               return (
                  <div key={criterion.label} className="flex items-center gap-2">
                     {passes ? (
                        <Check className="size-3 text-green-500 shrink-0" />
                     ) : (
                        <X className="size-3 text-muted-foreground shrink-0" />
                     )}
                     <span className={`text-xs ${passes ? "text-foreground" : "text-muted-foreground"}`}>
                        {criterion.label}
                     </span>
                  </div>
               );
            })}
         </div>
      </div>
   );
}
