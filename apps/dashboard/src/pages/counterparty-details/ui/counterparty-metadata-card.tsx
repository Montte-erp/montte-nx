import { Alert, AlertDescription } from "@packages/ui/components/alert";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { formatDate } from "@packages/utils/date";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
   Building2,
   Calendar,
   CheckCircle2,
   Copy,
   FileText,
   User,
   Users,
   XCircle,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

function MetadataCardErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>Falha ao carregar metadados</AlertDescription>
      </Alert>
   );
}

function MetadataCardSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
         </CardHeader>
         <CardContent className="space-y-3">
            <Skeleton className="h-7 w-full rounded-full" />
            <Skeleton className="h-7 w-full rounded-full" />
            <Skeleton className="h-7 w-full rounded-full" />
            <Skeleton className="h-7 w-full rounded-full" />
         </CardContent>
      </Card>
   );
}

function getTypeIcon(type: string) {
   switch (type) {
      case "client":
         return <User className="size-3.5" />;
      case "supplier":
         return <Building2 className="size-3.5" />;
      case "both":
         return <Users className="size-3.5" />;
      default:
         return <User className="size-3.5" />;
   }
}

function getTypeColor(type: string) {
   switch (type) {
      case "client":
         return "text-emerald-600";
      case "supplier":
         return "text-blue-600";
      case "both":
         return "text-purple-600";
      default:
         return "";
   }
}

function getTypeLabel(type: string): string {
   switch (type) {
      case "client":
         return "Cliente";
      case "supplier":
         return "Fornecedor";
      case "both":
         return "Cliente e Fornecedor";
      default:
         return type;
   }
}

function copyToClipboard(text: string) {
   navigator.clipboard.writeText(text);
   toast.success("Copiado para a área de transferência");
}

function MetadataCardContent({ counterpartyId }: { counterpartyId: string }) {
   const trpc = useTRPC();

   const { data: counterparty } = useSuspenseQuery(
      trpc.counterparties.getById.queryOptions({ id: counterpartyId }),
   );

   if (!counterparty) {
      return null;
   }

   return (
      <Card className="h-fit">
         <CardHeader>
            <CardTitle>Metadados</CardTitle>
            <CardDescription>Informacoes do parceiro</CardDescription>
         </CardHeader>
         <CardContent>
            <div className="flex flex-wrap gap-2">
               <Announcement>
                  <AnnouncementTag
                     className={`flex items-center gap-1.5 ${getTypeColor(counterparty.type)}`}
                  >
                     {getTypeIcon(counterparty.type)}
                     Tipo
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {getTypeLabel(counterparty.type)}
                  </AnnouncementTitle>
               </Announcement>

               <Announcement>
                  <AnnouncementTag
                     className={`flex items-center gap-1.5 ${counterparty.isActive ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                     {counterparty.isActive ? (
                        <CheckCircle2 className="size-3.5" />
                     ) : (
                        <XCircle className="size-3.5" />
                     )}
                     Status
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {counterparty.isActive ? "Ativo" : "Inativo"}
                  </AnnouncementTitle>
               </Announcement>

               {counterparty.document && (
                  <Announcement>
                     <AnnouncementTag className="flex items-center gap-1.5">
                        <FileText className="size-3.5" />
                        {counterparty.documentType === "cpf"
                           ? "CPF"
                           : counterparty.documentType === "cnpj"
                             ? "CNPJ"
                             : "Documento"}
                     </AnnouncementTag>
                     <AnnouncementTitle className="flex items-center gap-1.5">
                        <span className="font-mono">
                           {counterparty.document}
                        </span>
                        <Tooltip>
                           <TooltipTrigger asChild>
                              <Button
                                 className="size-5"
                                 onClick={() =>
                                    copyToClipboard(counterparty.document ?? "")
                                 }
                                 size="icon"
                                 variant="ghost"
                              >
                                 <Copy className="size-3" />
                              </Button>
                           </TooltipTrigger>
                           <TooltipContent>Copiar</TooltipContent>
                        </Tooltip>
                     </AnnouncementTitle>
                  </Announcement>
               )}

               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <Calendar className="size-3.5" />
                     Cadastrado em
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {formatDate(
                        new Date(counterparty.createdAt),
                        "DD/MM/YYYY",
                     )}
                  </AnnouncementTitle>
               </Announcement>

               {counterparty.tradeName && (
                  <Announcement>
                     <AnnouncementTag>Nome Fantasia</AnnouncementTag>
                     <AnnouncementTitle>
                        {counterparty.tradeName}
                     </AnnouncementTitle>
                  </Announcement>
               )}

               {counterparty.legalName && (
                  <Announcement>
                     <AnnouncementTag>Razão Social</AnnouncementTag>
                     <AnnouncementTitle>
                        {counterparty.legalName}
                     </AnnouncementTitle>
                  </Announcement>
               )}

               {counterparty.industry && (
                  <Announcement>
                     <AnnouncementTag>Setor</AnnouncementTag>
                     <AnnouncementTitle>
                        {counterparty.industry}
                     </AnnouncementTitle>
                  </Announcement>
               )}

               {counterparty.taxRegime && (
                  <Announcement>
                     <AnnouncementTag>Regime Tributário</AnnouncementTag>
                     <AnnouncementTitle>
                        {counterparty.taxRegime === "simples"
                           ? "Simples Nacional"
                           : counterparty.taxRegime === "lucro_presumido"
                             ? "Lucro Presumido"
                             : counterparty.taxRegime === "lucro_real"
                               ? "Lucro Real"
                               : "MEI"}
                     </AnnouncementTitle>
                  </Announcement>
               )}
            </div>
         </CardContent>
      </Card>
   );
}

export function CounterpartyMetadataCard({
   counterpartyId,
}: {
   counterpartyId: string;
}) {
   return (
      <ErrorBoundary FallbackComponent={MetadataCardErrorFallback}>
         <Suspense fallback={<MetadataCardSkeleton />}>
            <MetadataCardContent counterpartyId={counterpartyId} />
         </Suspense>
      </ErrorBoundary>
   );
}
