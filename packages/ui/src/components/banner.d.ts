import { type LucideIcon } from "lucide-react";
import { type ComponentProps, type HTMLAttributes } from "react";
import { Button } from "./button";
type BannerContextProps = {
   show: boolean;
   setShow: (show: boolean) => void;
};
export declare const BannerContext: import("react").Context<BannerContextProps>;
export type BannerProps = HTMLAttributes<HTMLDivElement> & {
   visible?: boolean;
   defaultVisible?: boolean;
   onClose?: () => void;
   inset?: boolean;
};
export declare const Banner: ({
   children,
   visible,
   defaultVisible,
   onClose,
   className,
   inset,
   ...props
}: BannerProps) => import("react/jsx-runtime").JSX.Element | null;
export type BannerIconProps = HTMLAttributes<HTMLDivElement> & {
   icon: LucideIcon;
};
export declare const BannerIcon: ({
   icon: Icon,
   className,
   ...props
}: BannerIconProps) => import("react/jsx-runtime").JSX.Element;
export type BannerTitleProps = HTMLAttributes<HTMLParagraphElement>;
export declare const BannerTitle: ({
   className,
   ...props
}: BannerTitleProps) => import("react/jsx-runtime").JSX.Element;
export type BannerActionProps = ComponentProps<typeof Button>;
export declare const BannerAction: ({
   variant,
   size,
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
export type BannerCloseProps = ComponentProps<typeof Button>;
export declare const BannerClose: ({
   variant,
   size,
   onClick,
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
export {};
//# sourceMappingURL=banner.d.ts.map
