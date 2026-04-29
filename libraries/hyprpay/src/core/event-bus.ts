export type CoreEventMap = {
   "subscription.created": { subscriptionId: string; gatewayId: string };
   "subscription.canceled": { subscriptionId: string; gatewayId: string };
   "subscription.updated": { subscriptionId: string; gatewayId: string };
   "charge.succeeded": {
      chargeId: string;
      gatewayId: string;
      amount: string;
      currency: string;
   };
   "charge.failed": { chargeId: string; gatewayId: string; reason: string };
   "invoice.finalized": { invoiceId: string; gatewayId: string };
   "usage.recorded": {
      meter: string;
      quantity: string;
      idempotencyKey: string;
   };
};

export type EventMap = Record<string, unknown>;

export type EventListener<T> = (payload: T) => void | Promise<void>;

export interface EventBus<TEvents extends EventMap = CoreEventMap> {
   emit<K extends keyof TEvents & string>(
      type: K,
      payload: TEvents[K],
   ): Promise<void>;
   on<K extends keyof TEvents & string>(
      type: K,
      listener: EventListener<TEvents[K]>,
   ): () => void;
   off<K extends keyof TEvents & string>(
      type: K,
      listener: EventListener<TEvents[K]>,
   ): void;
}

export function createEventBus<TEvents extends EventMap = CoreEventMap>(opts?: {
   onError?: (err: unknown, type: string) => void;
}): EventBus<TEvents> {
   const listeners = new Map<string, Set<EventListener<unknown>>>();
   const onError =
      opts?.onError ??
      ((err, type) => {
         console.error(`[hyprpay:event-bus] listener for "${type}" threw`, err);
      });

   return {
      async emit(type, payload) {
         const set = listeners.get(type);
         if (!set || set.size === 0) return;
         await Promise.all(
            Array.from(set).map(async (fn) => {
               const result = await Promise.resolve()
                  .then(() => fn(payload))
                  .catch((err: unknown) => ({ __err: err }));
               if (result && typeof result === "object" && "__err" in result) {
                  onError((result as { __err: unknown }).__err, type);
               }
            }),
         );
      },
      on(type, listener) {
         let set = listeners.get(type);
         if (!set) {
            set = new Set();
            listeners.set(type, set);
         }
         set.add(listener as EventListener<unknown>);
         return () => set?.delete(listener as EventListener<unknown>);
      },
      off(type, listener) {
         listeners.get(type)?.delete(listener as EventListener<unknown>);
      },
   };
}
