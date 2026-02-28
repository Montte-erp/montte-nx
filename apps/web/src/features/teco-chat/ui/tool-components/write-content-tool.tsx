import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { EditorTool } from "./editor-tool";

type WriteContentArgs = { markdown: string };
type WriteContentResult = { success: boolean };

export const WriteContentToolUI = makeAssistantToolUI<
  WriteContentArgs,
  WriteContentResult
>({
  toolName: "write-content",
  render: (props: ToolCallMessagePartProps<WriteContentArgs, WriteContentResult>) => {
    return <EditorTool {...(props as ToolCallMessagePartProps<any, any>)} />;
  },
});
