import { Publisher } from "@orpc/experimental-publisher";
import { jobNotificationSchema } from "./schema";
class RedisJobPublisher extends Publisher {
   publisher;
   subscriber;
   constructor(publisher) {
      super();
      this.publisher = publisher;
      this.subscriber = publisher.duplicate();
   }
   async publish(event, payload) {
      await this.publisher.publish(event, JSON.stringify(payload));
   }
   async subscribeListener(event, listener) {
      await this.subscriber.subscribe(event);
      const handler = (channel, message) => {
         if (channel !== event) return;
         const parsed = jobNotificationSchema.parse(JSON.parse(message));
         listener(parsed);
      };
      this.subscriber.on("message", handler);
      return async () => {
         this.subscriber.off("message", handler);
      };
   }
}
export function createJobPublisher(redis) {
   return new RedisJobPublisher(redis);
}
