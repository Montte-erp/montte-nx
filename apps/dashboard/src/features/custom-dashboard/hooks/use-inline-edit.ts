import { useCallback, useEffect, useRef, useState } from "react";

type UseInlineEditOptions = {
   initialValue: string;
   onSave: (value: string) => void;
};

type UseInlineEditReturn = {
   isEditing: boolean;
   value: string;
   inputRef: React.RefObject<HTMLInputElement | null>;
   startEditing: () => void;
   handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
   handleKeyDown: (e: React.KeyboardEvent) => void;
   handleBlur: () => void;
};

export function useInlineEdit({
   initialValue,
   onSave,
}: UseInlineEditOptions): UseInlineEditReturn {
   const [isEditing, setIsEditing] = useState(false);
   const [value, setValue] = useState(initialValue);
   const inputRef = useRef<HTMLInputElement>(null);

   // Sync with external value changes
   useEffect(() => {
      setValue(initialValue);
   }, [initialValue]);

   // Focus and select input when editing starts
   useEffect(() => {
      if (isEditing && inputRef.current) {
         inputRef.current.focus();
         inputRef.current.select();
      }
   }, [isEditing]);

   const startEditing = useCallback(() => {
      setIsEditing(true);
   }, []);

   const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
         setValue(e.target.value);
      },
      [],
   );

   const saveAndExit = useCallback(() => {
      const trimmed = value.trim();
      if (trimmed && trimmed !== initialValue) {
         onSave(trimmed);
      }
      setIsEditing(false);
   }, [value, initialValue, onSave]);

   const cancelAndExit = useCallback(() => {
      setValue(initialValue);
      setIsEditing(false);
   }, [initialValue]);

   const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
         if (e.key === "Enter") {
            saveAndExit();
         } else if (e.key === "Escape") {
            cancelAndExit();
         }
      },
      [saveAndExit, cancelAndExit],
   );

   const handleBlur = useCallback(() => {
      saveAndExit();
   }, [saveAndExit]);

   return {
      isEditing,
      value,
      inputRef,
      startEditing,
      handleChange,
      handleKeyDown,
      handleBlur,
   };
}
