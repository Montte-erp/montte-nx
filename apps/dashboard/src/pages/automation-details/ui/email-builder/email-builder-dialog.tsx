import type {
   EmailBlock,
   EmailTemplate,
} from "@packages/transactional/schemas/email-builder.schema";
import { DEFAULT_BILLS_DIGEST_TEMPLATE } from "@packages/transactional/schemas/email-builder.schema";
import { Button } from "@packages/ui/components/button";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@packages/ui/components/dialog";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { Eye, FileText, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { AddBlockButton } from "./add-block-button";
import { BlockEditor } from "./block-editor";
import { EmailPreview } from "./email-preview";

type EmailBuilderDialogProps = {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   value: EmailTemplate | undefined;
   onChange: (template: EmailTemplate) => void;
};

export function EmailBuilderDialog({
   open,
   onOpenChange,
   value,
   onChange,
}: EmailBuilderDialogProps) {
   const [template, setTemplate] = useState<EmailTemplate>(
      value ?? {
         blocks: [],
         styles: {
            primaryColor: "#3b82f6",
            backgroundColor: "#f4f4f5",
            textColor: "#18181b",
            fontFamily: "sans-serif",
         },
      },
   );
   const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

   const handleAddBlock = useCallback((block: EmailBlock) => {
      setTemplate((prev) => ({
         ...prev,
         blocks: [...prev.blocks, block],
      }));
   }, []);

   const handleUpdateBlock = useCallback((index: number, block: EmailBlock) => {
      setTemplate((prev) => ({
         ...prev,
         blocks: prev.blocks.map((b, i) => (i === index ? block : b)),
      }));
   }, []);

   const handleDeleteBlock = useCallback((index: number) => {
      setTemplate((prev) => ({
         ...prev,
         blocks: prev.blocks.filter((_, i) => i !== index),
      }));
   }, []);

   const handleSave = useCallback(() => {
      onChange(template);
      onOpenChange(false);
   }, [template, onChange, onOpenChange]);

   const handleLoadTemplate = useCallback(() => {
      setTemplate(DEFAULT_BILLS_DIGEST_TEMPLATE);
   }, []);

   return (
      <Dialog onOpenChange={onOpenChange} open={open}>
         <DialogContent className="max-w-3xl h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
               <DialogTitle>Editor de Email Visual</DialogTitle>
               <DialogDescription>
                  Construa o layout do seu email adicionando e organizando
                  blocos
               </DialogDescription>
            </DialogHeader>

            <Tabs
               className="flex-1 flex flex-col min-h-0 overflow-hidden"
               onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
               value={activeTab}
            >
               <TabsList className="w-full justify-start flex-shrink-0">
                  <TabsTrigger className="gap-1.5" value="edit">
                     <Pencil className="size-3.5" />
                     Editar
                  </TabsTrigger>
                  <TabsTrigger className="gap-1.5" value="preview">
                     <Eye className="size-3.5" />
                     Visualizar
                  </TabsTrigger>
               </TabsList>

               <div className="flex-1 min-h-0 mt-4 overflow-hidden">
                  <TabsContent
                     className="h-full m-0 data-[state=active]:h-full"
                     value="edit"
                  >
                     <ScrollArea className="h-full border rounded-lg">
                        <div className="p-4">
                           {template.blocks.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-16 text-center">
                                 <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
                                    <FileText className="size-8 text-muted-foreground" />
                                 </div>
                                 <h3 className="text-lg font-medium mb-1">
                                    Nenhum bloco adicionado
                                 </h3>
                                 <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                                    Comece adicionando blocos para construir o
                                    layout do seu email
                                 </p>
                                 <div className="flex gap-3">
                                    <AddBlockButton
                                       onAddBlock={handleAddBlock}
                                    />
                                    <Button
                                       onClick={handleLoadTemplate}
                                       variant="outline"
                                    >
                                       Carregar Template
                                    </Button>
                                 </div>
                              </div>
                           ) : (
                              <div className="space-y-3">
                                 {template.blocks.map((block, index) => (
                                    <BlockEditor
                                       block={block}
                                       key={`block-${index}`}
                                       onChange={(b) =>
                                          handleUpdateBlock(index, b)
                                       }
                                       onDelete={() => handleDeleteBlock(index)}
                                    />
                                 ))}
                                 <div className="flex justify-center pt-4">
                                    <AddBlockButton
                                       onAddBlock={handleAddBlock}
                                    />
                                 </div>
                              </div>
                           )}
                        </div>
                     </ScrollArea>
                  </TabsContent>

                  <TabsContent
                     className="h-full m-0 data-[state=active]:h-full"
                     value="preview"
                  >
                     <ScrollArea className="h-full border rounded-lg">
                        <EmailPreview template={template} />
                     </ScrollArea>
                  </TabsContent>
               </div>
            </Tabs>

            <DialogFooter className="flex-shrink-0">
               <Button onClick={() => onOpenChange(false)} variant="outline">
                  Cancelar
               </Button>
               <Button onClick={handleSave}>Salvar Template</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
