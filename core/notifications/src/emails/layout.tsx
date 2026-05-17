import {
   Body,
   Container,
   Font,
   Head,
   Html,
   Preview,
   Tailwind,
} from "@react-email/components";
import type { ReactNode } from "react";

interface MontteEmailLayoutProps {
   children: ReactNode;
   preview?: string;
}

export function MontteEmailLayout({
   children,
   preview,
}: MontteEmailLayoutProps) {
   return (
      <Tailwind
         config={{
            theme: {
               extend: {
                  colors: {
                     background: "#f5f7f6",
                     border: "#e5e7eb",
                     card: "#ffffff",
                     foreground: "#1a1a2e",
                     muted: "#6b7280",
                     primary: {
                        DEFAULT: "#22C55E",
                        dark: "#166534",
                        light: "#86EFAC",
                     },
                  },
                  borderRadius: {
                     DEFAULT: "0.8rem",
                  },
               },
            },
         }}
      >
         <Html>
            <Head>
               <Font
                  fallbackFontFamily="Arial"
                  fontFamily="Montserrat"
                  fontStyle="normal"
                  fontWeight={400}
                  webFont={{
                     format: "woff2",
                     url: "https://app.montte.co/email/montserrat-regular.woff2",
                  }}
               />
            </Head>
            {preview && <Preview>{preview}</Preview>}
            <Body
               style={{
                  backgroundColor: "#f5f7f6",
                  fontFamily: "Montserrat, Arial, sans-serif",
                  margin: 0,
                  padding: 0,
               }}
            >
               <Container
                  style={{
                     backgroundColor: "#ffffff",
                     borderRadius: "12px",
                     boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                     margin: "40px auto",
                     maxWidth: "520px",
                     overflow: "hidden",
                  }}
               >
                  {children}
               </Container>
            </Body>
         </Html>
      </Tailwind>
   );
}
