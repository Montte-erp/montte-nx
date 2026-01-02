import type {
   EmailBlock,
   EmailStyles,
   EmailTemplate,
} from "@packages/transactional/schemas/email-builder.schema";
import { cn } from "@packages/ui/lib/utils";

type EmailPreviewProps = {
   template: EmailTemplate;
};

// Sample preview data
const PREVIEW_DATA: Record<string, string> = {
   "organization.name": "Minha Empresa",
   "user.name": "João Silva",
   "user.email": "joao@empresa.com",
   "date.today": new Date().toLocaleDateString("pt-BR"),
   "date.period": "Janeiro 2026",
   "bills.total": "R$ 1.234,56",
   "bills.count": "5",
   "bills.overdue_count": "1",
   "bills.pending_count": "4",
   "app.url": "https://app.exemplo.com",
};

const DEFAULT_STYLES: EmailStyles = {
   primaryColor: "#3b82f6",
   backgroundColor: "#f4f4f5",
   textColor: "#18181b",
   fontFamily: "sans-serif",
};

function processVariables(text: string): string {
   return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      return PREVIEW_DATA[key.trim()] ?? `{{${key}}}`;
   });
}

export function EmailPreview({ template }: EmailPreviewProps) {
   const styles: EmailStyles = { ...DEFAULT_STYLES, ...template.styles };

   return (
      <div
         className="p-6"
         style={{
            backgroundColor: styles.backgroundColor,
            fontFamily:
               styles.fontFamily === "serif"
                  ? "Georgia, serif"
                  : styles.fontFamily === "monospace"
                    ? "monospace"
                    : "system-ui, sans-serif",
         }}
      >
         <div
            className="mx-auto max-w-[600px] rounded-lg bg-white p-6 shadow-sm"
            style={{ color: styles.textColor }}
         >
            {template.blocks.map((block, index) => (
               <BlockPreview
                  block={block}
                  key={`preview-${index}`}
                  styles={styles}
               />
            ))}
         </div>
      </div>
   );
}

function BlockPreview({
   block,
   styles,
}: {
   block: EmailBlock;
   styles: EmailStyles;
}) {
   switch (block.type) {
      case "heading":
         return (
            <HeadingPreview
               align={block.align}
               level={block.level}
               text={processVariables(block.text)}
            />
         );
      case "text":
         return (
            <TextPreview
               align={block.align}
               content={processVariables(block.content)}
            />
         );
      case "button":
         return (
            <ButtonPreview
               align={block.align}
               primaryColor={styles.primaryColor}
               text={block.text}
               url={processVariables(block.url)}
               variant={block.variant}
            />
         );
      case "divider":
         return <hr className="my-4 border-gray-200" />;
      case "image":
         return (
            <ImagePreview
               align={block.align}
               alt={block.alt}
               src={block.src}
               width={block.width}
            />
         );
      case "spacer":
         return <div style={{ height: block.height }} />;
      case "table":
         return <TablePreview />;
      default:
         return null;
   }
}

function HeadingPreview({
   level,
   text,
   align,
}: {
   level: 1 | 2 | 3;
   text: string;
   align?: "left" | "center" | "right";
}) {
   const Tag = `h${level}` as "h1" | "h2" | "h3";
   const sizes = {
      1: "text-2xl font-bold",
      2: "text-xl font-semibold",
      3: "text-lg font-medium",
   };

   return (
      <Tag className={cn(sizes[level], "mb-2")} style={{ textAlign: align }}>
         {text}
      </Tag>
   );
}

function TextPreview({
   content,
   align,
}: {
   content: string;
   align?: "left" | "center" | "right";
}) {
   return (
      <p className="text-sm leading-relaxed mb-2" style={{ textAlign: align }}>
         {content}
      </p>
   );
}

function ButtonPreview({
   text,
   url,
   align,
   variant,
   primaryColor,
}: {
   text: string;
   url: string;
   align?: "left" | "center" | "right";
   variant?: "primary" | "secondary" | "outline";
   primaryColor?: string;
}) {
   const buttonStyles = {
      primary: {
         backgroundColor: primaryColor ?? "#3b82f6",
         color: "#ffffff",
         border: "none",
      },
      secondary: {
         backgroundColor: "#f4f4f5",
         color: "#18181b",
         border: "none",
      },
      outline: {
         backgroundColor: "transparent",
         color: primaryColor ?? "#3b82f6",
         border: `1px solid ${primaryColor ?? "#3b82f6"}`,
      },
   };

   return (
      <div className="my-4" style={{ textAlign: align }}>
         <a
            className="inline-block rounded-md px-6 py-2.5 text-sm font-medium no-underline"
            href={url || "#"}
            style={buttonStyles[variant ?? "primary"]}
         >
            {text}
         </a>
      </div>
   );
}

function ImagePreview({
   src,
   alt,
   width,
   align,
}: {
   src: string;
   alt: string;
   width?: number;
   align?: "left" | "center" | "right";
}) {
   if (!src) {
      return (
         <div
            className="my-4 flex h-32 items-center justify-center rounded bg-gray-100 text-gray-400"
            style={{
               width: width ?? "100%",
               marginLeft:
                  align === "center" ? "auto" : align === "right" ? "auto" : 0,
               marginRight:
                  align === "center" ? "auto" : align === "left" ? "auto" : 0,
            }}
         >
            [Imagem: {alt || "sem descrição"}]
         </div>
      );
   }

   return (
      <div className="my-4" style={{ textAlign: align }}>
         <img
            alt={alt}
            className="rounded"
            src={src}
            style={{ width: width ?? "auto", maxWidth: "100%" }}
         />
      </div>
   );
}

function TablePreview() {
   // Sample bills data for preview
   const sampleBills = [
      {
         description: "Aluguel",
         dueDate: "05/01/2026",
         amount: "R$ 2.500,00",
         status: "Pendente",
      },
      {
         description: "Internet",
         dueDate: "10/01/2026",
         amount: "R$ 150,00",
         status: "Pendente",
      },
      {
         description: "Energia",
         dueDate: "15/01/2026",
         amount: "R$ 280,00",
         status: "Vencida",
      },
   ];

   return (
      <div className="my-4 overflow-hidden rounded-lg border">
         <table className="w-full text-sm">
            <thead className="bg-gray-50">
               <tr>
                  <th className="px-4 py-2 text-left font-medium">Descrição</th>
                  <th className="px-4 py-2 text-left font-medium">
                     Vencimento
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Valor</th>
                  <th className="px-4 py-2 text-center font-medium">Status</th>
               </tr>
            </thead>
            <tbody>
               {sampleBills.map((bill, index) => (
                  <tr className="border-t" key={`bill-${index}`}>
                     <td className="px-4 py-2">{bill.description}</td>
                     <td className="px-4 py-2">{bill.dueDate}</td>
                     <td className="px-4 py-2 text-right">{bill.amount}</td>
                     <td className="px-4 py-2 text-center">
                        <span
                           className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-xs",
                              bill.status === "Vencida"
                                 ? "bg-red-100 text-red-700"
                                 : "bg-amber-100 text-amber-700",
                           )}
                        >
                           {bill.status}
                        </span>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
}
