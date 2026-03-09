# Rooms Module (Salas e Espaços)

**Date:** 2026-03-01
**Status:** Draft
**Stage:** Alpha (feature flag: `rooms`)

---

## Summary

A room/space booking module for coworking spaces and venue owners. Users create rooms (name, capacity, price/h or price/day), register bookings manually (client, date, start/end time, status), and optionally link bookings to finance transactions. A dedicated "Salas" dashboard shows occupancy KPIs and booking charts.

---

## Design Decisions

- **Single list page** (`/rooms`) — shows rooms as the primary view with current day's booking status.
- **Booking via row action** — "Nova Reserva" row action opens a credenza per room.
- **Expandable row** — shows upcoming bookings for that room.
- **Manual booking only for alpha** — no availability calendar UI (visual calendar is out of scope).
- **Booking status**: `pendente`, `confirmada`, `em_andamento`, `concluida`, `cancelada`.
- **Pricing modes**: per hour (`por_hora`) or per day (`por_dia`). Total auto-computed from duration.
- **Finance integration** — "Registrar Pagamento" on a booking creates a `receita` transaction.
- **Contacts integration** — bookings optionally link to a contact (client) from the contacts table.
- **Duration** — stored as `startTime` + `endTime` (timestamps). Duration computed in queries.

---

## Step 1 — Database Schema

**File:** `packages/database/src/schemas/rooms.ts`

```typescript
import { sql } from "drizzle-orm";
import {
   index,
   numeric,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { transactions } from "./transactions";

export const roomPricingModeEnum = pgEnum("room_pricing_mode", [
   "por_hora",
   "por_dia",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
   "pendente",
   "confirmada",
   "em_andamento",
   "concluida",
   "cancelada",
]);

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const rooms = pgTable(
   "rooms",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      capacity: numeric("capacity", { precision: 5, scale: 0 }), // max people
      pricingMode: roomPricingModeEnum("pricing_mode")
         .notNull()
         .default("por_hora"),
      price: numeric("price", { precision: 12, scale: 2 }).notNull(),
      color: text("color").notNull().default("#6b7280"),
      amenities: text("amenities"), // free text: "Wi-Fi, Projetor, Ar-condicionado"
      isActive: text("is_active").notNull().default("1"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (t) => [
      index("rooms_team_idx").on(t.teamId),
      uniqueIndex("rooms_team_name_unique").on(t.teamId, t.name),
   ],
);

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const roomBookings = pgTable(
   "room_bookings",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      roomId: uuid("room_id")
         .notNull()
         .references(() => rooms.id, { onDelete: "cascade" }),
      contactId: uuid("contact_id").references(() => contacts.id, {
         onDelete: "set null",
      }),
      clientName: text("client_name"), // fallback if no contact linked
      status: bookingStatusEnum("status").notNull().default("pendente"),
      startTime: timestamp("start_time", { withTimezone: true }).notNull(),
      endTime: timestamp("end_time", { withTimezone: true }).notNull(),
      totalAmount: numeric("total_amount", { precision: 12, scale: 2 }), // computed or overridden
      paidAt: timestamp("paid_at", { withTimezone: true }),
      transactionId: uuid("transaction_id").references(() => transactions.id, {
         onDelete: "set null",
      }),
      notes: text("notes"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (t) => [
      index("room_bookings_team_idx").on(t.teamId),
      index("room_bookings_room_idx").on(t.roomId),
      index("room_bookings_start_idx").on(t.startTime),
   ],
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type RoomBooking = typeof roomBookings.$inferSelect;
export type NewRoomBooking = typeof roomBookings.$inferInsert;
```

Register in `packages/database/src/schema.ts`.

---

## Step 2 — Repository

**File:** `packages/database/src/repositories/rooms-repository.ts`

```typescript
// RoomWithBookings: Room + { upcomingBookings: RoomBooking[]; todayBookings: RoomBooking[] }
// BookingWithRoom: RoomBooking + { room: Room; contact?: Contact }

export async function listRooms(db, { teamId }): Promise<RoomWithUpcoming[]>
export async function getRoom(db, { id, teamId }): Promise<Room | null>
export async function createRoom(db, data: NewRoom): Promise<Room>
export async function updateRoom(db, { id, teamId }, data): Promise<Room>
export async function deleteRoom(db, { id, teamId }): Promise<void>  // blocks if has bookings

export async function listBookings(db, { teamId, roomId?, status?, from?, to? }): Promise<BookingWithRoom[]>
export async function getRoomUpcomingBookings(db, { teamId, roomId, limit? }): Promise<RoomBooking[]>
export async function createBooking(db, data: NewRoomBooking): Promise<RoomBooking>
export async function updateBooking(db, { id, teamId }, data): Promise<RoomBooking>
export async function cancelBooking(db, { id, teamId }): Promise<RoomBooking>

// Compute total: hours * price (for por_hora) or days * price (for por_dia)
export function computeBookingTotal(room: Room, startTime: Date, endTime: Date): number

// Dashboard queries
export async function getRoomStats(db, { teamId }): Promise<{
  totalRooms: number;
  bookingsToday: number;
  revenueThisMonth: number;
  occupancyRateThisMonth: number;  // % of available hours that were booked
}>
export async function getOccupancyChart(db, { teamId, months?: number }): Promise<
  { month: string; bookings: number; revenue: number }[]
>
export async function getTopRoomsByRevenue(db, { teamId }): Promise<
  { room: Room; bookingCount: number; revenue: number }[]
>
```

---

## Step 3 — oRPC Router

**File:** `apps/web/src/integrations/orpc/router/rooms.ts`

```typescript
// ── Rooms ─────────────────────────────────────────────────────────────────────
export const getAll = protectedProcedure.handler(...)
export const create = protectedProcedure
  .input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    capacity: z.number().int().positive().optional(),
    pricingMode: z.enum(["por_hora", "por_dia"]).default("por_hora"),
    price: z.string().min(1),
    color: z.string().optional(),
    amenities: z.string().optional(),
  }))
  .handler(...)
export const update = protectedProcedure.input(...).handler(...)
export const remove = protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(...)

// ── Bookings ──────────────────────────────────────────────────────────────────
export const getBookings = protectedProcedure
  .input(z.object({
    roomId: z.string().uuid().optional(),
    status: z.enum(["pendente", "confirmada", "em_andamento", "concluida", "cancelada"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }))
  .handler(...)

export const getRoomBookings = protectedProcedure
  .input(z.object({ roomId: z.string().uuid(), limit: z.number().int().optional() }))
  .handler(...)

export const createBooking = protectedProcedure
  .input(z.object({
    roomId: z.string().uuid(),
    contactId: z.string().uuid().optional(),
    clientName: z.string().optional(),
    status: z.enum(["pendente", "confirmada", "em_andamento", "concluida", "cancelada"]).default("pendente"),
    startTime: z.string(),   // ISO datetime
    endTime: z.string(),
    totalAmount: z.string().optional(),  // override; if omitted, computed from room price + duration
    notes: z.string().optional(),
  }))
  .handler(async ({ context, input }) => {
    const room = await getRoom(context.db, { id: input.roomId, teamId: context.teamId });
    if (!room) throw new ORPCError("NOT_FOUND", { message: "Sala não encontrada." });

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    if (end <= start) throw new ORPCError("BAD_REQUEST", { message: "Horário de término deve ser após o início." });

    const totalAmount = input.totalAmount ?? computeBookingTotal(room, start, end).toString();

    return createBooking(context.db, { teamId: context.teamId, ...input, totalAmount });
  })

export const updateBooking = protectedProcedure.input(...).handler(...)
export const cancelBooking = protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(...)

export const registerPayment = protectedProcedure
  .input(z.object({
    bookingId: z.string().uuid(),
    transactionId: z.string().uuid().optional(),
    createTransaction: z.boolean().optional(),
    notes: z.string().optional(),
  }))
  .handler(async ({ context, input }) => {
    const booking = await getBookingById(context.db, { id: input.bookingId, teamId: context.teamId });
    if (!booking) throw new ORPCError("NOT_FOUND", { message: "Reserva não encontrada." });

    let transactionId = input.transactionId;
    if (input.createTransaction && booking.totalAmount) {
      // Create income transaction: room name, amount, date = now
    }

    return updateBooking(context.db, { id: booking.id, teamId: context.teamId }, {
      paidAt: new Date(),
      transactionId,
      status: "concluida",
    });
  })

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardStats = protectedProcedure.handler(...)
export const getOccupancyChart = protectedProcedure.input(...).handler(...)
export const getTopRooms = protectedProcedure.input(...).handler(...)
```

**Register in `apps/web/src/integrations/orpc/router/index.ts`:**

```typescript
import * as rooms from "./rooms";
export const router = { ...existing, rooms };
```

---

## Step 4 — UI Components

```
apps/web/src/features/rooms/
├── ui/
│   ├── room-form.tsx                  # Sheet: create/edit room
│   ├── room-card.tsx                  # Mobile card renderer
│   ├── rooms-columns.tsx              # DataTable columns + row actions
│   ├── booking-credenza.tsx           # Create/edit booking credenza
│   └── room-bookings-list.tsx         # Expandable row: upcoming bookings
```

### `rooms-columns.tsx`

Columns: Name, Capacity, Pricing (R$ X/hora or R$ X/dia), Amenities (truncated), Today's bookings count, Status, Actions.

Row actions:

- **Nova Reserva** → `BookingCredenza`
- **Editar** → `RoomForm` sheet
- **Excluir** → `useAlertDialog`

Expandable row: `<RoomBookingsList roomId={row.id} />` — shows next 5 upcoming bookings with status badges, times, client name, and amount. Each booking has "Registrar Pagamento" and "Cancelar" actions.

### `booking-credenza.tsx`

Fields:

- **Sala** — pre-filled from row (read-only when opened from row action)
- **Cliente** — Combobox from contacts (type `cliente | ambos`) OR free text `clientName`
- **Data e horário** — DatePicker + start time + end time inputs
- **Valor total** — MoneyInput (auto-computed from duration + room price, editable)
- **Status** — Select
- **Notas** — Textarea
- Footer shows: "Duração: 2h • Valor estimado: R$ 100,00" (live computed from times + price)

### `room-form.tsx`

Fields: Name, Description, Capacity, Pricing mode (ToggleGroup: por hora / por dia), Price, Amenities (textarea), Color.

---

## Step 5 — Route

**File:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/rooms/index.tsx`

```
<DefaultHeader
  title="Salas"
  description="Gerencie os espaços disponíveis para reserva"
  actions={<Button onClick={openCreateRoom}><Plus /> Nova Sala</Button>}
/>

<Suspense fallback={<Skeleton />}>
  <RoomsTable />
</Suspense>
```

Loader prefetches `orpc.rooms.getAll`.

---

## Step 6 — Dashboard Integration

Seed a "Salas" dashboard when `rooms` flag is active. Default tiles:

- **Reservas hoje** — count of today's bookings
- **Receita este mês** — total revenue from concluded bookings
- **Taxa de ocupação** — % of available hours booked this month
- **Tendência de reservas** — line chart bookings + revenue per month
- **Top salas** — bar chart by revenue

---

## Step 7 — Sidebar + Early Access

### Sidebar

```typescript
{
  id: "rooms",
  label: "Salas",
  items: [
    {
      id: "rooms",
      label: "Salas",
      icon: DoorOpen,
      route: "/$slug/$teamSlug/rooms",
      earlyAccessFlag: "rooms",
    },
  ],
},
```

### Billing overview

```typescript
rooms: {
  label: "Salas",
  description: "Gestão de espaços e reservas para coworking",
  icon: <DoorOpen className="size-5" />,
  priceLabel: "Alpha",
  unit: "acesso gratuito",
  fallbackStage: "alpha",
},
```

### PostHog

Create early access feature flag `rooms` with stage `alpha`.

---

## File Checklist

| File                                                     | Action |
| -------------------------------------------------------- | ------ |
| `packages/database/src/schemas/rooms.ts`                 | Create |
| `packages/database/src/schema.ts`                        | Edit   |
| `packages/database/src/repositories/rooms-repository.ts` | Create |
| `apps/web/src/integrations/orpc/router/rooms.ts`         | Create |
| `apps/web/src/integrations/orpc/router/index.ts`         | Edit   |
| `apps/web/src/features/rooms/ui/room-form.tsx`           | Create |
| `apps/web/src/features/rooms/ui/room-card.tsx`           | Create |
| `apps/web/src/features/rooms/ui/rooms-columns.tsx`       | Create |
| `apps/web/src/features/rooms/ui/booking-credenza.tsx`    | Create |
| `apps/web/src/features/rooms/ui/room-bookings-list.tsx`  | Create |
| `apps/web/src/routes/.../rooms/index.tsx`                | Create |
| `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`  | Edit   |
| `apps/web/src/features/billing/ui/billing-overview.tsx`  | Edit   |
| `packages/database/src/default-insights.ts`              | Edit   |
| `scripts/seed-default-dashboard.ts`                      | Edit   |

---

## Out of Scope (alpha)

- Visual availability calendar
- Online client booking portal
- Recurring/repeating bookings
- Room conflict detection (overlapping bookings)
- Multi-room booking (event packages)
- Automated reminders
