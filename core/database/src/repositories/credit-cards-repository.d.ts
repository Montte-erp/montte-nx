import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateCreditCardInput,
   type UpdateCreditCardInput,
} from "@core/database/schemas/credit-cards";
export declare function createCreditCard(
   db: DatabaseInstance,
   teamId: string,
   data: CreateCreditCardInput,
): Promise<{
   bankAccountId: string;
   brand: "amex" | "elo" | "hipercard" | "mastercard" | "other" | "visa" | null;
   closingDay: number;
   color: string;
   createdAt: Date;
   creditLimit: string;
   dueDay: number;
   iconUrl: string | null;
   id: string;
   name: string;
   status: "active" | "blocked" | "cancelled";
   teamId: string;
   updatedAt: Date;
}>;
export declare function listCreditCards(
   db: DatabaseInstance,
   teamId: string,
): Promise<
   {
      bankAccountId: string;
      brand:
         | "amex"
         | "elo"
         | "hipercard"
         | "mastercard"
         | "other"
         | "visa"
         | null;
      closingDay: number;
      color: string;
      createdAt: Date;
      creditLimit: string;
      dueDay: number;
      iconUrl: string | null;
      id: string;
      name: string;
      status: "active" | "blocked" | "cancelled";
      teamId: string;
      updatedAt: Date;
   }[]
>;
export declare function getCreditCard(
   db: DatabaseInstance,
   id: string,
): Promise<{
   bankAccountId: string;
   brand: "amex" | "elo" | "hipercard" | "mastercard" | "other" | "visa" | null;
   closingDay: number;
   color: string;
   createdAt: Date;
   creditLimit: string;
   dueDay: number;
   iconUrl: string | null;
   id: string;
   name: string;
   status: "active" | "blocked" | "cancelled";
   teamId: string;
   updatedAt: Date;
} | null>;
export declare function updateCreditCard(
   db: DatabaseInstance,
   id: string,
   data: UpdateCreditCardInput,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   color: string;
   iconUrl: string | null;
   creditLimit: string;
   closingDay: number;
   dueDay: number;
   bankAccountId: string;
   status: "active" | "blocked" | "cancelled";
   brand: "amex" | "elo" | "hipercard" | "mastercard" | "other" | "visa" | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteCreditCard(
   db: DatabaseInstance,
   id: string,
): Promise<void>;
export declare function ensureCreditCardOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   bankAccountId: string;
   brand: "amex" | "elo" | "hipercard" | "mastercard" | "other" | "visa" | null;
   closingDay: number;
   color: string;
   createdAt: Date;
   creditLimit: string;
   dueDay: number;
   iconUrl: string | null;
   id: string;
   name: string;
   status: "active" | "blocked" | "cancelled";
   teamId: string;
   updatedAt: Date;
}>;
export declare function creditCardHasOpenStatements(
   db: DatabaseInstance,
   creditCardId: string,
): Promise<boolean>;
//# sourceMappingURL=credit-cards-repository.d.ts.map
