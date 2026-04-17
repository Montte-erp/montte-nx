import { createJobPublisher } from "@packages/notifications/publisher";
import { redis } from "./singletons";

export const jobPublisher = createJobPublisher(redis);
