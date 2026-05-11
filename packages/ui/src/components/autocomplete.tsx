"use client";

import {
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Command as CommandPrimitive } from "cmdk";
import { Check } from "lucide-react";
import {
   type KeyboardEvent,
   type ReactNode,
   useCallback,
   useMemo,
   useRef,
   useState,
} from "react";

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
   renderOption?: (option: AutocompleteOption) => ReactNode;
}

export function Autocomplete({
   options,
   placeholder,
   emptyMessage,
   value,
   onValueChange,
   disabled,
   isLoading = false,
   onBlur,
   renderOption,
}: AutocompleteProps) {
   const inputRef = useRef<HTMLInputElement>(null);
   const [parentNode, setParentNode] = useState<HTMLDivElement | null>(null);

   const [isOpen, setOpen] = useState(false);
   const [internalSelected, setInternalSelected] = useState<
      AutocompleteOption | undefined
   >(value);
   const [searchValue, setSearchValue] = useState<string>(value?.label || "");
   const pendingSelectionRef = useRef<AutocompleteOption | undefined>(
      undefined,
   );

   const isControlled = onValueChange !== undefined;
   const selected = isControlled ? value : internalSelected;
   const inputValue = isOpen ? searchValue : selected?.label || "";

   const filteredOptions = useMemo(() => {
      const searchTerm = searchValue.trim().toLowerCase();
      if (!searchTerm) return options;
      return options.filter((option) =>
         option.label.toLowerCase().includes(searchTerm),
      );
   }, [options, searchValue]);

   const virtualizer = useVirtualizer({
      count: filteredOptions.length,
      estimateSize: () => 50,
      getScrollElement: () => parentNode,
      overscan: 5,
   });

   const virtualItems = virtualizer.getVirtualItems();

   const refCallback = useCallback((node: HTMLDivElement | null) => {
      if (node) {
         setParentNode(node);
      }
   }, []);

   const handleInputValueChange = useCallback(
      (newValue: string) => {
         setSearchValue(newValue);
         if (parentNode) {
            parentNode.scrollTop = 0;
         }
      },
      [parentNode],
   );

   const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
         const input = inputRef.current;
         if (!input) {
            return;
         }

         if (!isOpen) {
            setOpen(true);
         }

         if (event.key === "Enter" && input.value !== "") {
            const optionToSelect = filteredOptions.find(
               (option) => option.label === input.value,
            );
            if (optionToSelect) {
               if (!isControlled) {
                  setInternalSelected(optionToSelect);
               }
               onValueChange?.(optionToSelect);
            }
         }

         if (event.key === "Escape") {
            input.blur();
         }
      },
      [isOpen, filteredOptions, onValueChange, isControlled],
   );

   const handleBlur = useCallback(() => {
      setOpen(false);
      const finalSelected = pendingSelectionRef.current || selected;
      setSearchValue(finalSelected?.label || "");
      const hadPendingSelection = !!pendingSelectionRef.current;
      pendingSelectionRef.current = undefined;

      if (hadPendingSelection) {
         setTimeout(() => {
            onBlur?.();
         }, 0);
      } else {
         onBlur?.();
      }
   }, [selected, onBlur]);

   const handleSelectOption = useCallback(
      (selectedOption: AutocompleteOption) => {
         setSearchValue(selectedOption.label);
         pendingSelectionRef.current = selectedOption;

         if (!isControlled) {
            setInternalSelected(selectedOption);
         }
         onValueChange?.(selectedOption);

         setTimeout(() => {
            inputRef?.current?.blur();
         }, 0);
      },
      [onValueChange, isControlled],
   );

   const handleFocus = useCallback(() => {
      setOpen(true);
      setSearchValue(selected?.label || "");
   }, [selected]);

   return (
      <CommandPrimitive className="relative w-full" onKeyDown={handleKeyDown}>
         <div className="dark:bg-input/30 rounded-md border border-input [&_[data-slot=command-input-wrapper]]:border-b-0">
            <CommandInput
               className="text-base border-0"
               disabled={disabled}
               onBlur={handleBlur}
               onFocus={handleFocus}
               onValueChange={isLoading ? undefined : handleInputValueChange}
               placeholder={placeholder}
               ref={inputRef}
               value={inputValue}
            />
         </div>
         {isOpen ? (
            <div className="relative">
               <div
                  className={cn(
                     "animate-in fade-in-0 zoom-in-95 absolute top-1 z-10 w-full rounded-xl bg-popover outline-none border border-border shadow-md",
                  )}
               >
                  <CommandList className="rounded-lg" ref={refCallback}>
                     {isLoading ? (
                        <CommandPrimitive.Loading>
                           <div className="p-1">
                              <Skeleton className="h-8 w-full" />
                           </div>
                        </CommandPrimitive.Loading>
                     ) : null}
                     {filteredOptions.length > 0 && !isLoading ? (
                        <CommandGroup>
                           <div
                              style={{
                                 height: virtualizer.getTotalSize(),
                                 position: "relative",
                                 width: "100%",
                              }}
                           >
                              {virtualItems.length > 0 ? (
                                 <div
                                    style={{
                                       left: 0,
                                       position: "absolute",
                                       top: 0,
                                       transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
                                       width: "100%",
                                    }}
                                 >
                                    {virtualItems.map((virtualRow) => {
                                       const option =
                                          filteredOptions[virtualRow.index];

                                       if (!option) return null;

                                       const isSelected =
                                          selected?.value === option.value;

                                       return (
                                          <CommandItem
                                             className={cn(
                                                "flex w-full items-start gap-2 py-1",
                                                !isSelected ? "pl-8" : null,
                                             )}
                                             key={option.value}
                                             onMouseDown={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                             }}
                                             onSelect={() =>
                                                handleSelectOption(option)
                                             }
                                             ref={virtualizer.measureElement}
                                             value={option.label}
                                          >
                                             {isSelected ? (
                                                <Check className="w-4 shrink-0 mt-0.5" />
                                             ) : null}
                                             {renderOption ? (
                                                renderOption(option)
                                             ) : (
                                                <span className="break-words">
                                                   {option.label}
                                                </span>
                                             )}
                                          </CommandItem>
                                       );
                                    })}
                                 </div>
                              ) : null}
                           </div>
                        </CommandGroup>
                     ) : null}
                     {!isLoading && filteredOptions.length === 0 ? (
                        <CommandPrimitive.Empty className="select-none rounded-sm px-2 py-3 text-center text-sm">
                           {emptyMessage}
                        </CommandPrimitive.Empty>
                     ) : null}
                  </CommandList>
               </div>
            </div>
         ) : null}
      </CommandPrimitive>
   );
}
