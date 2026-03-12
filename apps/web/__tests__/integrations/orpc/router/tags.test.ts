import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/tags-repository");
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
}));

import {
   archiveTag,
   createTag,
   deleteTag,
   ensureTagOwnership,
   listTags,
   updateTag,
} from "@core/database/repositories/tags-repository";
import { AppError } from "@core/logging/errors";
import * as tagsRouter from "@/integrations/orpc/router/tags";

const TAG_ID = "a0000000-0000-4000-8000-000000000020";

const mockTag = {
   id: TAG_ID,
   teamId: TEST_TEAM_ID,
   name: "Marketing",
   color: "#6366f1",
   description: null,
   isArchived: false,
   createdAt: new Date(),
   updatedAt: new Date(),
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("create", () => {
   it("creates a tag", async () => {
      vi.mocked(createTag).mockResolvedValueOnce(mockTag);

      const result = await call(
         tagsRouter.create,
         { name: "Marketing" },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockTag);
      expect(createTag).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ name: "Marketing" }),
      );
   });
});

describe("getAll", () => {
   it("lists tags", async () => {
      vi.mocked(listTags).mockResolvedValueOnce([mockTag]);

      const result = await call(tagsRouter.getAll, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual([mockTag]);
      expect(listTags).toHaveBeenCalledWith(TEST_TEAM_ID);
   });
});

describe("update", () => {
   it("updates tag after ownership check", async () => {
      vi.mocked(ensureTagOwnership).mockResolvedValueOnce(mockTag);
      const updated = { ...mockTag, name: "Vendas" };
      vi.mocked(updateTag).mockResolvedValueOnce(updated);

      const result = await call(
         tagsRouter.update,
         { id: TAG_ID, name: "Vendas" },
         { context: createTestContext() },
      );

      expect(result.name).toBe("Vendas");
      expect(updateTag).toHaveBeenCalledWith(TAG_ID, { name: "Vendas" });
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureTagOwnership).mockRejectedValueOnce(
         AppError.notFound("Tag não encontrada."),
      );

      await expect(
         call(
            tagsRouter.update,
            { id: TAG_ID, name: "Vendas" },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Tag não encontrada.");
   });
});

describe("remove", () => {
   it("deletes tag after ownership check", async () => {
      vi.mocked(ensureTagOwnership).mockResolvedValueOnce(mockTag);
      vi.mocked(deleteTag).mockResolvedValueOnce(undefined);

      const result = await call(
         tagsRouter.remove,
         { id: TAG_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual({ success: true });
      expect(deleteTag).toHaveBeenCalledWith(TAG_ID);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureTagOwnership).mockRejectedValueOnce(
         AppError.notFound("Tag não encontrada."),
      );

      await expect(
         call(
            tagsRouter.remove,
            { id: TAG_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Tag não encontrada.");
   });
});

describe("archive", () => {
   it("archives tag after ownership check", async () => {
      vi.mocked(ensureTagOwnership).mockResolvedValueOnce(mockTag);
      const archived = { ...mockTag, isArchived: true };
      vi.mocked(archiveTag).mockResolvedValueOnce(archived);

      const result = await call(
         tagsRouter.archive,
         { id: TAG_ID },
         { context: createTestContext() },
      );

      expect(result.isArchived).toBe(true);
      expect(archiveTag).toHaveBeenCalledWith(TAG_ID);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureTagOwnership).mockRejectedValueOnce(
         AppError.notFound("Tag não encontrada."),
      );

      await expect(
         call(
            tagsRouter.archive,
            { id: TAG_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Tag não encontrada.");
   });
});
