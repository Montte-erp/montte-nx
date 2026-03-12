import { Section, Text } from "@react-email/components";
import { DefaultFooter } from "@core/transactional/emails/default-footer";
import { DefaultHeading } from "@core/transactional/emails/default-heading";
import { DefaultEmailLayout } from "@core/transactional/emails/default-layout";

interface BudgetAlertEmailProps {
   categoryName: string;
   spentAmount: string;
   limitAmount: string;
   percentUsed: number;
   alertThreshold: number;
   month: string;
}

export default function BudgetAlertEmail({
   categoryName,
   spentAmount,
   limitAmount,
   percentUsed,
   alertThreshold,
   month,
}: BudgetAlertEmailProps) {
   return (
      <DefaultEmailLayout
         preview={`Alerta de meta: ${categoryName} atingiu ${percentUsed}% do limite`}
      >
         <DefaultHeading />
         <Section style={{ padding: "32px 24px" }}>
            <Text
               style={{
                  color: "#1a1a2e",
                  fontSize: "22px",
                  fontWeight: 600,
                  margin: "0 0 8px 0",
               }}
            >
               Alerta de Meta de Gastos
            </Text>
            <Text
               style={{
                  color: "#6b7280",
                  fontSize: "15px",
                  lineHeight: "24px",
                  margin: "0 0 16px 0",
               }}
            >
               A meta da categoria <strong>{categoryName}</strong> atingiu{" "}
               <strong>{percentUsed}%</strong> do limite em {month}.
            </Text>
            <Text
               style={{
                  color: "#1a1a2e",
                  fontSize: "15px",
                  margin: "0 0 4px 0",
               }}
            >
               Gasto atual: <strong>{spentAmount}</strong>
            </Text>
            <Text
               style={{
                  color: "#1a1a2e",
                  fontSize: "15px",
                  margin: "0 0 4px 0",
               }}
            >
               Limite definido: <strong>{limitAmount}</strong>
            </Text>
            <Text
               style={{
                  color: "#9ca3af",
                  fontSize: "13px",
                  margin: "16px 0 0 0",
               }}
            >
               Você definiu um alerta para quando os gastos atingissem{" "}
               {alertThreshold}% do limite.
            </Text>
         </Section>
         <DefaultFooter />
      </DefaultEmailLayout>
   );
}

BudgetAlertEmail.PreviewProps = {
   categoryName: "Alimentação",
   spentAmount: "R$ 1.200,00",
   limitAmount: "R$ 1.500,00",
   percentUsed: 80,
   alertThreshold: 80,
   month: "Março 2025",
} satisfies BudgetAlertEmailProps;
