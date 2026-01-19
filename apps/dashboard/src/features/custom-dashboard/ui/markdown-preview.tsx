import { parse, renderToHtml } from "@f-o-t/markdown";
import { useMemo } from "react";

type MarkdownPreviewProps = {
   content: string;
   className?: string;
};

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
   const html = useMemo(() => {
      if (!content.trim()) {
         return "";
      }

      try {
         const doc = parse(content);
         return renderToHtml(doc, {
            externalLinksNewTab: true,
            sanitizeHtml: true,
         });
      } catch {
         return `<p>${content}</p>`;
      }
   }, [content]);

   if (!html) {
      return (
         <p className="text-muted-foreground italic">
            Nenhum conteudo para visualizar
         </p>
      );
   }

   return (
      <div
         className={`prose prose-sm dark:prose-invert max-w-none ${className ?? ""}`}
         // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown rendered from user content, sanitized by @f-o-t/markdown
         dangerouslySetInnerHTML={{ __html: html }}
      />
   );
}
