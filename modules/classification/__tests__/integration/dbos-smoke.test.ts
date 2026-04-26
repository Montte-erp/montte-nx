import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";
import {
   launchPgliteDBOS,
   type PgliteDbosRuntime,
} from "../helpers/pglite-dbos-runtime";

let fired = false;
const smokeWorkflow = DBOS.registerWorkflow(async () => {
   fired = true;
});
const smokeQueue = new WorkflowQueue("classification-smoke-test", {
   workerConcurrency: 1,
});

let runtime: PgliteDbosRuntime;

beforeEach(async () => {
   fired = false;
   runtime = await launchPgliteDBOS();
}, 30_000);

afterEach(async () => {
   await runtime.shutdown();
});

describe("DBOS smoke (pglite) — classification", () => {
   it("workflow with delaySeconds:1 fires after delay", async () => {
      await DBOS.startWorkflow(smokeWorkflow, {
         workflowID: "classification-smoke-test-1",
         queueName: smokeQueue.name,
         enqueueOptions: { delaySeconds: 1 },
      })();

      const deadline = Date.now() + 5000;
      while (!fired && Date.now() < deadline) {
         await new Promise((r) => setTimeout(r, 100));
      }

      expect(fired).toBe(true);
   }, 15_000);
});
