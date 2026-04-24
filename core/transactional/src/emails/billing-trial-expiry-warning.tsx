import { Hr, Section, Text } from "@react-email/components";
import { DefaultFooter } from "@core/transactional/emails/default-footer";
import { DefaultHeading } from "@core/transactional/emails/default-heading";
import { DefaultEmailLayout } from "@core/transactional/emails/default-layout";

interface BillingTrialExpiryWarningEmailProps {
   contactName?: string;
   trialEndsAt: string;
}

export default function BillingTrialExpiryWarningEmail({
   contactName,
   trialEndsAt,
}: BillingTrialExpiryWarningEmailProps) {
   return (
      <DefaultEmailLayout preview="Seu período de teste expira em 3 dias">
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
               Seu período de teste expira em 3 dias
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
               teste encerrará em <strong>3 dias</strong>.
            </Text>
            <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 24px 0" }} />
            <Text
               style={{
                  color: "#1a1a2e",
                  fontSize: "15px",
                  margin: "0 0 4px 0",
               }}
            >
               Data de encerramento: <strong>{trialEndsAt}</strong>
            </Text>
            <Text
               style={{
                  color: "#9ca3af",
                  fontSize: "13px",
                  lineHeight: "20px",
                  margin: "16px 0 0 0",
               }}
            >
               Após essa data, sua assinatura será ativada automaticamente e
               você continuará tendo acesso a todos os recursos contratados.
            </Text>
         </Section>
         <DefaultFooter />
      </DefaultEmailLayout>
   );
}

BillingTrialExpiryWarningEmail.PreviewProps = {
   contactName: "Maria",
   trialEndsAt: "30/04/2025",
} satisfies BillingTrialExpiryWarningEmailProps;
