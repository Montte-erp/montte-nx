import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateServiceInput,
   type CreateVariantInput,
   type UpdateServiceInput,
   type UpdateVariantInput,
} from "@core/database/schemas/services";
export interface ListServicesFilters {
   search?: string;
   categoryId?: string;
}
export declare function createService(
   db: DatabaseInstance,
   teamId: string,
   data: CreateServiceInput,
): Promise<{
   basePrice: string;
   categoryId: string | null;
   createdAt: Date;
   description: string | null;
   id: string;
   isActive: boolean;
   name: string;
   tagId: string | null;
   teamId: string;
   updatedAt: Date;
}>;
export declare function listServices(
   db: DatabaseInstance,
   teamId: string,
   filters?: ListServicesFilters,
): Promise<
   {
      id: string;
      teamId: string;
      name: string;
      description: string | null;
      basePrice: string;
      categoryId: string | null;
      tagId: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      categoryName: string | null;
      categoryColor: string | null;
      tagName: string | null;
      tagColor: string | null;
   }[]
>;
export declare function getService(
   db: DatabaseInstance,
   id: string,
): Promise<{
   basePrice: string;
   categoryId: string | null;
   createdAt: Date;
   description: string | null;
   id: string;
   isActive: boolean;
   name: string;
   tagId: string | null;
   teamId: string;
   updatedAt: Date;
} | null>;
export declare function updateService(
   db: DatabaseInstance,
   id: string,
   data: UpdateServiceInput,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   description: string | null;
   basePrice: string;
   categoryId: string | null;
   tagId: string | null;
   isActive: boolean;
   createdAt: Date;
   updatedAt: Date;
} | null>;
export declare function deleteService(
   db: DatabaseInstance,
   id: string,
): Promise<void>;
export declare function createVariant(
   db: DatabaseInstance,
   teamId: string,
   serviceId: string,
   data: CreateVariantInput,
): Promise<{
   basePrice: string;
   billingCycle: "annual" | "hourly" | "monthly" | "one_time";
   createdAt: Date;
   id: string;
   isActive: boolean;
   name: string;
   serviceId: string;
   teamId: string;
   updatedAt: Date;
}>;
export declare function listVariantsByService(
   db: DatabaseInstance,
   serviceId: string,
): Promise<
   {
      id: string;
      serviceId: string;
      teamId: string;
      name: string;
      basePrice: string;
      billingCycle: "annual" | "hourly" | "monthly" | "one_time";
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function getVariant(
   db: DatabaseInstance,
   id: string,
): Promise<{
   basePrice: string;
   billingCycle: "annual" | "hourly" | "monthly" | "one_time";
   createdAt: Date;
   id: string;
   isActive: boolean;
   name: string;
   serviceId: string;
   teamId: string;
   updatedAt: Date;
} | null>;
export declare function updateVariant(
   db: DatabaseInstance,
   id: string,
   data: UpdateVariantInput,
): Promise<{
   id: string;
   serviceId: string;
   teamId: string;
   name: string;
   basePrice: string;
   billingCycle: "annual" | "hourly" | "monthly" | "one_time";
   isActive: boolean;
   createdAt: Date;
   updatedAt: Date;
} | null>;
export declare function deleteVariant(
   db: DatabaseInstance,
   id: string,
): Promise<void>;
export declare function ensureServiceOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   basePrice: string;
   categoryId: string | null;
   createdAt: Date;
   description: string | null;
   id: string;
   isActive: boolean;
   name: string;
   tagId: string | null;
   teamId: string;
   updatedAt: Date;
}>;
export declare function ensureVariantOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   basePrice: string;
   billingCycle: "annual" | "hourly" | "monthly" | "one_time";
   createdAt: Date;
   id: string;
   isActive: boolean;
   name: string;
   serviceId: string;
   teamId: string;
   updatedAt: Date;
}>;
//# sourceMappingURL=services-repository.d.ts.map
