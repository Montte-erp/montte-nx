import { Alert, AlertDescription } from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
   Download,
   FileText,
   Loader2,
   Paperclip,
   Trash2,
   Upload,
} from "lucide-react";
import { type ChangeEvent, Suspense, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { usePresignedUpload } from "@/features/file-upload/lib/use-presigned-upload";
import { useTRPC } from "@/integrations/clients";

function AttachmentsCardErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>Falha ao carregar anexos</AlertDescription>
      </Alert>
   );
}

function AttachmentsCardSkeleton() {
   return (
      <Card>
         <CardHeader className="flex flex-row items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-24" />
         </CardHeader>
         <CardContent className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
               <div
                  className="flex items-center justify-between p-3 border rounded-lg"
                  key={`attachment-skeleton-${i + 1}`}
               >
                  <div className="flex items-center gap-3">
                     <Skeleton className="size-4" />
                     <div>
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-16 mt-1" />
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Skeleton className="size-8" />
                     <Skeleton className="size-8" />
                  </div>
               </div>
            ))}
         </CardContent>
      </Card>
   );
}

function AttachmentsCardContent({ billId }: { billId: string }) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const fileInputRef = useRef<HTMLInputElement>(null);
   const { uploadToPresignedUrl } = usePresignedUpload();

   const [uploadingFile, setUploadingFile] = useState(false);
   const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
      string | null
   >(null);
   const [deletingAttachmentId, setDeletingAttachmentId] = useState<
      string | null
   >(null);

   const { data: attachments = [], refetch: refetchAttachments } = useQuery(
      trpc.bills.getAttachments.queryOptions({ billId }),
   );

   const requestUploadUrlMutation = useMutation(
      trpc.bills.requestAttachmentUploadUrl.mutationOptions(),
   );

   const confirmUploadMutation = useMutation(
      trpc.bills.confirmAttachmentUpload.mutationOptions({
         onError: () => {
            setUploadingFile(false);
         },
         onSuccess: () => {
            refetchAttachments();
            setUploadingFile(false);
            toast.success("Arquivo anexado com sucesso");
         },
      }),
   );

   const cancelUploadMutation = useMutation(
      trpc.bills.cancelAttachmentUpload.mutationOptions(),
   );

   const deleteAttachmentMutation = useMutation(
      trpc.bills.deleteAttachment.mutationOptions({
         onError: () => {
            setDeletingAttachmentId(null);
         },
         onSuccess: () => {
            refetchAttachments();
            setDeletingAttachmentId(null);
         },
      }),
   );

   const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadingFile(true);

      let uploadData: {
         presignedUrl: string;
         storageKey: string;
         attachmentId: string;
         contentType: string;
         fileSize: number;
      } | null = null;

      try {
         uploadData = await requestUploadUrlMutation.mutateAsync({
            billId,
            contentType: file.type,
            fileName: file.name,
            fileSize: file.size,
         });

         await uploadToPresignedUrl(uploadData.presignedUrl, file, file.type);

         await confirmUploadMutation.mutateAsync({
            attachmentId: uploadData.attachmentId,
            billId,
            contentType: file.type,
            fileName: file.name,
            fileSize: file.size,
            storageKey: uploadData.storageKey,
         });
      } catch {
         if (uploadData?.storageKey) {
            cancelUploadMutation.mutate({
               billId,
               storageKey: uploadData.storageKey,
            });
         }
         setUploadingFile(false);
         toast.error("Falha ao anexar arquivo");
      }

      if (fileInputRef.current) {
         fileInputRef.current.value = "";
      }
   };

   const handleDownloadAttachment = async (attachmentId: string) => {
      setDownloadingAttachmentId(attachmentId);
      try {
         const data = await queryClient.fetchQuery(
            trpc.bills.getAttachmentData.queryOptions({
               attachmentId,
               billId,
            }),
         );
         if (data?.data) {
            const link = document.createElement("a");
            link.href = data.data;
            link.download = data.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
         }
      } catch (error) {
         console.error("Error downloading attachment:", error);
      } finally {
         setDownloadingAttachmentId(null);
      }
   };

   const handleDeleteAttachment = async (attachmentId: string) => {
      setDeletingAttachmentId(attachmentId);
      try {
         await deleteAttachmentMutation.mutateAsync({
            attachmentId,
            billId,
         });
      } catch {
         setDeletingAttachmentId(null);
      }
   };

   return (
      <Card className="h-fit">
         <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
               <Paperclip className="size-5" />
               Anexos ({attachments.length})
            </CardTitle>
            <div>
               <input
                  accept="*/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  type="file"
               />
               <Button
                  disabled={uploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                  variant="outline"
               >
                  {uploadingFile ? (
                     <>
                        <Loader2 className="size-4 animate-spin" />
                        Enviando...
                     </>
                  ) : (
                     <>
                        <Upload className="size-4" />
                        Enviar
                     </>
                  )}
               </Button>
            </div>
         </CardHeader>
         <CardContent>
            {attachments.length === 0 ? (
               <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum anexo disponível
               </p>
            ) : (
               <div className="space-y-2">
                  {attachments.map((attachment) => (
                     <div
                        className="flex items-center justify-between p-3 border rounded-lg"
                        key={attachment.id}
                     >
                        <div className="flex items-center gap-3">
                           <FileText className="size-4 text-muted-foreground" />
                           <div>
                              <p className="text-sm font-medium">
                                 {attachment.fileName}
                              </p>
                              {attachment.fileSize && (
                                 <p className="text-xs text-muted-foreground">
                                    {Math.round(attachment.fileSize / 1024)} KB
                                 </p>
                              )}
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <Button
                              disabled={
                                 downloadingAttachmentId === attachment.id
                              }
                              onClick={() =>
                                 handleDownloadAttachment(attachment.id)
                              }
                              size="sm"
                              variant="ghost"
                           >
                              {downloadingAttachmentId === attachment.id ? (
                                 <Loader2 className="size-4 animate-spin" />
                              ) : (
                                 <Download className="size-4" />
                              )}
                           </Button>
                           <Button
                              disabled={deletingAttachmentId === attachment.id}
                              onClick={() =>
                                 handleDeleteAttachment(attachment.id)
                              }
                              size="sm"
                              variant="ghost"
                           >
                              {deletingAttachmentId === attachment.id ? (
                                 <Loader2 className="size-4 animate-spin" />
                              ) : (
                                 <Trash2 className="size-4 text-destructive" />
                              )}
                           </Button>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </CardContent>
      </Card>
   );
}

export function BillAttachmentsCard({ billId }: { billId: string }) {
   return (
      <ErrorBoundary FallbackComponent={AttachmentsCardErrorFallback}>
         <Suspense fallback={<AttachmentsCardSkeleton />}>
            <AttachmentsCardContent billId={billId} />
         </Suspense>
      </ErrorBoundary>
   );
}
