import {
   BaseBoldPlugin,
   BaseCodePlugin,
   BaseHighlightPlugin,
   BaseItalicPlugin,
   BaseKbdPlugin,
   BaseStrikethroughPlugin,
   BaseSubscriptPlugin,
   BaseSuperscriptPlugin,
   BaseUnderlinePlugin,
} from "@platejs/basic-nodes";

import { CodeLeaf } from "@packages/ui/components/code-node";
import { HighlightLeaf } from "@packages/ui/components/highlight-node";
import { KbdLeaf } from "@packages/ui/components/kbd-node";

export const BaseBasicMarksKit = [
   BaseBoldPlugin,
   BaseItalicPlugin,
   BaseUnderlinePlugin,
   BaseCodePlugin.withComponent(CodeLeaf),
   BaseStrikethroughPlugin,
   BaseSubscriptPlugin,
   BaseSuperscriptPlugin,
   BaseHighlightPlugin.withComponent(HighlightLeaf),
   BaseKbdPlugin.withComponent(KbdLeaf),
];
