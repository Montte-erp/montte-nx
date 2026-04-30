import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { rubiCatalog } from "./catalog";

export const { registry: rubiRegistry } = defineRegistry(rubiCatalog, {
   components: {
      Card: shadcnComponents.Card,
      Stack: shadcnComponents.Stack,
      Grid: shadcnComponents.Grid,
      Separator: shadcnComponents.Separator,
      Heading: shadcnComponents.Heading,
      Text: shadcnComponents.Text,
      Badge: shadcnComponents.Badge,
      Alert: shadcnComponents.Alert,
      Table: shadcnComponents.Table,
      Accordion: shadcnComponents.Accordion,
      Collapsible: shadcnComponents.Collapsible,
      Tabs: shadcnComponents.Tabs,
      Progress: shadcnComponents.Progress,
      Skeleton: shadcnComponents.Skeleton,
      Spinner: shadcnComponents.Spinner,
      Avatar: shadcnComponents.Avatar,
      Image: shadcnComponents.Image,
      Link: shadcnComponents.Link,
      Tooltip: shadcnComponents.Tooltip,
   },
});
