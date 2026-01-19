import { Input } from "@packages/ui/components/input";
import { cn } from "@packages/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { Pencil } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

interface DefaultHeaderProps {
   title: string;
   description?: string;
   actions?: ReactNode;
   children?: ReactNode;
   onTitleChange?: (newTitle: string) => void;
   onDescriptionChange?: (newDescription: string) => void;
   descriptionPlaceholder?: string;
}

export function DefaultHeader({
   title,
   description,
   actions,
   children,
   onTitleChange,
   onDescriptionChange,
   descriptionPlaceholder = "Add a description...",
}: DefaultHeaderProps) {
   const [isSticky, setIsSticky] = useState(false);
   const [editingField, setEditingField] = useState<
      "title" | "description" | null
   >(null);
   const sentinelRef = useRef<HTMLDivElement>(null);
   const titleInputRef = useRef<HTMLInputElement>(null);
   const descriptionInputRef = useRef<HTMLInputElement>(null);

   const form = useForm({
      defaultValues: {
         title: title,
         description: description || "",
      },
   });

   // Sync props to form when they change externally
   useEffect(() => {
      form.reset({ title, description: description || "" });
   }, [title, description, form.reset]);

   // Sticky header observer
   useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;

      const observer = new IntersectionObserver(
         (entries) => {
            const entry = entries[0];
            if (entry) {
               setIsSticky(!entry.isIntersecting);
            }
         },
         { threshold: 0 },
      );

      observer.observe(sentinel);
      return () => observer.disconnect();
   }, []);

   // Focus management when entering edit mode
   useEffect(() => {
      if (editingField === "title" && titleInputRef.current) {
         titleInputRef.current.focus();
         titleInputRef.current.select();
      } else if (
         editingField === "description" &&
         descriptionInputRef.current
      ) {
         descriptionInputRef.current.focus();
         descriptionInputRef.current.select();
      }
   }, [editingField]);

   const handleSave = (fieldName: "title" | "description", value: string) => {
      const trimmed = value.trim();
      if (
         fieldName === "title" &&
         trimmed &&
         trimmed !== title &&
         onTitleChange
      ) {
         onTitleChange(trimmed);
      }
      if (
         fieldName === "description" &&
         trimmed !== (description || "") &&
         onDescriptionChange
      ) {
         onDescriptionChange(trimmed);
      }
      setEditingField(null);
   };

   const handleCancel = (fieldName: "title" | "description") => {
      if (fieldName === "title") {
         form.setFieldValue("title", title);
      } else {
         form.setFieldValue("description", description || "");
      }
      setEditingField(null);
   };

   const handleKeyDown = (
      e: React.KeyboardEvent,
      fieldName: "title" | "description",
      value: string,
   ) => {
      if (e.key === "Enter") {
         handleSave(fieldName, value);
      } else if (e.key === "Escape") {
         handleCancel(fieldName);
      }
   };

   return (
      <>
         <div className="h-0 w-full" ref={sentinelRef} />
         <div
            className={cn(
               "sticky top-0 z-10 bg-background pt-4 pb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between transition-[border-color] duration-200",
               isSticky
                  ? "border-b border-border"
                  : "border-b border-transparent",
            )}
         >
            <div className="flex flex-col gap-2 min-w-0 flex-1 max-w-2xl">
               <form.Field name="title">
                  {(field) =>
                     editingField === "title" && onTitleChange ? (
                        <Input
                           className="text-3xl md:text-4xl font-bold tracking-tight font-serif h-auto py-1 px-2 -ml-2"
                           onBlur={() => handleSave("title", field.state.value)}
                           onChange={(e) => field.handleChange(e.target.value)}
                           onKeyDown={(e) =>
                              handleKeyDown(e, "title", field.state.value)
                           }
                           ref={titleInputRef}
                           value={field.state.value}
                        />
                     ) : (
                        <h1
                           className={cn(
                              "text-3xl md:text-4xl font-bold tracking-tight font-serif leading-tight truncate",
                              onTitleChange &&
                                 "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2 inline-flex items-center gap-2",
                           )}
                           onClick={
                              onTitleChange
                                 ? () => setEditingField("title")
                                 : undefined
                           }
                        >
                           {field.state.value}
                           {onTitleChange && (
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                           )}
                        </h1>
                     )
                  }
               </form.Field>
               {(description !== undefined || onDescriptionChange) && (
                  <div className="text-base md:text-lg text-muted-foreground font-sans leading-relaxed">
                     <form.Field name="description">
                        {(field) =>
                           editingField === "description" &&
                           onDescriptionChange ? (
                              <Input
                                 className="text-base md:text-lg h-auto py-1 px-2 -ml-2"
                                 onBlur={() =>
                                    handleSave("description", field.state.value)
                                 }
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 onKeyDown={(e) =>
                                    handleKeyDown(
                                       e,
                                       "description",
                                       field.state.value,
                                    )
                                 }
                                 placeholder={descriptionPlaceholder}
                                 ref={descriptionInputRef}
                                 value={field.state.value}
                              />
                           ) : (
                              <span
                                 className={cn(
                                    onDescriptionChange &&
                                       "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2 inline-flex items-center gap-2",
                                 )}
                                 onClick={
                                    onDescriptionChange
                                       ? () => setEditingField("description")
                                       : undefined
                                 }
                              >
                                 {field.state.value || (
                                    <span className="italic text-muted-foreground/70">
                                       {descriptionPlaceholder}
                                    </span>
                                 )}
                                 {onDescriptionChange && (
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                 )}
                              </span>
                           )
                        }
                     </form.Field>
                  </div>
               )}
            </div>
            {(actions || children) && (
               <div className="flex items-center gap-2 shrink-0">
                  {actions}
                  {children}
               </div>
            )}
         </div>
      </>
   );
}
