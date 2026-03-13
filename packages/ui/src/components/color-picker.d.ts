import Color from "color";
import { Slider } from "radix-ui";
import { type ComponentProps, type HTMLAttributes } from "react";
import { Button } from "./button";
import { SelectTrigger } from "./select";
interface ColorPickerContextValue {
   hue: number;
   saturation: number;
   lightness: number;
   alpha: number;
   mode: string;
   setHue: (hue: number) => void;
   setSaturation: (saturation: number) => void;
   setLightness: (lightness: number) => void;
   setAlpha: (alpha: number) => void;
   setMode: (mode: string) => void;
}
export declare const useColorPicker: () => ColorPickerContextValue;
export type ColorPickerProps = HTMLAttributes<HTMLDivElement> & {
   value?: Parameters<typeof Color>[0];
   defaultValue?: Parameters<typeof Color>[0];
   onChange?: (value: Parameters<typeof Color.rgb>[0]) => void;
};
export declare const ColorPicker: ({
   value,
   defaultValue,
   onChange,
   className,
   ...props
}: ColorPickerProps) => import("react/jsx-runtime").JSX.Element;
export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>;
export declare const ColorPickerSelection: import("react").MemoExoticComponent<
   ({
      className,
      ...props
   }: ColorPickerSelectionProps) => import("react/jsx-runtime").JSX.Element
>;
export type ColorPickerHueProps = ComponentProps<typeof Slider.Root>;
export declare const ColorPickerHue: ({
   className,
   ...props
}: Slider.SliderProps &
   import("react").RefAttributes<HTMLSpanElement>) => import("react/jsx-runtime").JSX.Element;
export type ColorPickerAlphaProps = ComponentProps<typeof Slider.Root>;
export declare const ColorPickerAlpha: ({
   className,
   ...props
}: Slider.SliderProps &
   import("react").RefAttributes<HTMLSpanElement>) => import("react/jsx-runtime").JSX.Element;
export type ColorPickerEyeDropperProps = ComponentProps<typeof Button>;
export declare const ColorPickerEyeDropper: ({
   className,
   ...props
}: import("react").ClassAttributes<HTMLButtonElement> &
   import("react").ButtonHTMLAttributes<HTMLButtonElement> &
   import("class-variance-authority").VariantProps<
      (
         props?:
            | ({
                 variant?:
                    | "default"
                    | "destructive"
                    | "ghost"
                    | "link"
                    | "outline"
                    | "secondary"
                    | null
                    | undefined;
                 size?:
                    | "default"
                    | "icon"
                    | "icon-lg"
                    | "icon-sm"
                    | "icon-xs"
                    | "lg"
                    | "sm"
                    | "xs"
                    | null
                    | undefined;
              } & import("class-variance-authority/types").ClassProp)
            | undefined,
      ) => string
   > & {
      asChild?: boolean | undefined;
      tooltip?: string | undefined;
      tooltipSide?: "bottom" | "left" | "right" | "top" | undefined;
   }) => import("react/jsx-runtime").JSX.Element;
export type ColorPickerOutputProps = ComponentProps<typeof SelectTrigger>;
export declare const ColorPickerOutput: ({
   className,
   ...props
}: import("@radix-ui/react-select").SelectTriggerProps &
   import("react").RefAttributes<HTMLButtonElement> & {
      size?: "default" | "sm" | undefined;
   }) => import("react/jsx-runtime").JSX.Element;
export type ColorPickerFormatProps = HTMLAttributes<HTMLDivElement>;
export declare const ColorPickerFormat: ({
   className,
   ...props
}: ColorPickerFormatProps) => import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=color-picker.d.ts.map
