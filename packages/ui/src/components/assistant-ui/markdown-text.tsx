"use client";

import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import { useClipboard } from "foxact/use-clipboard";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { FC } from "react";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownTextProps {
   content: string;
   className?: string;
}

const CodeHeader: FC<{ language: string | undefined; code: string }> = ({
   language,
   code,
}) => {
   const { copied: isCopied, copy: copyToClipboard } = useClipboard({
      timeout: 3000,
   });
   const onCopy = () => {
      if (!code || isCopied) return;
      copyToClipboard(code);
   };
   return (
      <div className="aui-code-header-root mt-2.5 flex items-center justify-between rounded-t-lg border border-b-0 border-border/50 bg-muted/50 px-3 py-1.5 text-xs">
         <span className="aui-code-header-language font-medium lowercase text-muted-foreground">
            {language ?? "code"}
         </span>
         <Button
            className="aui-button-icon size-6 p-1"
            onClick={onCopy}
            tooltip="Copiar"
            variant="outline"
         >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
         </Button>
      </div>
   );
};

const components: React.ComponentProps<typeof ReactMarkdown>["components"] = {
   h1: ({ className, ...props }) => (
      <h1
         className={cn(
            "aui-md-h1 mb-2 scroll-m-20 text-base font-semibold first:mt-0 last:mb-0",
            className,
         )}
         {...props}
      />
   ),
   h2: ({ className, ...props }) => (
      <h2
         className={cn(
            "aui-md-h2 mb-1.5 mt-3 scroll-m-20 text-sm font-semibold first:mt-0 last:mb-0",
            className,
         )}
         {...props}
      />
   ),
   h3: ({ className, ...props }) => (
      <h3
         className={cn(
            "aui-md-h3 mb-1 mt-2.5 scroll-m-20 text-sm font-semibold first:mt-0 last:mb-0",
            className,
         )}
         {...props}
      />
   ),
   h4: ({ className, ...props }) => (
      <h4
         className={cn(
            "aui-md-h4 mb-1 mt-2 scroll-m-20 text-sm font-medium first:mt-0 last:mb-0",
            className,
         )}
         {...props}
      />
   ),
   p: ({ className, ...props }) => (
      <p
         className={cn(
            "aui-md-p my-2.5 leading-normal first:mt-0 last:mb-0",
            className,
         )}
         {...props}
      />
   ),
   a: ({ className, ...props }) => (
      <a
         className={cn(
            "aui-md-a text-primary underline underline-offset-2 hover:text-primary/80",
            className,
         )}
         {...props}
      />
   ),
   blockquote: ({ className, ...props }) => (
      <blockquote
         className={cn(
            "aui-md-blockquote my-2.5 border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground",
            className,
         )}
         {...props}
      />
   ),
   ul: ({ className, ...props }) => (
      <ul
         className={cn(
            "aui-md-ul my-2 ml-4 list-disc marker:text-muted-foreground [&>li]:mt-1",
            className,
         )}
         {...props}
      />
   ),
   ol: ({ className, ...props }) => (
      <ol
         className={cn(
            "aui-md-ol my-2 ml-4 list-decimal marker:text-muted-foreground [&>li]:mt-1",
            className,
         )}
         {...props}
      />
   ),
   li: ({ className, ...props }) => (
      <li className={cn("aui-md-li leading-normal", className)} {...props} />
   ),
   hr: ({ className, ...props }) => (
      <hr
         className={cn("aui-md-hr my-2 border-muted-foreground/20", className)}
         {...props}
      />
   ),
   table: ({ className, ...props }) => (
      <table
         className={cn(
            "aui-md-table my-2 w-full border-separate border-spacing-0 overflow-y-auto",
            className,
         )}
         {...props}
      />
   ),
   th: ({ className, ...props }) => (
      <th
         className={cn(
            "aui-md-th bg-muted px-2 py-1 text-left font-medium first:rounded-tl-lg last:rounded-tr-lg [[align=center]]:text-center [[align=right]]:text-right",
            className,
         )}
         {...props}
      />
   ),
   td: ({ className, ...props }) => (
      <td
         className={cn(
            "aui-md-td border-b border-l border-muted-foreground/20 px-2 py-1 text-left last:border-r [[align=center]]:text-center [[align=right]]:text-right",
            className,
         )}
         {...props}
      />
   ),
   tr: ({ className, ...props }) => (
      <tr
         className={cn(
            "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg",
            className,
         )}
         {...props}
      />
   ),
   pre: ({ children }) => {
      const codeEl = children as React.ReactElement<{
         className?: string;
         children?: string;
      }>;
      const codeClass = codeEl?.props?.className ?? "";
      const language = codeClass.replace("language-", "") || undefined;
      const code =
         typeof codeEl?.props?.children === "string"
            ? codeEl.props.children
            : "";
      return (
         <div>
            <CodeHeader code={code} language={language} />
            <pre className="aui-md-pre overflow-x-auto rounded-b-lg rounded-t-none border border-t-0 border-border/50 bg-muted/30 p-3 text-xs leading-relaxed">
               {children}
            </pre>
         </div>
      );
   },
   code: ({ className, children, ...props }) => {
      const isBlock = Boolean(className?.startsWith("language-"));
      if (isBlock) {
         return (
            <code className={className} {...props}>
               {children}
            </code>
         );
      }
      return (
         <code
            className={cn(
               "aui-md-inline-code rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[0.85em]",
               className,
            )}
            {...props}
         >
            {children}
         </code>
      );
   },
};

const MarkdownTextImpl: FC<MarkdownTextProps> = ({ content, className }) => (
   <div className={cn("aui-md text-sm leading-relaxed", className)}>
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
         {content}
      </ReactMarkdown>
   </div>
);

export const MarkdownText = memo(MarkdownTextImpl);
