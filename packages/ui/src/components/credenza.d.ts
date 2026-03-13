interface BaseProps {
   children: React.ReactNode;
}
interface RootCredenzaProps extends BaseProps {
   open?: boolean;
   onOpenChange?: (open: boolean) => void;
}
interface CredenzaProps extends BaseProps {
   className?: string;
   asChild?: true;
}
declare const Credenza: ({
   children,
   ...props
}: RootCredenzaProps) => import("react/jsx-runtime").JSX.Element;
declare const CredenzaTrigger: ({
   className,
   children,
   ...props
}: CredenzaProps) => import("react/jsx-runtime").JSX.Element;
declare const CredenzaClose: ({
   className,
   children,
   ...props
}: CredenzaProps) => import("react/jsx-runtime").JSX.Element;
declare const CredenzaContent: ({
   className,
   children,
   ...props
}: CredenzaProps) => import("react/jsx-runtime").JSX.Element;
declare const CredenzaDescription: ({
   className,
   children,
   ...props
}: CredenzaProps) => import("react/jsx-runtime").JSX.Element;
declare const CredenzaHeader: ({
   className,
   children,
   ...props
}: CredenzaProps) => import("react/jsx-runtime").JSX.Element;
declare const CredenzaTitle: ({
   className,
   children,
   ...props
}: CredenzaProps) => import("react/jsx-runtime").JSX.Element;
declare const CredenzaBody: ({
   className,
   children,
   ...props
}: CredenzaProps) => import("react/jsx-runtime").JSX.Element;
declare const CredenzaFooter: ({
   className,
   children,
   ...props
}: CredenzaProps) => import("react/jsx-runtime").JSX.Element;
export {
   Credenza,
   CredenzaTrigger,
   CredenzaClose,
   CredenzaContent,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
   CredenzaBody,
   CredenzaFooter,
};
//# sourceMappingURL=credenza.d.ts.map
