import { Img, Section, Text } from "@react-email/components";

export function MontteEmailHeading() {
   return (
      <Section
         style={{
            background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
            backgroundColor: "#16A34A",
            padding: "32px 24px",
            textAlign: "center",
         }}
      >
         <Img
            alt="Montte"
            height="48"
            src="https://app.montte.co/logo.png"
            style={{
               display: "block",
               margin: "0 auto 12px",
            }}
            width="48"
         />
         <Text
            style={{
               color: "#ffffff",
               fontSize: "28px",
               fontWeight: 700,
               letterSpacing: "0",
               lineHeight: "34px",
               margin: 0,
            }}
         >
            Montte
         </Text>
      </Section>
   );
}

export function MontteEmailFooter() {
   return (
      <Section
         style={{
            backgroundColor: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
            padding: "24px",
            textAlign: "center",
         }}
      >
         <Text
            style={{
               color: "#6b7280",
               fontSize: "12px",
               lineHeight: "18px",
               margin: 0,
            }}
         >
            Esta mensagem foi enviada pelo Montte.
         </Text>
      </Section>
   );
}
