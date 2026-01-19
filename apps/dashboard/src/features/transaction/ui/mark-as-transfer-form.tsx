import { formatDecimalCurrency } from "@packages/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import {
   RadioGroup,
   RadioGroupItem,
} from "@packages/ui/components/radio-group";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { formatDate } from "@packages/utils/date";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import type { Transaction } from "./transaction-list";

type MarkAsTransferFormProps = {
   transactions: Transaction[];
   onSuccess?: () => void;
};

type MatchOption = "create" | string;

export function MarkAsTransferForm({
   transactions,
   onSuccess,
}: MarkAsTransferFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const [selectedBankAccountId, setSelectedBankAccountId] =
      useState<string>("");
   const [step, setStep] = useState<"select-account" | "confirm-match">(
      "select-account",
   );
   const [selectedMatch, setSelectedMatch] = useState<MatchOption>("create");

   const { data: bankAccounts = [] } = useQuery(
      trpc.bankAccounts.getAll.queryOptions(),
   );

   const sourceAccounts = useMemo(() => {
      const accountIds = [
         ...new Set(transactions.map((t) => t.bankAccountId).filter(Boolean)),
      ];
      return bankAccounts.filter((a) => accountIds.includes(a.id));
   }, [transactions, bankAccounts]);

   const singleTransaction = transactions.length === 1 ? transactions[0] : null;

   const {
      data: candidates,
      isLoading: isLoadingCandidates,
      refetch: refetchCandidates,
   } = useQuery({
      ...trpc.transactions.findTransferCandidates.queryOptions({
         toBankAccountId: selectedBankAccountId,
         transactionId: singleTransaction?.id || "",
      }),
      enabled: false,
   });

   const markAsTransferMutation = useMutation(
      trpc.transactions.markAsTransfer.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao marcar como transferência");
         },
         onSuccess: (data) => {
            toast.success(
               `${data.length} ${data.length === 1 ? "transação marcada" : "transações marcadas"} como transferência`,
            );
            onSuccess?.();
            closeSheet();
         },
      }),
   );

   const sourceBankAccountIds = [
      ...new Set(
         transactions
            .filter((t) => t.bankAccountId)
            .map((t) => t.bankAccountId),
      ),
   ];

   const availableBankAccounts = bankAccounts.filter(
      (account) => !sourceBankAccountIds.includes(account.id),
   );

   const bankAccountOptions = availableBankAccounts.map((account) => ({
      label: `${account.name} - ${account.bank}`,
      value: account.id,
   }));

   const handleSearchMatches = async () => {
      if (!selectedBankAccountId) return;

      if (singleTransaction) {
         await refetchCandidates();
         setStep("confirm-match");
      } else {
         handleConfirm();
      }
   };

   const handleConfirm = () => {
      if (!selectedBankAccountId || transactions.length === 0) return;

      const matchedTransactionIds: Record<string, string> = {};

      if (singleTransaction && selectedMatch !== "create") {
         matchedTransactionIds[singleTransaction.id] = selectedMatch;
      }

      markAsTransferMutation.mutate({
         ids: transactions.map((t) => t.id),
         matchedTransactionIds:
            Object.keys(matchedTransactionIds).length > 0
               ? matchedTransactionIds
               : undefined,
         toBankAccountId: selectedBankAccountId,
      });
   };

   const handleBack = () => {
      setStep("select-account");
      setSelectedMatch("create");
   };

   const destinationAccount = bankAccounts.find(
      (a) => a.id === selectedBankAccountId,
   );
   const hasExactMatch = candidates?.exactMatch != null;
   const hasFuzzyMatches = (candidates?.fuzzyMatches?.length || 0) > 0;
   const hasAnyMatch = hasExactMatch || hasFuzzyMatches;

   return (
      <>
         <SheetHeader>
            <SheetTitle>Marcar como Transferência</SheetTitle>
            <SheetDescription>
               {step === "select-account" ? (
                  <>
                     Marque {transactions.length}{" "}
                     {transactions.length === 1 ? "transação" : "transações"}{" "}
                     como transferência para outra conta.
                  </>
               ) : (
                  "Selecione a transação correspondente ou crie uma nova."
               )}
            </SheetDescription>
         </SheetHeader>

         {step === "select-account" ? (
            <>
               <div className="grid gap-4 px-4 py-4">
                  <FieldGroup>
                     <Field>
                        <FieldLabel>Conta de origem</FieldLabel>
                        <Select disabled value={sourceAccounts[0]?.id || ""}>
                           <SelectTrigger>
                              <SelectValue>
                                 {sourceAccounts.length === 1
                                    ? `${sourceAccounts[0]?.name} - ${sourceAccounts[0]?.bank}`
                                    : sourceAccounts.length > 1
                                      ? `${sourceAccounts.length} contas selecionadas`
                                      : "Nenhuma conta"}
                              </SelectValue>
                           </SelectTrigger>
                           <SelectContent>
                              {sourceAccounts.map((account) => (
                                 <SelectItem
                                    key={account.id}
                                    value={account.id}
                                 >
                                    {account.name} - {account.bank}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                  </FieldGroup>

                  <FieldGroup>
                     <Field>
                        <FieldLabel>Conta de Destino</FieldLabel>
                        <Combobox
                           emptyMessage="Nenhum resultado encontrado"
                           onValueChange={setSelectedBankAccountId}
                           options={bankAccountOptions}
                           placeholder="Selecione a conta de destino"
                           searchPlaceholder="Pesquisar"
                           value={selectedBankAccountId}
                        />
                     </Field>
                  </FieldGroup>
               </div>

               <SheetFooter className="px-4">
                  <Button
                     className="w-full"
                     disabled={!selectedBankAccountId || isLoadingCandidates}
                     onClick={handleSearchMatches}
                  >
                     {isLoadingCandidates ? (
                        <>
                           <Loader2 className="size-4 animate-spin" />
                           Buscando...
                        </>
                     ) : singleTransaction ? (
                        <>
                           <Search className="size-4" />
                           Buscar correspondência
                        </>
                     ) : (
                        "Confirmar"
                     )}
                  </Button>
               </SheetFooter>
            </>
         ) : (
            <>
               <div className="grid gap-4 px-4 py-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                     <div className="flex-1 text-sm">
                        <p className="font-medium">{sourceAccounts[0]?.name}</p>
                        <p className="text-muted-foreground text-xs">
                           {sourceAccounts[0]?.bank}
                        </p>
                     </div>
                     <ArrowRight className="size-4 text-muted-foreground" />
                     <div className="flex-1 text-sm text-right">
                        <p className="font-medium">
                           {destinationAccount?.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                           {destinationAccount?.bank}
                        </p>
                     </div>
                  </div>

                  <FieldGroup>
                     <Field>
                        <FieldLabel>
                           {hasAnyMatch
                              ? "Selecione a transação correspondente"
                              : "Nenhuma correspondência encontrada"}
                        </FieldLabel>

                        <RadioGroup
                           className="gap-3"
                           onValueChange={(value: string) =>
                              setSelectedMatch(value as MatchOption)
                           }
                           value={selectedMatch}
                        >
                           {candidates?.exactMatch && (
                              <label
                                 className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                                 data-state={
                                    selectedMatch ===
                                    candidates.exactMatch.transaction.id
                                       ? "checked"
                                       : "unchecked"
                                 }
                              >
                                 <RadioGroupItem
                                    className="mt-0.5"
                                    value={candidates.exactMatch.transaction.id}
                                 />
                                 <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                       <span className="font-medium text-sm truncate">
                                          {
                                             candidates.exactMatch.transaction
                                                .description
                                          }
                                       </span>
                                       <Badge
                                          className="shrink-0"
                                          variant="default"
                                       >
                                          {candidates.exactMatch.score}% match
                                       </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                       {formatDate(
                                          new Date(
                                             candidates.exactMatch.transaction
                                                .date,
                                          ),
                                          "DD/MM/YYYY",
                                       )}{" "}
                                       &bull;{" "}
                                       {formatDecimalCurrency(
                                          Math.abs(
                                             Number(
                                                candidates.exactMatch
                                                   .transaction.amount,
                                             ),
                                          ),
                                       )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                       {candidates.exactMatch.matchReason}
                                    </p>
                                 </div>
                              </label>
                           )}

                           {candidates?.fuzzyMatches?.map((match) => (
                              <label
                                 className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                                 data-state={
                                    selectedMatch === match.transaction.id
                                       ? "checked"
                                       : "unchecked"
                                 }
                                 key={match.transaction.id}
                              >
                                 <RadioGroupItem
                                    className="mt-0.5"
                                    value={match.transaction.id}
                                 />
                                 <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                       <span className="font-medium text-sm truncate">
                                          {match.transaction.description}
                                       </span>
                                       <Badge
                                          className="shrink-0"
                                          variant="secondary"
                                       >
                                          {match.score}% match
                                       </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                       {formatDate(
                                          new Date(match.transaction.date),
                                          "DD/MM/YYYY",
                                       )}{" "}
                                       &bull;{" "}
                                       {formatDecimalCurrency(
                                          Math.abs(
                                             Number(match.transaction.amount),
                                          ),
                                       )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                       {match.matchReason}
                                    </p>
                                 </div>
                              </label>
                           ))}

                           <label
                              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                              data-state={
                                 selectedMatch === "create"
                                    ? "checked"
                                    : "unchecked"
                              }
                           >
                              <RadioGroupItem
                                 className="mt-0.5"
                                 value="create"
                              />
                              <div className="flex-1">
                                 <span className="font-medium text-sm">
                                    Criar nova transação
                                 </span>
                                 <p className="text-xs text-muted-foreground mt-1">
                                    Uma nova transação será criada na conta{" "}
                                    {destinationAccount?.name}
                                 </p>
                              </div>
                           </label>
                        </RadioGroup>
                     </Field>
                  </FieldGroup>
               </div>

               <SheetFooter className="px-4 gap-2">
                  <Button
                     disabled={markAsTransferMutation.isPending}
                     onClick={handleBack}
                     variant="outline"
                  >
                     Voltar
                  </Button>
                  <Button
                     className="flex-1"
                     disabled={markAsTransferMutation.isPending}
                     onClick={handleConfirm}
                  >
                     {markAsTransferMutation.isPending ? (
                        <>
                           <Loader2 className="size-4 animate-spin" />
                           Salvando...
                        </>
                     ) : (
                        <>
                           <Check className="size-4" />
                           Confirmar
                        </>
                     )}
                  </Button>
               </SheetFooter>
            </>
         )}
      </>
   );
}
