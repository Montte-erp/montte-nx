import { Button, Section, Text } from "@react-email/components";
import { MontteEmailLayout } from "@core/notifications/emails/layout";
import {
   MontteEmailFooter,
   MontteEmailHeading,
} from "@core/notifications/emails/partials";

export interface MagicLinkEmailProps {
   magicLinkUrl: string;
}

export function MagicLinkEmail({ magicLinkUrl }: MagicLinkEmailProps) {
   return (
      <MontteEmailLayout preview="Seu link de acesso Montte">
         <MontteEmailHeading />
         <Section style={{ padding: "32px 24px", textAlign: "center" }}>
            <Text
               style={{
                  color: "#1a1a2e",
                  fontSize: "22px",
                  fontWeight: 600,
                  lineHeight: "28px",
                  margin: "0 0 8px 0",
               }}
            >
               Link de Acesso
            </Text>
            <Text
               style={{
                  color: "#6b7280",
                  fontSize: "15px",
                  lineHeight: "24px",
                  margin: "0 0 24px 0",
               }}
            >
               Clique no botão abaixo para acessar sua conta. Este link expira
               em 15 minutos.
            </Text>
            <Button
               href={magicLinkUrl}
               style={{
                  backgroundColor: "#22C55E",
                  borderRadius: "8px",
                  color: "#ffffff",
                  display: "inline-block",
                  fontSize: "16px",
                  fontWeight: 600,
                  padding: "12px 32px",
                  textDecoration: "none",
               }}
            >
               Acessar Conta
            </Button>
            <Text
               style={{
                  color: "#9ca3af",
                  fontSize: "13px",
                  lineHeight: "20px",
                  margin: "24px 0 0 0",
               }}
            >
               Se você não solicitou este link, ignore este e-mail.
            </Text>
         </Section>
         <MontteEmailFooter />
      </MontteEmailLayout>
   );
}
