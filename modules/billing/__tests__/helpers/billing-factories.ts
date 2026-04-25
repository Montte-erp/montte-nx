import dayjs from "dayjs";
import type { DatabaseInstance } from "@core/database/client";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { contacts } from "@core/database/schemas/contacts";
import { coupons } from "@core/database/schemas/coupons";
import { meters } from "@core/database/schemas/meters";
import { servicePrices, services } from "@core/database/schemas/services";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import {
   type SubscriptionStatus,
   contactSubscriptions,
} from "@core/database/schemas/subscriptions";
import { usageEvents } from "@core/database/schemas/usage-events";

export async function makeContact(
   db: DatabaseInstance,
   opts: { teamId: string; name?: string },
) {
   const [row] = await db
      .insert(contacts)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? `Contato ${crypto.randomUUID()}`,
         type: "cliente",
      })
      .returning();
   if (!row) throw new Error("makeContact: insert returned no row");
   return row;
}

export async function makeService(
   db: DatabaseInstance,
   opts: { teamId: string; name?: string },
) {
   const [row] = await db
      .insert(services)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? `Serviço ${crypto.randomUUID()}`,
      })
      .returning();
   if (!row) throw new Error("makeService: insert returned no row");
   return row;
}

export async function makeMeter(
   db: DatabaseInstance,
   opts: { teamId: string; eventName?: string; name?: string },
) {
   const [row] = await db
      .insert(meters)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? "Medidor",
         eventName: opts.eventName ?? `event.${crypto.randomUUID()}`,
         aggregation: "sum",
      })
      .returning();
   if (!row) throw new Error("makeMeter: insert returned no row");
   return row;
}

export async function makePrice(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      serviceId: string;
      type?: "flat" | "per_unit" | "metered";
      basePrice?: string;
      interval?: "hourly" | "monthly" | "annual" | "one_time";
      meterId?: string | null;
      priceCap?: string | null;
      name?: string;
      isActive?: boolean;
   },
) {
   const [row] = await db
      .insert(servicePrices)
      .values({
         teamId: opts.teamId,
         serviceId: opts.serviceId,
         name: opts.name ?? "Preço padrão",
         type: opts.type ?? "flat",
         basePrice: opts.basePrice ?? "100.00",
         interval: opts.interval ?? "monthly",
         meterId: opts.meterId ?? null,
         priceCap: opts.priceCap ?? null,
         isActive: opts.isActive ?? true,
      })
      .returning();
   if (!row) throw new Error("makePrice: insert returned no row");
   return row;
}

export async function makeBenefit(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      type?: "credits" | "feature_access" | "custom";
      meterId?: string | null;
      creditAmount?: number | null;
      name?: string;
   },
) {
   const [row] = await db
      .insert(benefits)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? "Benefício",
         type: opts.type ?? "feature_access",
         meterId: opts.meterId ?? null,
         creditAmount: opts.creditAmount ?? null,
      })
      .returning();
   if (!row) throw new Error("makeBenefit: insert returned no row");
   return row;
}

export async function attachBenefit(
   db: DatabaseInstance,
   opts: { serviceId: string; benefitId: string },
) {
   await db.insert(serviceBenefits).values(opts);
}

export async function makeSubscription(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      contactId: string;
      status?: SubscriptionStatus;
      couponId?: string | null;
      trialEndsAt?: Date | null;
      startDate?: string;
      endDate?: string | null;
   },
) {
   const [row] = await db
      .insert(contactSubscriptions)
      .values({
         teamId: opts.teamId,
         contactId: opts.contactId,
         status: opts.status ?? "active",
         couponId: opts.couponId ?? null,
         trialEndsAt: opts.trialEndsAt ?? null,
         startDate: opts.startDate ?? dayjs().format("YYYY-MM-DD"),
         endDate: opts.endDate ?? null,
         cancelAtPeriodEnd: false,
      })
      .returning();
   if (!row) throw new Error("makeSubscription: insert returned no row");
   return row;
}

export async function makeSubscriptionItem(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      subscriptionId: string;
      priceId: string;
      quantity?: number;
      negotiatedPrice?: string | null;
   },
) {
   const [row] = await db
      .insert(subscriptionItems)
      .values({
         teamId: opts.teamId,
         subscriptionId: opts.subscriptionId,
         priceId: opts.priceId,
         quantity: opts.quantity ?? 1,
         negotiatedPrice: opts.negotiatedPrice ?? null,
      })
      .returning();
   if (!row) throw new Error("makeSubscriptionItem: insert returned no row");
   return row;
}

export async function makeCoupon(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      code?: string;
      type?: "percent" | "fixed";
      amount?: string;
      duration?: "once" | "forever" | "repeating";
      durationMonths?: number | null;
      isActive?: boolean;
   },
) {
   const [row] = await db
      .insert(coupons)
      .values({
         teamId: opts.teamId,
         code: opts.code ?? `CODE-${crypto.randomUUID().slice(0, 6)}`,
         scope: "team",
         type: opts.type ?? "percent",
         amount: opts.amount ?? "10",
         duration: opts.duration ?? "once",
         durationMonths: opts.durationMonths ?? null,
         isActive: opts.isActive ?? true,
      })
      .returning();
   if (!row) throw new Error("makeCoupon: insert returned no row");
   return row;
}

export async function makeUsageEvent(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      meterId: string;
      quantity: string;
      timestamp?: Date;
      idempotencyKey?: string;
   },
) {
   const [row] = await db
      .insert(usageEvents)
      .values({
         teamId: opts.teamId,
         meterId: opts.meterId,
         quantity: opts.quantity,
         timestamp: opts.timestamp ?? new Date(),
         idempotencyKey: opts.idempotencyKey ?? crypto.randomUUID(),
      })
      .returning();
   if (!row) throw new Error("makeUsageEvent: insert returned no row");
   return row;
}
