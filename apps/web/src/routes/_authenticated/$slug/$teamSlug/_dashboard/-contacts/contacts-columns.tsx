import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { ArrowUpDown, Mail, Phone, Type } from "lucide-react";
import { z } from "zod";
import { InlineEditSelect } from "@/blocks/data-table/inline-edit/inline-edit-select";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";

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

const TYPE_OPTIONS = [
   { value: "cliente", label: "Cliente" },
   { value: "fornecedor", label: "Fornecedor" },
   { value: "ambos", label: "Ambos" },
];

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
            editMode: "inline",
            bulkEditIcon: Type,
            bulkEditAction: "Renomear",
            required: true,
         },
         cell: ({ row }) => {
            if (!onUpdate) {
               return slugs ? (
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
               );
            }
            return (
               <InlineEditText
                  ariaLabel="Nome"
                  onSave={async (value) => {
                     const next = value.trim();
                     if (!next) return;
                     await onUpdate(row.original.id, { name: next });
                  }}
                  value={row.original.name}
               />
            );
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         meta: {
            label: "Tipo",
            cellComponent: "select" as const,
            editOptions: TYPE_OPTIONS,
            editSchema: z.enum(["cliente", "fornecedor", "ambos"]),
            isEditable: !!onUpdate,
            editMode: "inline",
            bulkEditIcon: ArrowUpDown,
            bulkEditAction: "Alterar tipo",
         },
         cell: ({ row }) => (
            <InlineEditSelect
               ariaLabel="Tipo"
               onSave={async (value) => {
                  await onUpdate?.(row.original.id, { type: value });
               }}
               options={TYPE_OPTIONS}
               value={row.original.type}
            />
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
            editMode: "inline",
            bulkEditIcon: Mail,
            bulkEditAction: "Alterar email",
         },
         cell: ({ row }) => (
            <InlineEditText
               ariaLabel="Email"
               onSave={async (value) => {
                  await onUpdate?.(row.original.id, {
                     email: value.trim() || null,
                  });
               }}
               placeholder="—"
               value={row.original.email ?? ""}
            />
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
            editMode: "inline",
            bulkEditIcon: Phone,
            bulkEditAction: "Alterar telefone",
         },
         cell: ({ row }) => (
            <InlineEditText
               ariaLabel="Telefone"
               onSave={async (value) => {
                  await onUpdate?.(row.original.id, {
                     phone: value.trim() || null,
                  });
               }}
               placeholder="—"
               value={row.original.phone ?? ""}
            />
         ),
      },
   ];
}
