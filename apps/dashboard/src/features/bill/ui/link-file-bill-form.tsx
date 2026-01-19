import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { Button } from "@packages/ui/components/button";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatFileSize } from "@packages/utils/file";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
   ExternalLink,
   FileText,
   ImageIcon,
   Loader2,
   Paperclip,
   Trash2,
   Upload,
   X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { usePresignedUpload } from "@/features/file-upload/lib/use-presigned-upload";
import { useTRPC } from "@/integrations/clients";

type Bill = BillWithRelations;

type LinkFileBillFormProps = {
   bill: Bill | null;
   onSuccess?: () => void;
};

const ACCEPTED_FILE_TYPES = {
   "application/pdf": [".pdf"],
   "image/jpeg": [".jpg", ".jpeg"],
   "image/png": [".png"],
   "image/webp": [".webp"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type PendingFile = {
   file: File;
   preview: string | null;
   uploading: boolean;
};

export function LinkFileBillForm({ bill, onSuccess }: LinkFileBillFormProps) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
   const { uploadToPresignedUrl } = usePresignedUpload();

   // Cleanup object URLs on unmount to prevent memory leaks
   useEffect(() => {
      return () => {
         for (const pending of pendingFiles) {
            if (pending.preview) {
               URL.revokeObjectURL(pending.preview);
            }
         }
      };
   }, [pendingFiles]);

   const { data: attachments, isLoading: isLoadingAttachments } = useQuery({
      ...trpc.bills.getAttachments.queryOptions({
         billId: bill?.id || "",
      }),
      enabled: !!bill?.id,
   });

   const requestUploadUrlMutation = useMutation(
      trpc.bills.requestAttachmentUploadUrl.mutationOptions(),
   );

   const confirmUploadMutation = useMutation(
      trpc.bills.confirmAttachmentUpload.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao anexar arquivo");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getAttachments.queryKey({
                  billId: bill?.id || "",
               }),
            });
            toast.success("Arquivo anexado com sucesso");
            onSuccess?.();
         },
      }),
   );

   const cancelUploadMutation = useMutation(
      trpc.bills.cancelAttachmentUpload.mutationOptions(),
   );

   const deleteAttachmentMutation = useMutation(
      trpc.bills.deleteAttachment.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao remover arquivo");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getAttachments.queryKey({
                  billId: bill?.id || "",
               }),
            });
            toast.success("Arquivo removido com sucesso");
         },
      }),
   );

   const handleFileDrop = useCallback((files: File[]) => {
      const newPendingFiles: PendingFile[] = files.map((file) => ({
         file,
         preview: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : null,
         uploading: false,
      }));
      setPendingFiles((prev) => [...prev, ...newPendingFiles]);
   }, []);

   const removePendingFile = useCallback((index: number) => {
      setPendingFiles((prev) => {
         const file = prev[index];
         if (file?.preview) URL.revokeObjectURL(file.preview);
         return prev.filter((_, i) => i !== index);
      });
   }, []);

   const handleUploadAll = async () => {
      if (!bill || pendingFiles.length === 0) return;

      for (let i = 0; i < pendingFiles.length; i++) {
         const pending = pendingFiles[i];
         if (!pending) continue;

         setPendingFiles((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, uploading: true } : p)),
         );

         let uploadData: {
            presignedUrl: string;
            storageKey: string;
            attachmentId: string;
            contentType: string;
            fileSize: number;
         } | null = null;

         try {
            uploadData = await requestUploadUrlMutation.mutateAsync({
               billId: bill.id,
               contentType: pending.file.type,
               fileName: pending.file.name,
               fileSize: pending.file.size,
            });

            await uploadToPresignedUrl(
               uploadData.presignedUrl,
               pending.file,
               pending.file.type,
            );

            await confirmUploadMutation.mutateAsync({
               attachmentId: uploadData.attachmentId,
               billId: bill.id,
               contentType: pending.file.type,
               fileName: pending.file.name,
               fileSize: pending.file.size,
               storageKey: uploadData.storageKey,
            });
         } catch {
            if (uploadData?.storageKey) {
               cancelUploadMutation.mutate({
                  billId: bill.id,
                  storageKey: uploadData.storageKey,
               });
            }
            setPendingFiles((prev) =>
               prev.map((p, idx) =>
                  idx === i ? { ...p, uploading: false } : p,
               ),
            );
            return;
         }
      }

      // Revoke all object URLs before clearing to prevent memory leaks
      for (const pending of pendingFiles) {
         if (pending.preview) {
            URL.revokeObjectURL(pending.preview);
         }
      }
      setPendingFiles([]);
   };

   const handleDeleteAttachment = (attachmentId: string) => {
      if (!bill) return;
      deleteAttachmentMutation.mutate({
         attachmentId,
         billId: bill.id,
      });
   };

   const handleViewAttachment = async (attachmentId: string) => {
      if (!bill) return;

      try {
         const data = await queryClient.fetchQuery(
            trpc.bills.getAttachmentData.queryOptions({
               attachmentId,
               billId: bill.id,
            }),
         );
         if (data?.data) {
            window.open(data.data, "_blank");
         }
      } catch {
         toast.error("Falha ao abrir arquivo");
      }
   };

   const hasExistingAttachments = attachments && attachments.length > 0;
   const hasPendingFiles = pendingFiles.length > 0;
   const isUploading = pendingFiles.some((p) => p.uploading);

   return (
      <>
         <SheetHeader>
            <SheetTitle>Anexar Arquivo</SheetTitle>
            <SheetDescription>
               Anexe documentos relacionados a esta conta
            </SheetDescription>
         </SheetHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {isLoadingAttachments && (
               <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-16 w-full" />
               </div>
            )}

            {hasExistingAttachments && (
               <div className="space-y-2">
                  <div className="flex items-center justify-between">
                     <p className="text-sm font-medium flex items-center gap-2">
                        <Paperclip className="size-4" />
                        Arquivos anexados ({attachments.length})
                     </p>
                  </div>
                  <ItemGroup className="rounded-lg border">
                     {attachments.map((attachment, index) => {
                        const isPdf =
                           attachment.contentType === "application/pdf";
                        const isDeleting =
                           deleteAttachmentMutation.isPending &&
                           deleteAttachmentMutation.variables?.attachmentId ===
                              attachment.id;

                        return (
                           <div key={attachment.id}>
                              {index > 0 && <ItemSeparator />}
                              <Item size="sm" variant="default">
                                 <ItemMedia
                                    className={`size-10 rounded-md ${
                                       isPdf
                                          ? "bg-red-100 text-red-600"
                                          : "bg-blue-100 text-blue-600"
                                    }`}
                                    variant="icon"
                                 >
                                    {isPdf ? (
                                       <FileText className="size-5" />
                                    ) : (
                                       <ImageIcon className="size-5" />
                                    )}
                                 </ItemMedia>
                                 <ItemContent>
                                    <ItemTitle className="text-sm truncate max-w-[180px]">
                                       {attachment.fileName}
                                    </ItemTitle>
                                    <p className="text-xs text-muted-foreground">
                                       {attachment.fileSize
                                          ? formatFileSize(attachment.fileSize)
                                          : isPdf
                                            ? "PDF"
                                            : "Imagem"}
                                    </p>
                                 </ItemContent>
                                 <ItemActions>
                                    <Button
                                       onClick={() =>
                                          handleViewAttachment(attachment.id)
                                       }
                                       size="icon"
                                       variant="ghost"
                                    >
                                       <ExternalLink className="size-4" />
                                    </Button>
                                    <Button
                                       className="text-destructive hover:text-destructive"
                                       disabled={isDeleting}
                                       onClick={() =>
                                          handleDeleteAttachment(attachment.id)
                                       }
                                       size="icon"
                                       variant="ghost"
                                    >
                                       {isDeleting ? (
                                          <Loader2 className="size-4 animate-spin" />
                                       ) : (
                                          <Trash2 className="size-4" />
                                       )}
                                    </Button>
                                 </ItemActions>
                              </Item>
                           </div>
                        );
                     })}
                  </ItemGroup>
               </div>
            )}

            <div className="space-y-2">
               <p className="text-sm font-medium flex items-center gap-2">
                  <Upload className="size-4" />
                  {hasExistingAttachments
                     ? "Adicionar mais arquivos"
                     : "Selecione um arquivo"}
               </p>
               <Dropzone
                  accept={ACCEPTED_FILE_TYPES}
                  maxSize={MAX_FILE_SIZE}
                  multiple
                  onDrop={handleFileDrop}
                  src={pendingFiles.map((p) => p.file)}
               >
                  <DropzoneEmptyState />
                  <DropzoneContent />
               </Dropzone>
            </div>

            {hasPendingFiles && (
               <div className="space-y-2">
                  <p className="text-sm font-medium">
                     Arquivos selecionados ({pendingFiles.length})
                  </p>
                  <ItemGroup className="rounded-lg border">
                     {pendingFiles.map((pending, index) => {
                        const isPdf = pending.file.type === "application/pdf";
                        const fileKey = `${pending.file.name}-${pending.file.size}-${pending.file.lastModified}`;

                        return (
                           <div key={fileKey}>
                              {index > 0 && <ItemSeparator />}
                              <Item size="sm" variant="default">
                                 <ItemMedia
                                    className={`size-10 rounded-md overflow-hidden ${
                                       isPdf
                                          ? "bg-red-100 text-red-600"
                                          : "bg-blue-100"
                                    }`}
                                    variant="icon"
                                 >
                                    {isPdf ? (
                                       <FileText className="size-5" />
                                    ) : pending.preview ? (
                                       <img
                                          alt="Preview"
                                          className="size-full object-cover"
                                          src={pending.preview}
                                       />
                                    ) : (
                                       <ImageIcon className="size-5 text-blue-600" />
                                    )}
                                 </ItemMedia>
                                 <ItemContent>
                                    <ItemTitle className="text-sm truncate max-w-[180px]">
                                       {pending.file.name}
                                    </ItemTitle>
                                    <p className="text-xs text-muted-foreground">
                                       {formatFileSize(pending.file.size)}
                                    </p>
                                 </ItemContent>
                                 <ItemActions>
                                    {pending.uploading ? (
                                       <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                    ) : (
                                       <Button
                                          onClick={() =>
                                             removePendingFile(index)
                                          }
                                          size="icon"
                                          variant="ghost"
                                       >
                                          <X className="size-4" />
                                       </Button>
                                    )}
                                 </ItemActions>
                              </Item>
                           </div>
                        );
                     })}
                  </ItemGroup>
               </div>
            )}
         </div>

         <SheetFooter className="px-4 pb-4">
            <Button
               className="w-full"
               disabled={!hasPendingFiles || isUploading}
               onClick={handleUploadAll}
            >
               {isUploading ? (
                  <>
                     <Loader2 className="size-4 animate-spin" />
                     Enviando...
                  </>
               ) : (
                  <>
                     <Upload className="size-4" />
                     Enviar
                     {hasPendingFiles && ` (${pendingFiles.length})`}
                  </>
               )}
            </Button>
         </SheetFooter>
      </>
   );
}
