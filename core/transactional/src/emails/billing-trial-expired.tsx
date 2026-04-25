import { Hr, Section, Text } from "@react-email/components";
import { DefaultFooter } from "@core/transactional/emails/default-footer";
import { DefaultHeading } from "@core/transactional/emails/default-heading";
import { DefaultEmailLayout } from "@core/transactional/emails/default-layout";

interface BillingTrialExpiredEmailProps {
   contactName?: string;
}

export default function BillingTrialExpiredEmail({
   contactName,
}: BillingTrialExpiredEmailProps) {
   return (
      <DefaultEmailLayout preview="Seu período de teste encerrou — assinatura ativa">
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
               Período de teste encerrado
            </Text>
            <Text
               style={{
                  color: "#6b7280",
                  fontSize: "15px",
                  lineHeight: "24px",
                  margin: "0 0 24px 0",
               }}
            >
               {contactName ? `Olá, ${contactName}!` : "Olá!"} Seu período de
               teste chegou ao fim.
            </Text>
            <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 24px 0" }} />
            <Section
               style={{
                  backgroundColor: "#f0fdf4",
                  borderRadius: "8px",
                  padding: "16px",
               }}
            >
               <Text
                  style={{
                     color: "#166534",
                     fontSize: "15px",
                     fontWeight: 600,
                     margin: 0,
                  }}
               >
                  ✓ Sua assinatura está ativa
               </Text>
               <Text
                  style={{
                     color: "#166534",
                     fontSize: "13px",
                     lineHeight: "20px",
                     margin: "4px 0 0 0",
                  }}
               >
                  Você continua com acesso a todos os recursos contratados. A
                  cobrança será realizada normalmente no próximo ciclo.
               </Text>
            </Section>
         </Section>
         <DefaultFooter />
      </DefaultEmailLayout>
   );
}

BillingTrialExpiredEmail.PreviewProps = {
   contactName: "Maria",
} satisfies BillingTrialExpiredEmailProps;
