import { Input } from "@packages/ui/components/input";
import { cn } from "@packages/ui/lib/utils";
import { useCallback, useState } from "react";

const PRESET_COLORS = [
   "#ef4444", "#f97316", "#f59e0b", "#eab308",
   "#84cc16", "#22c55e", "#10b981", "#14b8a6",
   "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
   "#a855f7", "#ec4899", "#f43f5e", "#64748b",
];

interface SwatchColorPickerProps {
   value: string;
   onChange: (color: string) => void;
}

export function SwatchColorPicker({ value, onChange }: SwatchColorPickerProps) {
   const [hexInput, setHexInput] = useState(value);

   const handleSwatchClick = useCallback(
      (color: string) => {
         setHexInput(color);
         onChange(color);
      },
      [onChange],
   );

   const handleHexChange = useCallback(
      (raw: string) => {
         setHexInput(raw);
         if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
            onChange(raw);
         }
      },
      [onChange],
   );

   return (
      <div className="space-y-3">
         <div className="grid grid-cols-8 gap-1.5">
            {PRESET_COLORS.map((color) => (
               <button
                  className={cn(
                     "size-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                     value === color
                        ? "border-foreground scale-110"
                        : "border-transparent",
                  )}
                  key={color}
                  onClick={() => handleSwatchClick(color)}
                  style={{ backgroundColor: color }}
                  title={color}
                  type="button"
               />
            ))}
         </div>
         <div className="flex items-center gap-2">
            <span
               className="size-7 rounded-full border shrink-0"
               style={{ backgroundColor: value }}
            />
            <Input
               className="font-mono"
               maxLength={7}
               onChange={(e) => handleHexChange(e.target.value)}
               placeholder="#6366f1"
               value={hexInput}
            />
         </div>
      </div>
   );
}
