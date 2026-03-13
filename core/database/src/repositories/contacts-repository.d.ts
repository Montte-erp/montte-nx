import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateContactInput,
   type UpdateContactInput,
   type ContactType,
} from "@core/database/schemas/contacts";
export declare function createContact(
   db: DatabaseInstance,
   teamId: string,
   data: CreateContactInput,
): Promise<{
   createdAt: Date;
   document: string | null;
   documentType: "cnpj" | "cpf" | null;
   email: string | null;
   externalId: string | null;
   id: string;
   isArchived: boolean;
   name: string;
   notes: string | null;
   phone: string | null;
   source: "asaas" | "manual";
   teamId: string;
   type: "ambos" | "cliente" | "fornecedor";
   updatedAt: Date;
}>;
export declare function listContacts(
   db: DatabaseInstance,
   teamId: string,
   type?: ContactType,
   includeArchived?: boolean,
): Promise<
   {
      id: string;
      teamId: string;
      name: string;
      type: "ambos" | "cliente" | "fornecedor";
      email: string | null;
      phone: string | null;
      document: string | null;
      documentType: "cnpj" | "cpf" | null;
      notes: string | null;
      source: "asaas" | "manual";
      externalId: string | null;
      isArchived: boolean;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function getContact(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   type: "ambos" | "cliente" | "fornecedor";
   email: string | null;
   phone: string | null;
   document: string | null;
   documentType: "cnpj" | "cpf" | null;
   notes: string | null;
   source: "asaas" | "manual";
   externalId: string | null;
   isArchived: boolean;
   createdAt: Date;
   updatedAt: Date;
} | null>;
export declare function updateContact(
   db: DatabaseInstance,
   id: string,
   data: UpdateContactInput,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   type: "ambos" | "cliente" | "fornecedor";
   email: string | null;
   phone: string | null;
   document: string | null;
   documentType: "cnpj" | "cpf" | null;
   notes: string | null;
   source: "asaas" | "manual";
   externalId: string | null;
   isArchived: boolean;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function archiveContact(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   type: "ambos" | "cliente" | "fornecedor";
   email: string | null;
   phone: string | null;
   document: string | null;
   documentType: "cnpj" | "cpf" | null;
   notes: string | null;
   source: "asaas" | "manual";
   externalId: string | null;
   isArchived: boolean;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function reactivateContact(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   type: "ambos" | "cliente" | "fornecedor";
   email: string | null;
   phone: string | null;
   document: string | null;
   documentType: "cnpj" | "cpf" | null;
   notes: string | null;
   source: "asaas" | "manual";
   externalId: string | null;
   isArchived: boolean;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteContact(
   db: DatabaseInstance,
   id: string,
): Promise<void>;
export declare function ensureContactOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   type: "ambos" | "cliente" | "fornecedor";
   email: string | null;
   phone: string | null;
   document: string | null;
   documentType: "cnpj" | "cpf" | null;
   notes: string | null;
   source: "asaas" | "manual";
   externalId: string | null;
   isArchived: boolean;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function contactHasLinks(
   db: DatabaseInstance,
   id: string,
): Promise<boolean>;
//# sourceMappingURL=contacts-repository.d.ts.map
