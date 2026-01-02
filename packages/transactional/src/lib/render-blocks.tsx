import {
   Body,
   Button,
   Container,
   Head,
   Heading,
   Hr,
   Html,
   Img,
   Preview,
   Section,
   Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import type {
   EmailBlock,
   EmailStyles,
   EmailTemplate,
} from "../schemas/email-builder.schema";

type RenderContext = {
   data: Record<string, unknown>;
   styles: EmailStyles;
};

/**
 * Processes template variables in text
 * e.g., "Hello {{user.name}}" -> "Hello João"
 */
function processTemplate(text: string, data: Record<string, unknown>): string {
   return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const value = getNestedValue(data, key.trim());
      return value != null ? String(value) : `{{${key}}}`;
   });
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
   return path.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in acc) {
         return (acc as Record<string, unknown>)[part];
      }
      return undefined;
   }, obj);
}

/**
 * Renders a single email block to React Email component
 */
function renderBlock(
   block: EmailBlock,
   index: number,
   ctx: RenderContext,
): React.ReactNode {
   switch (block.type) {
      case "heading": {
         const fontSize =
            block.level === 1 ? "24px" : block.level === 2 ? "20px" : "16px";
         return (
            <Heading
               as={`h${block.level}` as "h1" | "h2" | "h3"}
               key={`block-${index}`}
               style={{
                  color: ctx.styles.textColor ?? "#18181b",
                  fontSize,
                  fontWeight: 600,
                  margin: "0 0 16px 0",
                  textAlign: block.align ?? "left",
               }}
            >
               {processTemplate(block.text, ctx.data)}
            </Heading>
         );
      }

      case "text":
         return (
            <Text
               key={`block-${index}`}
               style={{
                  color: ctx.styles.textColor ?? "#18181b",
                  fontSize: "14px",
                  lineHeight: "22px",
                  margin: "0 0 12px 0",
                  textAlign: block.align ?? "left",
               }}
            >
               {processTemplate(block.content, ctx.data)}
            </Text>
         );

      case "button": {
         const buttonStyles = {
            primary: {
               backgroundColor: ctx.styles.primaryColor ?? "#3b82f6",
               color: "#ffffff",
            },
            secondary: {
               backgroundColor: "#f4f4f5",
               color: "#18181b",
            },
            outline: {
               backgroundColor: "transparent",
               color: ctx.styles.primaryColor ?? "#3b82f6",
               border: `1px solid ${ctx.styles.primaryColor ?? "#3b82f6"}`,
            },
         };
         const variant = block.variant ?? "primary";

         return (
            <Section
               key={`block-${index}`}
               style={{
                  textAlign: block.align ?? "center",
                  margin: "16px 0",
               }}
            >
               <Button
                  href={processTemplate(block.url, ctx.data)}
                  style={{
                     ...buttonStyles[variant],
                     borderRadius: "6px",
                     display: "inline-block",
                     fontSize: "14px",
                     fontWeight: 600,
                     padding: "12px 24px",
                     textDecoration: "none",
                  }}
               >
                  {processTemplate(block.text, ctx.data)}
               </Button>
            </Section>
         );
      }

      case "divider":
         return (
            <Hr
               key={`block-${index}`}
               style={{
                  borderColor: "#e5e7eb",
                  margin: "16px 0",
               }}
            />
         );

      case "image":
         return (
            <Section
               key={`block-${index}`}
               style={{ textAlign: block.align ?? "center" }}
            >
               <Img
                  alt={block.alt}
                  src={block.src}
                  style={{
                     borderRadius: "4px",
                     maxWidth: "100%",
                  }}
                  width={block.width}
               />
            </Section>
         );

      case "spacer":
         return (
            <Section key={`block-${index}`} style={{ height: block.height }} />
         );

      case "table": {
         // Render bills table from data - use billsData to avoid conflict with bills template variables
         const bills =
            (ctx.data.billsData as Array<{
               description: string;
               amount: string;
               dueDate: string;
               type: "expense" | "income";
               isOverdue: boolean;
            }>) ?? [];

         if (bills.length === 0) {
            return (
               <Text
                  key={`block-${index}`}
                  style={{
                     color: "#6b7280",
                     fontSize: "14px",
                     textAlign: "center",
                     margin: "16px 0",
                  }}
               >
                  Nenhuma conta encontrada
               </Text>
            );
         }

         return (
            <Section key={`block-${index}`} style={{ margin: "16px 0" }}>
               <table
                  cellPadding="0"
                  cellSpacing="0"
                  style={{
                     width: "100%",
                     borderCollapse: "collapse",
                  }}
               >
                  <thead>
                     <tr style={{ backgroundColor: "#f9fafb" }}>
                        <th
                           style={{
                              borderBottom: "1px solid #e5e7eb",
                              color: "#6b7280",
                              fontSize: "12px",
                              fontWeight: 600,
                              padding: "8px 12px",
                              textAlign: "left",
                           }}
                        >
                           Descrição
                        </th>
                        <th
                           style={{
                              borderBottom: "1px solid #e5e7eb",
                              color: "#6b7280",
                              fontSize: "12px",
                              fontWeight: 600,
                              padding: "8px 12px",
                              textAlign: "left",
                           }}
                        >
                           Vencimento
                        </th>
                        <th
                           style={{
                              borderBottom: "1px solid #e5e7eb",
                              color: "#6b7280",
                              fontSize: "12px",
                              fontWeight: 600,
                              padding: "8px 12px",
                              textAlign: "right",
                           }}
                        >
                           Valor
                        </th>
                     </tr>
                  </thead>
                  <tbody>
                     {bills.map((bill, i) => (
                        <tr key={`bill-${i}`}>
                           <td
                              style={{
                                 borderBottom: "1px solid #e5e7eb",
                                 color: ctx.styles.textColor ?? "#18181b",
                                 fontSize: "13px",
                                 padding: "10px 12px",
                              }}
                           >
                              {bill.description}
                           </td>
                           <td
                              style={{
                                 borderBottom: "1px solid #e5e7eb",
                                 color: bill.isOverdue ? "#dc2626" : "#6b7280",
                                 fontSize: "13px",
                                 padding: "10px 12px",
                              }}
                           >
                              {bill.dueDate}
                              {bill.isOverdue && " (vencida)"}
                           </td>
                           <td
                              style={{
                                 borderBottom: "1px solid #e5e7eb",
                                 color:
                                    bill.type === "expense"
                                       ? "#dc2626"
                                       : "#42B46E",
                                 fontSize: "13px",
                                 fontWeight: 600,
                                 padding: "10px 12px",
                                 textAlign: "right",
                              }}
                           >
                              {bill.type === "expense" ? "-" : "+"}
                              {bill.amount}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </Section>
         );
      }

      default:
         return null;
   }
}

/**
 * Builds a complete email from template and data
 */
function EmailFromBlocks({
   template,
   data,
   subject,
}: {
   template: EmailTemplate;
   data: Record<string, unknown>;
   subject?: string;
}) {
   const defaultStyles: EmailStyles = {
      primaryColor: "#3b82f6",
      backgroundColor: "#f4f4f5",
      textColor: "#18181b",
      fontFamily: "sans-serif",
   };
   const styles: EmailStyles = { ...defaultStyles, ...template.styles };
   const ctx: RenderContext = { data, styles };

   const fontFamily =
      styles.fontFamily === "serif"
         ? "Georgia, serif"
         : styles.fontFamily === "monospace"
           ? "Menlo, monospace"
           : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

   return (
      <Html>
         <Head />
         {subject && <Preview>{subject}</Preview>}
         <Body
            style={{
               backgroundColor: styles.backgroundColor,
               fontFamily,
               margin: 0,
               padding: "40px 0",
            }}
         >
            <Container
               style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
                  margin: "0 auto",
                  maxWidth: "600px",
                  padding: "32px",
               }}
            >
               {template.blocks.map((block, index) =>
                  renderBlock(block, index, ctx),
               )}
            </Container>
         </Body>
      </Html>
   );
}

/**
 * Renders an email template to HTML string
 */
export async function renderEmailBlocks(
   template: EmailTemplate,
   data: Record<string, unknown>,
   subject?: string,
): Promise<string> {
   return render(
      <EmailFromBlocks data={data} subject={subject} template={template} />,
   );
}

/**
 * Helper to process a subject line with template variables
 */
export function processSubject(
   subject: string,
   data: Record<string, unknown>,
): string {
   return processTemplate(subject, data);
}
