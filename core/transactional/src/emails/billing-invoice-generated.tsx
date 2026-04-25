import { Hr, Section, Text } from "@react-email/components";
import { DefaultFooter } from "@core/transactional/emails/default-footer";
import { DefaultHeading } from "@core/transactional/emails/default-heading";
import { DefaultEmailLayout } from "@core/transactional/emails/default-layout";

interface BillingInvoiceGeneratedEmailProps {
   contactName?: string;
   invoiceId: string;
   periodStart: string;
   periodEnd: string;
   total: string;
}

export default function BillingInvoiceGeneratedEmail({
   contactName,
   invoiceId,
   periodStart,
   periodEnd,
   total,
}: BillingInvoiceGeneratedEmailProps) {
   return (
      <DefaultEmailLayout
         preview={`Sua fatura de ${periodStart} a ${periodEnd} está disponível — R$ ${total}`}
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
               Sua fatura está disponível
            </Text>
            <Text
               style={{
                  color: "#6b7280",
                  fontSize: "15px",
                  lineHeight: "24px",
                  margin: "0 0 24px 0",
               }}
            >
               {contactName ? `Olá, ${contactName}!` : "Olá!"} Sua fatura
               referente ao período{" "}
               <strong>
                  {periodStart} a {periodEnd}
               </strong>{" "}
               foi gerada.
            </Text>
            <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 24px 0" }} />
            <Text
               style={{
                  color: "#1a1a2e",
                  fontSize: "13px",
                  margin: "0 0 4px 0",
               }}
            >
               Número da fatura: <strong>{invoiceId}</strong>
            </Text>
            <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
            <Text
               style={{
                  color: "#1a1a2e",
                  fontSize: "18px",
                  fontWeight: 700,
                  margin: 0,
               }}
            >
               Total: R$ {total}
            </Text>
            <Text
               style={{
                  color: "#9ca3af",
                  fontSize: "13px",
                  lineHeight: "20px",
                  margin: "16px 0 0 0",
               }}
            >
               Em caso de dúvidas sobre sua fatura, entre em contato com o
               suporte.
            </Text>
         </Section>
         <DefaultFooter />
      </DefaultEmailLayout>
   );
}

BillingInvoiceGeneratedEmail.PreviewProps = {
   contactName: "Maria",
   invoiceId: "inv_01HXYZ",
   periodStart: "01/04/2025",
   periodEnd: "30/04/2025",
   total: "1.500,00",
} satisfies BillingInvoiceGeneratedEmailProps;
