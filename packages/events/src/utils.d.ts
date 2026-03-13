import { type Money } from "@f-o-t/money";
import type { DatabaseInstance } from "@core/database/client";
export declare function getEventPrice(
   db: DatabaseInstance,
   eventName: string,
): Promise<{
   price: Money;
   isBillable: boolean;
}>;
export declare function getEventMetadata(
   db: DatabaseInstance,
   eventName: string,
): Promise<{
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
} | null>;
//# sourceMappingURL=utils.d.ts.map
