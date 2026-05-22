import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Download, FileText, KeyRound, Mail, RefreshCcw } from "lucide-react";
import { NfeStatusBadge, type NfeRow } from "./nfe-columns";

export function NfeDetailSheet({
   row,
   onConsult,
   onDownload,
}: {
   row: NfeRow;
   onConsult: (id: string) => void;
   onDownload: (id: string) => void;
}) {
   return (
      <>
         <SheetHeader>
            <div className="flex flex-wrap items-center gap-2">
               <SheetTitle>NF-e {row.numero}</SheetTitle>
               <NfeStatusBadge status={row.status} />
            </div>
            <SheetDescription>
               Documento emitido com certificado digital mockado para{" "}
               {row.cliente}.
            </SheetDescription>
         </SheetHeader>
         <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4">
            <section className="rounded-md border bg-card p-4">
               <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-2">
                     <h3 className="text-sm font-medium">
                        Certificado digital
                     </h3>
                     <p className="text-sm text-muted-foreground">
                        A1 mockado conectado. Assinatura, transmissão e guarda
                        do XML ficam automatizadas na demo.
                     </p>
                  </div>
                  <Badge variant="success">
                     <KeyRound />
                     Ativo
                  </Badge>
               </div>
            </section>
            <section className="rounded-md border bg-card p-4">
               <div className="grid gap-4 md:grid-cols-2">
                  <Info label="Cliente" value={row.cliente} />
                  <Info label="CNPJ" value={row.cnpj} />
                  <Info label="Operação" value={row.operacao} />
                  <Info label="Valor" value={row.valor} />
                  <Info
                     label="Série / modelo"
                     value={`${row.serie} / ${row.modelo}`}
                  />
                  <Info label="Ambiente" value={row.ambiente} />
               </div>
            </section>
            <section className="rounded-md border bg-card p-4">
               <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                     <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">Retorno SEFAZ</h3>
                        <p className="text-sm text-muted-foreground">
                           {row.retorno}
                        </p>
                     </div>
                     <Badge variant="outline">{row.ambiente}</Badge>
                  </div>
                  <Separator />
                  <div className="grid gap-4 md:grid-cols-2">
                     <Info label="Recibo" value={row.recibo} />
                     <Info label="Protocolo" value={row.protocolo} />
                  </div>
                  <Info label="Chave de acesso" value={row.chave} mono />
               </div>
            </section>
            <section className="rounded-md border bg-card p-4">
               <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-medium">Linha do tempo fiscal</h3>
                  <TimelineItem
                     label="Documento criado"
                     value={`NF-e ${row.numero}, série ${row.serie}, modelo ${row.modelo}.`}
                  />
                  <TimelineItem label="Último evento" value={row.evento} />
                  <TimelineItem label="Situação atual" value={row.retorno} />
               </div>
            </section>
            <section className="rounded-md border bg-card p-4">
               <div className="grid gap-2 md:grid-cols-3">
                  <Button
                     disabled={row.status !== "autorizada"}
                     onClick={() => onDownload(row.id)}
                     variant="outline"
                  >
                     <Download />
                     XML/DANFE
                  </Button>
                  <Button
                     disabled={row.status !== "autorizada"}
                     variant="outline"
                  >
                     <Mail />
                     Enviar e-mail
                  </Button>
                  <Button
                     disabled={row.status !== "autorizada"}
                     variant="outline"
                  >
                     <FileText />
                     CC-e
                  </Button>
               </div>
            </section>
         </div>
         <SheetFooter>
            <Button onClick={() => onConsult(row.id)} variant="outline">
               <RefreshCcw />
               Consultar SEFAZ
            </Button>
         </SheetFooter>
      </>
   );
}

function Info({
   label,
   value,
   mono,
}: {
   label: string;
   value: string;
   mono?: boolean;
}) {
   return (
      <div className="flex min-w-0 flex-col gap-2">
         <span className="text-xs font-medium text-muted-foreground">
            {label}
         </span>
         <span
            className={
               mono
                  ? "break-all font-mono text-sm text-foreground"
                  : "break-words text-sm text-foreground"
            }
         >
            {value}
         </span>
      </div>
   );
}

function TimelineItem({ label, value }: { label: string; value: string }) {
   return (
      <div className="grid gap-2 border-l-2 border-border pl-4">
         <span className="text-xs font-medium text-muted-foreground">
            {label}
         </span>
         <span className="text-sm text-foreground">{value}</span>
      </div>
   );
}
