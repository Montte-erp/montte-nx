import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { z } from "zod";

export type ContactRow = {
   id: string;
   name: string;
   type: "cliente" | "fornecedor" | "ambos";
   email: string | null;
   phone: string | null;
   document: string | null;
   documentType: "cpf" | "cnpj" | null;
   notes: string | null;
};

const TYPE_LABELS: Record<ContactRow["type"], string> = {
   cliente: "Cliente",
   fornecedor: "Fornecedor",
   ambos: "Ambos",
};

const TYPE_VARIANTS: Record<
   ContactRow["type"],
   "default" | "secondary" | "outline"
> = {
   cliente: "default",
   fornecedor: "secondary",
   ambos: "outline",
};

export function buildContactColumns(
   slugs?: { slug: string; teamSlug: string },
   onUpdate?: (id: string, patch: Record<string, unknown>) => Promise<void>,
): ColumnDef<ContactRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            cellComponent: "text" as const,
            editSchema: z.string().min(2, "Nome é obrigatório."),
            isEditable: !!onUpdate,
            onSave: onUpdate
               ? async (rowId, value) => {
                    await onUpdate(rowId, { name: value });
                 }
               : undefined,
         },
         cell: ({ row }) =>
            slugs ? (
               <Link
                  className="font-medium hover:underline"
                  params={{
                     slug: slugs.slug,
                     teamSlug: slugs.teamSlug,
                     contactId: row.original.id,
                  }}
                  to="/$slug/$teamSlug/contacts/$contactId"
               >
                  {row.original.name}
               </Link>
            ) : (
               <span className="font-medium">{row.original.name}</span>
            ),
      },
      {
         accessorKey: "type",
         header: "Tipo",
         meta: {
            label: "Tipo",
            cellComponent: "select" as const,
            editOptions: [
               { value: "cliente", label: "Cliente" },
               { value: "fornecedor", label: "Fornecedor" },
               { value: "ambos", label: "Ambos" },
            ],
            editSchema: z.enum(["cliente", "fornecedor", "ambos"]),
            isEditable: !!onUpdate,
            onSave: onUpdate
               ? async (rowId, value) => {
                    await onUpdate(rowId, { type: value });
                 }
               : undefined,
         },
         cell: ({ row }) => (
            <Badge variant={TYPE_VARIANTS[row.original.type]}>
               {TYPE_LABELS[row.original.type]}
            </Badge>
         ),
      },
      {
         accessorKey: "document",
         header: "Documento",
         meta: {
            label: "Documento",
         },
         cell: ({ row }) => {
            const { document, documentType } = row.original;
            if (!document)
               return <span className="text-muted-foreground">—</span>;
            return (
               <span className="text-sm">
                  {documentType?.toUpperCase()} {document}
               </span>
            );
         },
      },
      {
         accessorKey: "email",
         header: "Email",
         meta: {
            label: "Email",
            cellComponent: "text" as const,
            editSchema: z
               .string()
               .email("Email inválido.")
               .nullable()
               .optional(),
            isEditable: !!onUpdate,
            onSave: onUpdate
               ? async (rowId, value) => {
                    await onUpdate(rowId, {
                       email: value === "" ? null : value,
                    });
                 }
               : undefined,
         },
         cell: ({ row }) =>
            row.original.email ? (
               <span className="text-sm">{row.original.email}</span>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
      {
         accessorKey: "phone",
         header: "Telefone",
         meta: {
            label: "Telefone",
            cellComponent: "text" as const,
            editSchema: z.string().nullable().optional(),
            isEditable: !!onUpdate,
            onSave: onUpdate
               ? async (rowId, value) => {
                    await onUpdate(rowId, {
                       phone: value === "" ? null : value,
                    });
                 }
               : undefined,
         },
         cell: ({ row }) =>
            row.original.phone ? (
               <span className="text-sm">{row.original.phone}</span>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
   ];
}
