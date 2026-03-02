import { Button, Section, Text } from "@react-email/components";

import { DefaultFooter } from "./default-footer";
import { DefaultHeading } from "./default-heading";
import { DefaultEmailLayout } from "./default-layout";

interface VerificationEmailProps {
   verificationUrl: string;
   type: "email-verification" | "change-email";
}

const content = {
   "email-verification": {
      title: "Confirme seu e-mail",
      description:
         "Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta.",
      buttonText: "Confirmar e-mail",
      footer: "Se você não criou uma conta, ignore este e-mail.",
      preview: "Confirme seu e-mail no Montte",
   },
   "change-email": {
      title: "Confirme a troca de e-mail",
      description:
         "Clique no botão abaixo para confirmar seu novo endereço de e-mail.",
      buttonText: "Confirmar novo e-mail",
      footer: "Se você não solicitou a troca de e-mail, ignore este e-mail.",
      preview: "Confirme a troca de e-mail no Montte",
   },
};

export default function VerificationEmail({
   verificationUrl,
   type,
}: VerificationEmailProps) {
   const { title, description, buttonText, footer, preview } = content[type];

   return (
      <DefaultEmailLayout preview={preview}>
         <DefaultHeading />
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
               {title}
            </Text>
            <Text
               style={{
                  color: "#6b7280",
                  fontSize: "15px",
                  lineHeight: "24px",
                  margin: "0 0 24px 0",
               }}
            >
               {description}
            </Text>
            <Button
               href={verificationUrl}
               style={{
                  backgroundColor: "#C4704A",
                  borderRadius: "8px",
                  color: "#ffffff",
                  display: "inline-block",
                  fontSize: "16px",
                  fontWeight: 600,
                  padding: "12px 32px",
                  textDecoration: "none",
               }}
            >
               {buttonText}
            </Button>
            <Text
               style={{
                  color: "#9ca3af",
                  fontSize: "13px",
                  lineHeight: "20px",
                  margin: "24px 0 0 0",
               }}
            >
               {footer}
            </Text>
         </Section>
         <DefaultFooter />
      </DefaultEmailLayout>
   );
}

VerificationEmail.PreviewProps = {
   verificationUrl:
      "https://app.montte.co/api/auth/verify-email?token=abc123&callbackURL=/",
   type: "email-verification",
} satisfies VerificationEmailProps;
