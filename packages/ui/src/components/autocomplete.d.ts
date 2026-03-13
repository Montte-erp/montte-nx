export type AutocompleteOption = Record<"value" | "label", string> &
   Record<string, string>;
interface AutocompleteProps {
   options: AutocompleteOption[];
   emptyMessage: string;
   value?: AutocompleteOption;
   onValueChange?: (value: AutocompleteOption) => void;
   isLoading?: boolean;
   disabled?: boolean;
   placeholder?: string;
   onBlur?: () => void;
}
export declare function Autocomplete({
   options,
   placeholder,
   emptyMessage,
   value,
   onValueChange,
   disabled,
   isLoading,
   onBlur,
}: AutocompleteProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=autocomplete.d.ts.map
