import { describe, expect, it } from "vitest";
import { createQueueConnection } from "../../src/queues/connection";

describe("createQueueConnection", () => {
   it("parses a full Redis URL", () => {
      const conn = createQueueConnection(
         "redis://admin:secret@redis.host:6380",
      );
      expect(conn).toEqual({
         host: "redis.host",
         port: 6380,
         password: "secret",
         username: "admin",
         family: 6,
         maxRetriesPerRequest: null,
      });
   });

   it("defaults port to 6379", () => {
      const conn = createQueueConnection("redis://redis.host");
      expect(conn.port).toBe(6379);
   });

   it("handles URL without auth", () => {
      const conn = createQueueConnection("redis://redis.host:6379");
      expect(conn.password).toBeUndefined();
      expect(conn.username).toBeUndefined();
   });

   it("sets maxRetriesPerRequest to null (required by BullMQ)", () => {
      const conn = createQueueConnection("redis://localhost");
      expect(conn.maxRetriesPerRequest).toBeNull();
   });
});
