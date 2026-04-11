import { Publisher } from "@orpc/experimental-publisher";
import type { PublisherSubscribeListenerOptions } from "@orpc/experimental-publisher";
import type { Redis } from "@core/redis/connection";
import { jobNotificationSchema } from "./schema";
import type { JobNotification } from "./schema";

type JobEvents = {
   "job.notification": JobNotification;
};

export type JobPublisher = Publisher<JobEvents>;

class RedisJobPublisher extends Publisher<JobEvents> {
   private readonly subscriber: Redis;

   constructor(private readonly publisher: Redis) {
      super();
      this.subscriber = publisher.duplicate();
   }

   async publish<K extends keyof JobEvents & string>(
      event: K,
      payload: JobEvents[K],
   ): Promise<void> {
      await this.publisher.publish(event, JSON.stringify(payload));
   }

   protected async subscribeListener<K extends keyof JobEvents & string>(
      event: K,
      listener: (payload: JobEvents[K]) => void,
      _options?: PublisherSubscribeListenerOptions,
   ): Promise<() => Promise<void>> {
      await this.subscriber.subscribe(event);

      const handler = (channel: string, message: string) => {
         if (channel !== event) return;
         listener(
            jobNotificationSchema.parse(JSON.parse(message)) as JobEvents[K],
         );
      };

      this.subscriber.on("message", handler);

      return async () => {
         this.subscriber.off("message", handler);
         await this.subscriber.unsubscribe(event);
         const subscriptionCount = this.subscriber.listenerCount("message");
         if (subscriptionCount === 0) {
            await this.subscriber.quit();
         }
      };
   }
}

export function createJobPublisher(redis: Redis): JobPublisher {
   return new RedisJobPublisher(redis);
}
