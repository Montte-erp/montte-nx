import {
   Select,
   SelectContent,
   SelectTrigger,
} from "@packages/ui/components/select";
import type { ComponentPropsWithoutRef, NamedExoticComponent } from "react";
export type ModelOption = {
   id: string;
   name: string;
   description?: string;
};
type RootProps = ComponentPropsWithoutRef<typeof Select> & {
   models: ModelOption[];
};
declare function ModelSelectorRoot({
   models,
   children,
   ...props
}: RootProps): import("react/jsx-runtime").JSX.Element;
declare function ModelSelectorTrigger({
   className,
   ...props
}: ComponentPropsWithoutRef<
   typeof SelectTrigger
>): import("react/jsx-runtime").JSX.Element;
declare function ModelSelectorContent({
   className,
   children,
   ...props
}: ComponentPropsWithoutRef<
   typeof SelectContent
>): import("react/jsx-runtime").JSX.Element;
type ItemProps = {
   model: ModelOption;
   className?: string;
};
declare function ModelSelectorItem({
   model,
   className,
}: ItemProps): import("react/jsx-runtime").JSX.Element;
type ModelSelectorImplProps = RootProps & {
   defaultValue?: string;
   triggerClassName?: string;
};
export declare const ModelSelector: NamedExoticComponent<ModelSelectorImplProps> & {
   displayName: "ModelSelector";
   Root: typeof ModelSelectorRoot;
   Trigger: typeof ModelSelectorTrigger;
   Content: typeof ModelSelectorContent;
   Item: typeof ModelSelectorItem;
};
export {};
//# sourceMappingURL=model-selector.d.ts.map
