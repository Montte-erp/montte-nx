import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateTagInput,
   type UpdateTagInput,
} from "@core/database/schemas/tags";
export declare function createTag(
   db: DatabaseInstance,
   teamId: string,
   data: CreateTagInput,
): Promise<{
   color: string;
   createdAt: Date;
   description: string | null;
   id: string;
   isArchived: boolean;
   name: string;
   teamId: string;
   updatedAt: Date;
}>;
export declare function listTags(
   db: DatabaseInstance,
   teamId: string,
   opts?: {
      includeArchived?: boolean;
   },
): Promise<
   {
      color: string;
      createdAt: Date;
      description: string | null;
      id: string;
      isArchived: boolean;
      name: string;
      teamId: string;
      updatedAt: Date;
   }[]
>;
export declare function getTag(
   db: DatabaseInstance,
   id: string,
): Promise<{
   color: string;
   createdAt: Date;
   description: string | null;
   id: string;
   isArchived: boolean;
   name: string;
   teamId: string;
   updatedAt: Date;
} | null>;
export declare function updateTag(
   db: DatabaseInstance,
   id: string,
   data: UpdateTagInput,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   color: string;
   description: string | null;
   isArchived: boolean;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function archiveTag(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   color: string;
   description: string | null;
   isArchived: boolean;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function reactivateTag(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   color: string;
   description: string | null;
   isArchived: boolean;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteTag(
   db: DatabaseInstance,
   id: string,
): Promise<void>;
export declare function ensureTagOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   color: string;
   createdAt: Date;
   description: string | null;
   id: string;
   isArchived: boolean;
   name: string;
   teamId: string;
   updatedAt: Date;
}>;
export declare function tagHasTransactions(
   db: DatabaseInstance,
   tagId: string,
): Promise<boolean>;
//# sourceMappingURL=tags-repository.d.ts.map
