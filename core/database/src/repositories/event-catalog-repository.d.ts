import type { DatabaseInstance } from "@core/database/client";
export declare function listEventCatalog(db: DatabaseInstance): Promise<
   {
      id: string;
      eventName: string;
      category: string;
      pricePerEvent: string;
      freeTierLimit: number;
      displayName: string;
      description: string | null;
      isBillable: boolean;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
//# sourceMappingURL=event-catalog-repository.d.ts.map
