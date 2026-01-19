import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { Textarea } from "@packages/ui/components/textarea";
import { useRef, useState } from "react";
import { useCredenza } from "@/hooks/use-credenza";
import { EmojiPickerButton } from "./emoji-picker-button";
import { MarkdownPreview } from "./markdown-preview";
import { TextCardImageUpload } from "./text-card-image-upload";

type TextCardEditorCredenzaProps = {
   initialContent: string;
   onSave: (content: string) => void;
};

const MAX_CHARACTERS = 4000;

export function TextCardEditorCredenza({
   initialContent,
   onSave,
}: TextCardEditorCredenzaProps) {
   const { closeCredenza } = useCredenza();
   const [mode, setMode] = useState<"write" | "preview">("write");
   const [content, setContent] = useState(initialContent);
   const textareaRef = useRef<HTMLTextAreaElement>(null);

   const handleInsertText = (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
         setContent((prev) => prev + text);
         return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent =
         content.substring(0, start) + text + content.substring(end);

      if (newContent.length <= MAX_CHARACTERS) {
         setContent(newContent);
         // Move cursor after inserted text
         requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd =
               start + text.length;
            textarea.focus();
         });
      }
   };

   const handleContentChange = (value: string) => {
      if (value.length <= MAX_CHARACTERS) {
         setContent(value);
      }
   };

   const handleSave = () => {
      onSave(content);
      closeCredenza();
   };

   const handleCancel = () => {
      closeCredenza();
   };

   const characterCount = content.length;
   const isOverLimit = characterCount > MAX_CHARACTERS;

   return (
      <>
         <CredenzaHeader>
            <div className="flex items-center justify-between">
               <CredenzaTitle>Editar texto</CredenzaTitle>
               <Tabs
                  onValueChange={(v) => setMode(v as "write" | "preview")}
                  value={mode}
               >
                  <TabsList>
                     <TabsTrigger value="write">Escrever</TabsTrigger>
                     <TabsTrigger value="preview">Visualizar</TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>
         </CredenzaHeader>
         <CredenzaBody className="space-y-4">
            {mode === "write" ? (
               <div className="space-y-2">
                  <Textarea
                     className="min-h-[300px] resize-none font-mono text-sm"
                     onChange={(e) => handleContentChange(e.target.value)}
                     placeholder="Escreva seu texto em Markdown..."
                     ref={textareaRef}
                     value={content}
                  />
                  <div className="flex items-center gap-2">
                     <TextCardImageUpload onInsert={handleInsertText} />
                     <EmojiPickerButton onSelect={handleInsertText} />
                  </div>
               </div>
            ) : (
               <div className="min-h-[300px] rounded-md border p-4 overflow-auto">
                  <MarkdownPreview content={content} />
               </div>
            )}
         </CredenzaBody>
         <CredenzaFooter className="flex items-center justify-between">
            <span
               className={`text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}
            >
               {characterCount} / {MAX_CHARACTERS}
            </span>
            <div className="flex items-center gap-2">
               <Button onClick={handleCancel} variant="outline">
                  Cancelar
               </Button>
               <Button disabled={isOverLimit} onClick={handleSave}>
                  Salvar
               </Button>
            </div>
         </CredenzaFooter>
      </>
   );
}
