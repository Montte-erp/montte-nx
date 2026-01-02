import { Button, Section, Text } from "@react-email/components";
import { DefaultFooter } from "./default-footer";
import { DefaultHeading } from "./default-heading";
import { DefaultEmailLayout } from "./default-layout";

export type BillDigestItem = {
   description: string;
   amount: string;
   dueDate: string;
   type: "expense" | "income";
   isOverdue: boolean;
};

export type BillsDigestSummary = {
   totalPending: number;
   totalOverdue: number;
   totalExpenseAmount: string;
   totalIncomeAmount: string;
};

export interface BillsDigestEmailProps {
   userName: string;
   organizationName: string;
   period: string;
   summary: BillsDigestSummary;
   bills: BillDigestItem[];
   dashboardUrl: string;
   detailLevel: "summary" | "detailed" | "full";
}

export default function BillsDigestEmail({
   userName,
   organizationName,
   period,
   summary,
   bills,
   dashboardUrl,
   detailLevel,
}: BillsDigestEmailProps) {
   const hasOverdue = summary.totalOverdue > 0;
   const showBillsList = detailLevel !== "summary" && bills.length > 0;

   return (
      <DefaultEmailLayout preview={`Resumo de contas - ${period}`}>
         <DefaultHeading />

         <Section style={{ padding: "32px 24px" }}>
            {/* Greeting */}
            <Text
               style={{
                  color: "#1a1a2e",
                  fontSize: "16px",
                  lineHeight: "24px",
                  margin: "0 0 8px 0",
               }}
            >
               Ola, {userName}!
            </Text>
            <Text
               style={{
                  color: "#6b7280",
                  fontSize: "14px",
                  lineHeight: "22px",
                  margin: "0 0 24px 0",
               }}
            >
               Aqui esta o resumo de contas de{" "}
               <strong style={{ color: "#1a1a2e" }}>{organizationName}</strong>{" "}
               para {period}.
            </Text>

            {/* Summary Card */}
            <div
               style={{
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  padding: "20px",
                  marginBottom: "24px",
               }}
            >
               <Text
                  style={{
                     color: "#1a1a2e",
                     fontSize: "14px",
                     fontWeight: 600,
                     margin: "0 0 16px 0",
                     textTransform: "uppercase",
                     letterSpacing: "0.5px",
                  }}
               >
                  Resumo
               </Text>

               <table cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
                  <tr>
                     <td style={{ paddingBottom: "12px" }}>
                        <Text
                           style={{
                              color: "#6b7280",
                              fontSize: "13px",
                              margin: 0,
                           }}
                        >
                           Contas pendentes
                        </Text>
                        <Text
                           style={{
                              color: "#1a1a2e",
                              fontSize: "20px",
                              fontWeight: 600,
                              margin: "4px 0 0 0",
                           }}
                        >
                           {summary.totalPending}
                        </Text>
                     </td>
                     <td style={{ paddingBottom: "12px", textAlign: "right" }}>
                        <Text
                           style={{
                              color: "#6b7280",
                              fontSize: "13px",
                              margin: 0,
                           }}
                        >
                           Contas vencidas
                        </Text>
                        <Text
                           style={{
                              color: hasOverdue ? "#dc2626" : "#1a1a2e",
                              fontSize: "20px",
                              fontWeight: 600,
                              margin: "4px 0 0 0",
                           }}
                        >
                           {summary.totalOverdue}
                        </Text>
                     </td>
                  </tr>
                  <tr>
                     <td>
                        <Text
                           style={{
                              color: "#6b7280",
                              fontSize: "13px",
                              margin: 0,
                           }}
                        >
                           Total a pagar
                        </Text>
                        <Text
                           style={{
                              color: "#dc2626",
                              fontSize: "18px",
                              fontWeight: 600,
                              margin: "4px 0 0 0",
                           }}
                        >
                           {summary.totalExpenseAmount}
                        </Text>
                     </td>
                     <td style={{ textAlign: "right" }}>
                        <Text
                           style={{
                              color: "#6b7280",
                              fontSize: "13px",
                              margin: 0,
                           }}
                        >
                           Total a receber
                        </Text>
                        <Text
                           style={{
                              color: "#42B46E",
                              fontSize: "18px",
                              fontWeight: 600,
                              margin: "4px 0 0 0",
                           }}
                        >
                           {summary.totalIncomeAmount}
                        </Text>
                     </td>
                  </tr>
               </table>
            </div>

            {/* Bills List (if detailed or full) */}
            {showBillsList && (
               <>
                  <Text
                     style={{
                        color: "#1a1a2e",
                        fontSize: "14px",
                        fontWeight: 600,
                        margin: "0 0 12px 0",
                     }}
                  >
                     Proximas contas
                  </Text>
                  <table
                     cellPadding="0"
                     cellSpacing="0"
                     style={{
                        width: "100%",
                        marginBottom: "24px",
                     }}
                  >
                     {bills.map((bill, index) => (
                        <tr
                           key={`bill-${index + 1}`}
                           style={{
                              borderBottom:
                                 index < bills.length - 1
                                    ? "1px solid #e5e7eb"
                                    : undefined,
                           }}
                        >
                           <td style={{ padding: "12px 0" }}>
                              <Text
                                 style={{
                                    color: "#1a1a2e",
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    margin: 0,
                                 }}
                              >
                                 {bill.description}
                              </Text>
                              {detailLevel === "full" && (
                                 <Text
                                    style={{
                                       color: bill.isOverdue
                                          ? "#dc2626"
                                          : "#6b7280",
                                       fontSize: "12px",
                                       margin: "4px 0 0 0",
                                    }}
                                 >
                                    Vencimento: {bill.dueDate}
                                    {bill.isOverdue && " (vencida)"}
                                 </Text>
                              )}
                           </td>
                           <td
                              style={{ padding: "12px 0", textAlign: "right" }}
                           >
                              <Text
                                 style={{
                                    color:
                                       bill.type === "expense"
                                          ? "#dc2626"
                                          : "#42B46E",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    margin: 0,
                                 }}
                              >
                                 {bill.type === "expense" ? "-" : "+"}
                                 {bill.amount}
                              </Text>
                           </td>
                        </tr>
                     ))}
                  </table>
               </>
            )}

            {/* CTA Button */}
            <Button
               href={dashboardUrl}
               style={{
                  backgroundColor: "#42B46E",
                  borderRadius: "8px",
                  color: "#ffffff",
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "12px 24px",
                  textAlign: "center",
                  textDecoration: "none",
                  width: "100%",
               }}
            >
               Ver no Dashboard
            </Button>
         </Section>

         <DefaultFooter />
      </DefaultEmailLayout>
   );
}

BillsDigestEmail.PreviewProps = {
   userName: "Joao",
   organizationName: "Empresa ABC",
   period: "esta semana",
   summary: {
      totalPending: 5,
      totalOverdue: 2,
      totalExpenseAmount: "R$ 1.500,00",
      totalIncomeAmount: "R$ 3.200,00",
   },
   bills: [
      {
         description: "Aluguel do escritorio",
         amount: "R$ 800,00",
         dueDate: "15/01/2025",
         type: "expense",
         isOverdue: true,
      },
      {
         description: "Conta de luz",
         amount: "R$ 250,00",
         dueDate: "20/01/2025",
         type: "expense",
         isOverdue: false,
      },
      {
         description: "Fatura cliente XYZ",
         amount: "R$ 3.200,00",
         dueDate: "22/01/2025",
         type: "income",
         isOverdue: false,
      },
   ],
   dashboardUrl: "https://app.montte.co/empresa-abc/bills",
   detailLevel: "full",
} satisfies BillsDigestEmailProps;
