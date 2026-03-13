import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateCategoryInput,
   type UpdateCategoryInput,
} from "@core/database/schemas/categories";
export declare const DEFAULT_CATEGORIES: Array<{
   name: string;
   type: "income" | "expense";
}>;
export declare function createCategory(
   db: DatabaseInstance,
   teamId: string,
   data: CreateCategoryInput,
): Promise<{
   color: string | null;
   createdAt: Date;
   description: string | null;
   dreGroupId: string | null;
   icon: string | null;
   id: string;
   isArchived: boolean;
   isDefault: boolean;
   keywords: string[] | null;
   level: number;
   name: string;
   notes: string | null;
   parentId: string | null;
   participatesDre: boolean;
   teamId: string;
   type: "expense" | "income";
   updatedAt: Date;
}>;
export declare function seedDefaultCategories(
   db: DatabaseInstance,
   teamId: string,
): Promise<void>;
export declare function listCategories(
   db: DatabaseInstance,
   teamId: string,
   opts?: {
      type?: "income" | "expense";
      includeArchived?: boolean;
   },
): Promise<
   {
      color: string | null;
      createdAt: Date;
      description: string | null;
      dreGroupId: string | null;
      icon: string | null;
      id: string;
      isArchived: boolean;
      isDefault: boolean;
      keywords: string[] | null;
      level: number;
      name: string;
      notes: string | null;
      parentId: string | null;
      participatesDre: boolean;
      teamId: string;
      type: "expense" | "income";
      updatedAt: Date;
   }[]
>;
export declare function ensureCategoryOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   color: string | null;
   createdAt: Date;
   description: string | null;
   dreGroupId: string | null;
   icon: string | null;
   id: string;
   isArchived: boolean;
   isDefault: boolean;
   keywords: string[] | null;
   level: number;
   name: string;
   notes: string | null;
   parentId: string | null;
   participatesDre: boolean;
   teamId: string;
   type: "expense" | "income";
   updatedAt: Date;
}>;
export declare function getCategory(
   db: DatabaseInstance,
   id: string,
): Promise<{
   color: string | null;
   createdAt: Date;
   description: string | null;
   dreGroupId: string | null;
   icon: string | null;
   id: string;
   isArchived: boolean;
   isDefault: boolean;
   keywords: string[] | null;
   level: number;
   name: string;
   notes: string | null;
   parentId: string | null;
   participatesDre: boolean;
   teamId: string;
   type: "expense" | "income";
   updatedAt: Date;
} | null>;
export declare function updateCategory(
   db: DatabaseInstance,
   id: string,
   data: UpdateCategoryInput,
): Promise<{
   id: string;
   teamId: string;
   parentId: string | null;
   name: string;
   type: "expense" | "income";
   level: number;
   description: string | null;
   isDefault: boolean;
   color: string | null;
   icon: string | null;
   isArchived: boolean;
   keywords: string[] | null;
   notes: string | null;
   participatesDre: boolean;
   dreGroupId: string | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function archiveCategory(
   db: DatabaseInstance,
   id: string,
): Promise<
   | {
        color: string | null;
        createdAt: Date;
        description: string | null;
        dreGroupId: string | null;
        icon: string | null;
        id: string;
        isArchived: boolean;
        isDefault: boolean;
        keywords: string[] | null;
        level: number;
        name: string;
        notes: string | null;
        parentId: string | null;
        participatesDre: boolean;
        teamId: string;
        type: "expense" | "income";
        updatedAt: Date;
     }
   | undefined
>;
export declare function reactivateCategory(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   parentId: string | null;
   name: string;
   type: "expense" | "income";
   level: number;
   description: string | null;
   isDefault: boolean;
   color: string | null;
   icon: string | null;
   isArchived: boolean;
   keywords: string[] | null;
   notes: string | null;
   participatesDre: boolean;
   dreGroupId: string | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteCategory(
   db: DatabaseInstance,
   id: string,
): Promise<void>;
export declare function categoryTreeHasTransactions(
   db: DatabaseInstance,
   categoryId: string,
): Promise<boolean>;
export declare function validateKeywordsUniqueness(
   db: DatabaseInstance,
   teamId: string,
   keywords: string[],
   excludeCategoryId?: string,
): Promise<void>;
//# sourceMappingURL=categories-repository.d.ts.map
