// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildTagColumns } from "@/routes/_authenticated/$slug/$teamSlug/_dashboard/-tags/tags-columns";

describe("buildTagColumns", () => {
   it("returns an array with the name column", () => {
      const columns = buildTagColumns();
      expect(columns).toHaveLength(1);
      expect(columns[0]!.accessorKey).toBe("name");
   });

   it("renders name with color dot", () => {
      const columns = buildTagColumns();
      const nameCol = columns[0]!;
      const CellComponent = nameCol.cell as (props: { row: { original: { id: string; name: string; color: string; description: string | null } } }) => React.ReactNode;

      const { container } = render(
         CellComponent({
            row: {
               original: {
                  id: "1",
                  name: "Marketing",
                  color: "#6366f1",
                  description: null,
               },
            },
         }) as React.ReactElement,
      );

      expect(screen.getByText("Marketing")).toBeDefined();
      const dot = container.querySelector("span[style]");
      expect(dot?.getAttribute("style")).toMatch(/99.*102.*241|#6366f1/i);
   });

   it("renders description when present", () => {
      const columns = buildTagColumns();
      const nameCol = columns[0]!;
      const CellComponent = nameCol.cell as (props: { row: { original: { id: string; name: string; color: string; description: string | null } } }) => React.ReactNode;

      render(
         CellComponent({
            row: {
               original: {
                  id: "2",
                  name: "Vendas",
                  color: "#ff0000",
                  description: "Departamento de vendas",
               },
            },
         }) as React.ReactElement,
      );

      expect(screen.getByText("Vendas")).toBeDefined();
      expect(screen.getByText("Departamento de vendas")).toBeDefined();
   });

   it("does not render description when null", () => {
      const columns = buildTagColumns();
      const nameCol = columns[0]!;
      const CellComponent = nameCol.cell as (props: { row: { original: { id: string; name: string; color: string; description: string | null } } }) => React.ReactNode;

      const { container } = render(
         CellComponent({
            row: {
               original: {
                  id: "3",
                  name: "RH",
                  color: "#00ff00",
                  description: null,
               },
            },
         }) as React.ReactElement,
      );

      expect(container.querySelector(".font-medium")?.textContent).toBe("RH");
      expect(container.querySelector(".text-muted-foreground")).toBeNull();
   });
});
