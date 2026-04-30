/**
 * Helpers para construir specs json-render que os tools retornam.
 *
 * Spec format esperado pelo Renderer:
 *   { root: <key>, elements: { <key>: { type, props, children?: <keys[]> } } }
 *
 * Aqui montamos como árvore aninhada e `spec()` flatten pra esse formato.
 *
 * Catálogo disponível: Card, Stack, Grid, Separator, Heading, Text, Badge,
 * Alert, Table, Accordion, Collapsible, Tabs, Progress, Skeleton, Spinner,
 * Avatar, Image, Link, Tooltip.
 */

export interface SpecNode {
   type: string;
   props?: Record<string, unknown>;
   children?: SpecNode[];
}

export interface FlatElement {
   type: string;
   props: Record<string, unknown>;
   children?: string[];
}

export interface RenderSpec {
   root: string;
   elements: Record<string, FlatElement>;
}

function flatten(root: SpecNode): RenderSpec {
   const elements: Record<string, FlatElement> = {};
   let counter = 0;
   const nextKey = () => `el_${counter++}`;
   function visit(node: SpecNode): string {
      const key = nextKey();
      const childKeys = node.children
         ? node.children.map((c) => visit(c))
         : undefined;
      elements[key] = {
         type: node.type,
         props: node.props ?? {},
         ...(childKeys && childKeys.length > 0 && { children: childKeys }),
      };
      return key;
   }
   const rootKey = visit(root);
   return { root: rootKey, elements };
}

export function spec(root: SpecNode): RenderSpec {
   return flatten(root);
}

export function el(
   type: string,
   props?: Record<string, unknown>,
   children?: SpecNode[],
): SpecNode {
   return { type, props, children };
}

export const $ = {
   stack: (props: Record<string, unknown>, children: SpecNode[]) =>
      el("Stack", props, children),
   card: (props: Record<string, unknown>, children?: SpecNode[]) =>
      el("Card", props, children),
   heading: (text: string, level = 3) => el("Heading", { level, text }),
   text: (text: string, props: Record<string, unknown> = {}) =>
      el("Text", { ...props, text }),
   badge: (text: string, variant?: string) =>
      el("Badge", { variant, label: text }),
   alert: (
      title: string,
      description?: string,
      variant: "default" | "destructive" | "success" | "warning" = "default",
   ) => el("Alert", { title, description, variant }),
   separator: () => el("Separator"),
   table: (props: { columns: string[]; rows: string[][]; caption?: string }) =>
      el("Table", props),
};
