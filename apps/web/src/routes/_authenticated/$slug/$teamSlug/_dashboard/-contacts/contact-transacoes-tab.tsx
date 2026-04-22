import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format, of } from "@f-o-t/money";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { Route } from "../contacts/$contactId";

type Transaction = Outputs["contacts"]["getTransactions"]["items"][number];

const TYPE_LABELS: Record<Transaction["type"], string> = {
   income: "Receita",
   expense: "Despesa",
   transfer: "Transferência",
};

const STATUS_LABELS: Record<Transaction["status"], string> = {
   paid: "Pago",
   pending: "Pendente",
   cancelled: "Cancelado",
};

const STATUS_VARIANTS: Record<
   Transaction["status"],
   "default" | "secondary" | "outline"
> = {
   paid: "default",
   pending: "secondary",
   cancelled: "outline",
};

export function ContactTransacoesTab({ contactId }: { contactId: string }) {
   const { page, pageSize } = Route.useSearch();
   const navigate = Route.useNavigate();

   const { data } = useSuspenseQuery(
      orpc.contacts.getTransactions.queryOptions({
         input: { id: contactId, page, pageSize },
      }),
   );

   const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

   function goToPage(next: number) {
      navigate({
         search: (prev) => ({ ...prev, page: next }),
         replace: true,
      });
   }

   if (page === 1 && data.items.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Receipt className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhuma transação</EmptyTitle>
               <EmptyDescription>
                  Este contato ainda não possui transações vinculadas.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   return (
      <div className="flex flex-col gap-4">
         <Table>
            <TableHeader>
               <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {data.items.map((tx) => (
                  <TableRow key={tx.id}>
                     <TableCell className="font-medium">
                        {tx.description}
                     </TableCell>
                     <TableCell>
                        {dayjs(tx.date).format("DD/MM/YYYY")}
                     </TableCell>
                     <TableCell>{TYPE_LABELS[tx.type]}</TableCell>
                     <TableCell>
                        <Badge variant={STATUS_VARIANTS[tx.status]}>
                           {STATUS_LABELS[tx.status]}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-right">
                        {format(of(tx.amount, "BRL"), "pt-BR")}
                     </TableCell>
                  </TableRow>
               ))}
            </TableBody>
         </Table>

         <div className="flex items-center gap-4">
            <span className="flex-1 text-xs text-muted-foreground">
               {data.total} transações · página {page} de {totalPages}
            </span>
            <Button
               disabled={page <= 1}
               size="sm"
               variant="outline"
               onClick={() => goToPage(page - 1)}
            >
               <ChevronLeft className="size-4" />
               Anterior
            </Button>
            <Button
               disabled={page >= totalPages}
               size="sm"
               variant="outline"
               onClick={() => goToPage(page + 1)}
            >
               Próxima
               <ChevronRight className="size-4" />
            </Button>
         </div>
      </div>
   );
}
