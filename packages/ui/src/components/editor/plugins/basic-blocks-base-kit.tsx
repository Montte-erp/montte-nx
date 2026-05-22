import {
   BaseBlockquotePlugin,
   BaseH1Plugin,
   BaseH2Plugin,
   BaseH3Plugin,
   BaseH4Plugin,
   BaseH5Plugin,
   BaseH6Plugin,
   BaseHorizontalRulePlugin,
} from "@platejs/basic-nodes";
import { BaseParagraphPlugin } from "platejs";

import { BlockquoteElement } from "@packages/ui/components/blockquote-node";
import {
   H1Element,
   H2Element,
   H3Element,
   H4Element,
   H5Element,
   H6Element,
} from "@packages/ui/components/heading-node";
import { HrElement } from "@packages/ui/components/hr-node";
import { ParagraphElement } from "@packages/ui/components/paragraph-node";

export const BaseBasicBlocksKit = [
   BaseParagraphPlugin.withComponent(ParagraphElement),
   BaseH1Plugin.withComponent(H1Element),
   BaseH2Plugin.withComponent(H2Element),
   BaseH3Plugin.withComponent(H3Element),
   BaseH4Plugin.withComponent(H4Element),
   BaseH5Plugin.withComponent(H5Element),
   BaseH6Plugin.withComponent(H6Element),
   BaseBlockquotePlugin.withComponent(BlockquoteElement),
   BaseHorizontalRulePlugin.withComponent(HrElement),
];
