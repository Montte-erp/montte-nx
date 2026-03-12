import {
   createMoney,
   type Money,
   parseDecimalToMinorUnits,
} from "@f-o-t/money";
import type { DatabaseInstance } from "@core/database/client";
import { eventCatalog } from "@core/database/schemas/event-catalog";
import { getLogger } from "@core/logging/root";
import { eq } from "drizzle-orm";

const logger = getLogger().child({ module: "events:utils" });
const PRICE_SCALE = 6;
const CURRENCY = "BRL";

export async function getEventPrice(
   db: DatabaseInstance,
   eventName: string,
): Promise<{ price: Money; isBillable: boolean }> {
   const [catalogEntry] = await db
      .select({
         pricePerEvent: eventCatalog.pricePerEvent,
         isBillable: eventCatalog.isBillable,
      })
      .from(eventCatalog)
      .where(eq(eventCatalog.eventName, eventName))
      .limit(1);

   if (!catalogEntry) {
      logger.warn(
         { eventName },
         "Event not found in catalog, defaulting to $0",
      );
      return {
         price: createMoney(0n, CURRENCY, PRICE_SCALE),
         isBillable: false,
      };
   }

   return {
      price: createMoney(
         parseDecimalToMinorUnits(catalogEntry.pricePerEvent, PRICE_SCALE),
         CURRENCY,
         PRICE_SCALE,
      ),
      isBillable: catalogEntry.isBillable,
   };
}

export async function getEventMetadata(
   db: DatabaseInstance,
   eventName: string,
) {
   const [catalogEntry] = await db
      .select()
      .from(eventCatalog)
      .where(eq(eventCatalog.eventName, eventName))
      .limit(1);

   return catalogEntry || null;
}
