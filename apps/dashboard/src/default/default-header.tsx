import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@packages/ui/lib/utils";
import { Input } from "@packages/ui/components/input";
import { Pencil } from "lucide-react";

interface DefaultHeaderProps {
   title: string;
   description?: string;
   actions?: ReactNode;
   onTitleChange?: (newTitle: string) => void;
   onDescriptionChange?: (newDescription: string) => void;
   descriptionPlaceholder?: string;
}

export function DefaultHeader({
   title,
   description,
   actions,
   onTitleChange,
   onDescriptionChange,
   descriptionPlaceholder = "Add a description...",
}: DefaultHeaderProps) {
   const [isSticky, setIsSticky] = useState(false);
   const [isEditingTitle, setIsEditingTitle] = useState(false);
   const [editTitle, setEditTitle] = useState(title);
   const [isEditingDescription, setIsEditingDescription] = useState(false);
   const [editDescription, setEditDescription] = useState(description || "");
   const sentinelRef = useRef<HTMLDivElement>(null);
   const titleInputRef = useRef<HTMLInputElement>(null);
   const descriptionInputRef = useRef<HTMLInputElement>(null);

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

   useEffect(() => {
      setEditTitle(title);
   }, [title]);

   useEffect(() => {
      setEditDescription(description || "");
   }, [description]);

   useEffect(() => {
      if (isEditingTitle && titleInputRef.current) {
         titleInputRef.current.focus();
         titleInputRef.current.select();
      }
   }, [isEditingTitle]);

   useEffect(() => {
      if (isEditingDescription && descriptionInputRef.current) {
         descriptionInputRef.current.focus();
         descriptionInputRef.current.select();
      }
   }, [isEditingDescription]);

   const handleSaveTitle = () => {
      if (editTitle.trim() && editTitle !== title && onTitleChange) {
         onTitleChange(editTitle.trim());
      }
      setIsEditingTitle(false);
   };

   const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
         handleSaveTitle();
      } else if (e.key === "Escape") {
         setEditTitle(title);
         setIsEditingTitle(false);
      }
   };

   const handleSaveDescription = () => {
      const trimmed = editDescription.trim();
      if (trimmed !== (description || "") && onDescriptionChange) {
         onDescriptionChange(trimmed);
      }
      setIsEditingDescription(false);
   };

   const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
         handleSaveDescription();
      } else if (e.key === "Escape") {
         setEditDescription(description || "");
         setIsEditingDescription(false);
      }
   };

   return (
      <>
         <div ref={sentinelRef} className="absolute top-0 h-px w-full" />
         <div
            className={cn(
               "sticky top-12 z-10 bg-background -mx-4 px-4 pt-4 pb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between transition-[border-color] duration-200",
               isSticky
                  ? "border-b border-border"
                  : "border-b border-transparent",
            )}
         >
            <div className="flex flex-col gap-2 min-w-0 flex-1 max-w-2xl">
               {isEditingTitle && onTitleChange ? (
                  <Input
                     ref={titleInputRef}
                     value={editTitle}
                     onChange={(e) => setEditTitle(e.target.value)}
                     onBlur={handleSaveTitle}
                     onKeyDown={handleKeyDown}
                     className="text-3xl md:text-4xl font-bold tracking-tight font-serif h-auto py-1 px-2 -ml-2"
                  />
               ) : (
                  <h1
                     className={cn(
                        "text-3xl md:text-4xl font-bold tracking-tight font-serif leading-tight truncate",
                        onTitleChange &&
                           "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2 inline-flex items-center gap-2",
                     )}
                     onClick={onTitleChange ? () => setIsEditingTitle(true) : undefined}
                  >
                     {title}
                     {onTitleChange && (
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                     )}
                  </h1>
               )}
               {(description !== undefined || onDescriptionChange) && (
                  <div className="text-base md:text-lg text-muted-foreground font-sans leading-relaxed">
                     {isEditingDescription && onDescriptionChange ? (
                        <Input
                           ref={descriptionInputRef}
                           value={editDescription}
                           onChange={(e) => setEditDescription(e.target.value)}
                           onBlur={handleSaveDescription}
                           onKeyDown={handleDescriptionKeyDown}
                           placeholder={descriptionPlaceholder}
                           className="text-base md:text-lg h-auto py-1 px-2 -ml-2"
                        />
                     ) : (
                        <span
                           className={cn(
                              onDescriptionChange &&
                                 "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2 inline-flex items-center gap-2"
                           )}
                           onClick={onDescriptionChange ? () => setIsEditingDescription(true) : undefined}
                        >
                           {description || (
                              <span className="italic text-muted-foreground/70">
                                 {descriptionPlaceholder}
                              </span>
                           )}
                           {onDescriptionChange && (
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                           )}
                        </span>
                     )}
                  </div>
               )}
            </div>
            {actions && (
               <div className="flex items-center gap-2 shrink-0">{actions}</div>
            )}
         </div>
      </>
   );
}
