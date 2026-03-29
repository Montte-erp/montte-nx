type StrengthLevel = "fraca" | "razoavel" | "boa" | "forte";

function getStrength(password: string): {
   level: StrengthLevel;
   score: number;
} {
   let score = 0;
   if (password.length >= 8) score++;
   if (password.length >= 12) score++;
   if (/[A-Z]/.test(password)) score++;
   if (/[0-9]/.test(password)) score++;
   if (/[^A-Za-z0-9]/.test(password)) score++;

   if (score <= 1) return { level: "fraca", score };
   if (score === 2) return { level: "razoavel", score };
   if (score === 3) return { level: "boa", score };
   return { level: "forte", score };
}

const STRENGTH_CONFIG: Record<
   StrengthLevel,
   { label: string; color: string; bars: number }
> = {
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
      <div className="rounded-md border bg-muted/40 p-3 flex flex-col gap-2">
         <div className="flex gap-1">
            {Array.from({ length: 4 }, (_, i) => (
               <div
                  key={`strength-bar-${i + 1}`}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                     i < config.bars ? config.color : "bg-muted"
                  }`}
               />
            ))}
         </div>
         <p className="text-xs text-muted-foreground">{config.label}</p>
      </div>
   );
}
