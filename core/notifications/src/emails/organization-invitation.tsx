import { Button, Section, Text } from "@react-email/components";
import { MontteEmailLayout } from "@core/notifications/emails/layout";
import {
   MontteEmailFooter,
   MontteEmailHeading,
} from "@core/notifications/emails/partials";

export interface OrganizationInvitationEmailProps {
   invitedByUsername: string;
   invitedByEmail: string;
   teamName: string;
   inviteLink: string;
}

export function OrganizationInvitationEmail({
   invitedByUsername,
   invitedByEmail,
   teamName,
   inviteLink,
}: OrganizationInvitationEmailProps) {
   return (
      <MontteEmailLayout
         preview={`${invitedByUsername} convidou você para ${teamName}`}
      >
         <MontteEmailHeading />
         <Section style={{ padding: "32px 24px", textAlign: "center" }}>
            <Text
               style={{
                  color: "#1a1a2e",
                  fontSize: "24px",
                  fontWeight: 700,
                  lineHeight: "32px",
                  margin: "0 0 16px 0",
               }}
            >
               Você recebeu um convite!
            </Text>
            <Text
               style={{
                  color: "#374151",
                  fontSize: "16px",
                  lineHeight: "26px",
                  margin: "0 0 24px 0",
               }}
            >
               <strong style={{ color: "#1a1a2e" }}>{invitedByUsername}</strong>{" "}
               está convidando você para colaborar na organização{" "}
               <strong style={{ color: "#1a1a2e" }}>{teamName}</strong> no
               Montte.
            </Text>
            <Section
               style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  margin: "0 0 28px 0",
                  padding: "24px",
               }}
            >
               <Text
                  style={{
                     color: "#475569",
                     fontSize: "14px",
                     fontWeight: 600,
                     lineHeight: "22px",
                     margin: "0 0 8px 0",
                  }}
               >
                  O que você poderá fazer:
               </Text>
               <Text
                  style={{
                     color: "#64748b",
                     fontSize: "14px",
                     lineHeight: "24px",
                     margin: "0 0 20px 0",
                     textAlign: "left",
                  }}
               >
                  - Gerenciar financeiro, vendas e operações
                  <br />- Usar assistentes de IA integrados
                  <br />- Colaborar com sua equipe em tempo real
               </Text>
               <Button
                  href={inviteLink}
                  style={{
                     backgroundColor: "#22C55E",
                     borderRadius: "8px",
                     color: "#ffffff",
                     display: "inline-block",
                     fontSize: "16px",
                     fontWeight: 600,
                     padding: "14px 36px",
                     textDecoration: "none",
                  }}
               >
                  Aceitar convite
               </Button>
            </Section>
            <Text
               style={{
                  color: "#94a3b8",
                  fontSize: "13px",
                  lineHeight: "20px",
                  margin: "0 0 8px 0",
               }}
            >
               Convite enviado por {invitedByEmail}
            </Text>
            <Text
               style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  lineHeight: "18px",
                  margin: 0,
               }}
            >
               Se você não conhece esta pessoa ou não esperava este convite,
               pode ignorar este e-mail com segurança.
            </Text>
         </Section>
         <MontteEmailFooter />
      </MontteEmailLayout>
   );
}
