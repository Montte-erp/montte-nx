import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";

export const rubiCatalog = defineCatalog(schema, {
   components: {
      Card: shadcnComponentDefinitions.Card,
      Stack: shadcnComponentDefinitions.Stack,
      Grid: shadcnComponentDefinitions.Grid,
      Separator: shadcnComponentDefinitions.Separator,
      Heading: shadcnComponentDefinitions.Heading,
      Text: shadcnComponentDefinitions.Text,
      Badge: shadcnComponentDefinitions.Badge,
      Alert: shadcnComponentDefinitions.Alert,
      Table: shadcnComponentDefinitions.Table,
      Accordion: shadcnComponentDefinitions.Accordion,
      Collapsible: shadcnComponentDefinitions.Collapsible,
      Tabs: shadcnComponentDefinitions.Tabs,
      Progress: shadcnComponentDefinitions.Progress,
      Skeleton: shadcnComponentDefinitions.Skeleton,
      Spinner: shadcnComponentDefinitions.Spinner,
      Avatar: shadcnComponentDefinitions.Avatar,
      Image: shadcnComponentDefinitions.Image,
      Link: shadcnComponentDefinitions.Link,
      Tooltip: shadcnComponentDefinitions.Tooltip,
   },
   actions: {},
});

export type RubiCatalog = typeof rubiCatalog;
