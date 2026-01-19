import { MarkdownPreview } from "./markdown-preview";

type TextCardConfig = {
   type: "text_card";
   content: string;
};

type TextCardWidgetProps = {
   config: TextCardConfig;
   onEdit?: () => void;
};

export function TextCardWidget({ config, onEdit }: TextCardWidgetProps) {
   return (
      <div
         className="h-full overflow-auto cursor-pointer hover:bg-muted/30 transition-colors rounded p-2 -m-2"
         onClick={onEdit}
      >
         <MarkdownPreview content={config.content} />
      </div>
   );
}
