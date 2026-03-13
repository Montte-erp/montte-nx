import {
   FieldContent,
   FieldDescription,
   FieldTitle,
} from "@packages/ui/components/field";
import {
   RadioGroup,
   RadioGroupItem,
} from "@packages/ui/components/radio-group";
import { type ComponentProps, type HTMLAttributes } from "react";
export type ChoiceboxProps = ComponentProps<typeof RadioGroup>;
export declare const Choicebox: ({
   className,
   ...props
}: import("@radix-ui/react-radio-group").RadioGroupProps &
   import("react").RefAttributes<HTMLDivElement>) => import("react/jsx-runtime").JSX.Element;
export type ChoiceboxItemProps = ComponentProps<typeof RadioGroupItem>;
export declare const ChoiceboxItem: ({
   className,
   children,
   value,
   id,
}: import("@radix-ui/react-radio-group").RadioGroupItemProps &
   import("react").RefAttributes<HTMLButtonElement>) => import("react/jsx-runtime").JSX.Element;
export type ChoiceboxItemHeaderProps = ComponentProps<typeof FieldContent>;
export declare const ChoiceboxItemHeader: ({
   className,
   ...props
}: import("react").ClassAttributes<HTMLDivElement> &
   HTMLAttributes<HTMLDivElement>) => import("react/jsx-runtime").JSX.Element;
export type ChoiceboxItemTitleProps = ComponentProps<typeof FieldTitle>;
export declare const ChoiceboxItemTitle: ({
   className,
   ...props
}: import("react").ClassAttributes<HTMLDivElement> &
   HTMLAttributes<HTMLDivElement>) => import("react/jsx-runtime").JSX.Element;
export type ChoiceboxItemSubtitleProps = HTMLAttributes<HTMLSpanElement>;
export declare const ChoiceboxItemSubtitle: ({
   className,
   ...props
}: ChoiceboxItemSubtitleProps) => import("react/jsx-runtime").JSX.Element;
export type ChoiceboxItemDescriptionProps = ComponentProps<
   typeof FieldDescription
>;
export declare const ChoiceboxItemDescription: ({
   className,
   ...props
}: import("react").ClassAttributes<HTMLParagraphElement> &
   HTMLAttributes<HTMLParagraphElement>) => import("react/jsx-runtime").JSX.Element;
export type ChoiceboxIndicatorProps = Partial<
   ComponentProps<typeof RadioGroupItem>
>;
export declare const ChoiceboxIndicator: (
   props: Partial<
      import("@radix-ui/react-radio-group").RadioGroupItemProps &
         import("react").RefAttributes<HTMLButtonElement>
   >,
) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=choicebox.d.ts.map
