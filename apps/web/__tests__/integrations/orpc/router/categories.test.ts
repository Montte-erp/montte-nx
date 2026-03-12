import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/categories-repository");
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
   archiveCategory,
   createCategory,
   deleteCategory,
   ensureCategoryOwnership,
   listCategories,
   updateCategory,
} from "@core/database/repositories/categories-repository";
import { AppError } from "@core/logging/errors";
import * as categoriesRouter from "@/integrations/orpc/router/categories";

const CATEGORY_ID = "a0000000-0000-4000-8000-000000000001";

const mockCategory = {
   id: CATEGORY_ID,
   teamId: TEST_TEAM_ID,
   parentId: null,
   name: "Alimentação",
   type: "expense" as const,
   level: 1,
   description: null,
   isDefault: false,
   color: "#ef4444",
   icon: null,
   isArchived: false,
   keywords: null,
   notes: null,
   participatesDre: false,
   dreGroupId: null,
   createdAt: new Date(),
   updatedAt: new Date(),
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("create", () => {
   it("creates a category", async () => {
      vi.mocked(createCategory).mockResolvedValueOnce(mockCategory);

      const result = await call(
         categoriesRouter.create,
         {
            name: "Alimentação",
            type: "expense",
         },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockCategory);
      expect(createCategory).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ name: "Alimentação" }),
      );
   });
});

describe("getAll", () => {
   it("lists categories", async () => {
      vi.mocked(listCategories).mockResolvedValueOnce([mockCategory]);

      const result = await call(categoriesRouter.getAll, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual([mockCategory]);
      expect(listCategories).toHaveBeenCalledWith(TEST_TEAM_ID, {
         type: undefined,
         includeArchived: undefined,
      });
   });

   it("filters by type", async () => {
      vi.mocked(listCategories).mockResolvedValueOnce([mockCategory]);

      await call(
         categoriesRouter.getAll,
         { type: "expense" },
         { context: createTestContext() },
      );

      expect(listCategories).toHaveBeenCalledWith(TEST_TEAM_ID, {
         type: "expense",
         includeArchived: undefined,
      });
   });
});

describe("update", () => {
   it("updates category after ownership check", async () => {
      vi.mocked(ensureCategoryOwnership).mockResolvedValueOnce(mockCategory);
      const updated = { ...mockCategory, name: "Alimentação e Bebidas" };
      vi.mocked(updateCategory).mockResolvedValueOnce(updated);

      const result = await call(
         categoriesRouter.update,
         { id: CATEGORY_ID, name: "Alimentação e Bebidas" },
         { context: createTestContext() },
      );

      expect(result.name).toBe("Alimentação e Bebidas");
      expect(ensureCategoryOwnership).toHaveBeenCalledWith(
         CATEGORY_ID,
         TEST_TEAM_ID,
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureCategoryOwnership).mockRejectedValueOnce(
         AppError.notFound("Categoria não encontrada."),
      );

      await expect(
         call(
            categoriesRouter.update,
            { id: CATEGORY_ID, name: "Test" },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Categoria não encontrada.");
   });
});

describe("remove", () => {
   it("deletes category after ownership check", async () => {
      vi.mocked(ensureCategoryOwnership).mockResolvedValueOnce(mockCategory);
      vi.mocked(deleteCategory).mockResolvedValueOnce(undefined);

      const result = await call(
         categoriesRouter.remove,
         { id: CATEGORY_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual({ success: true });
      expect(deleteCategory).toHaveBeenCalledWith(CATEGORY_ID);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureCategoryOwnership).mockRejectedValueOnce(
         AppError.notFound("Categoria não encontrada."),
      );

      await expect(
         call(
            categoriesRouter.remove,
            { id: CATEGORY_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Categoria não encontrada.");
   });

   it("propagates CONFLICT when category has transactions", async () => {
      vi.mocked(ensureCategoryOwnership).mockResolvedValueOnce(mockCategory);
      vi.mocked(deleteCategory).mockRejectedValueOnce(
         AppError.conflict(
            "Categoria com lançamentos não pode ser excluída. Use arquivamento.",
         ),
      );

      await expect(
         call(
            categoriesRouter.remove,
            { id: CATEGORY_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Categoria com lançamentos não pode ser excluída.");
   });
});

describe("exportAll", () => {
   it("returns all categories including archived", async () => {
      vi.mocked(listCategories).mockResolvedValueOnce([mockCategory]);

      const result = await call(categoriesRouter.exportAll, undefined, {
         context: createTestContext(),
      });

      expect(result).toEqual([mockCategory]);
      expect(listCategories).toHaveBeenCalledWith(TEST_TEAM_ID, {
         includeArchived: true,
      });
   });
});

describe("importBatch", () => {
   it("creates multiple categories", async () => {
      vi.mocked(createCategory).mockResolvedValue(mockCategory);

      const result = await call(
         categoriesRouter.importBatch,
         {
            categories: [
               { name: "Alimentação", type: "expense" },
               { name: "Salário", type: "income" },
            ],
         },
         { context: createTestContext() },
      );

      expect(result).toHaveLength(2);
      expect(createCategory).toHaveBeenCalledTimes(2);
   });
});

describe("archive", () => {
   it("archives category after ownership check", async () => {
      vi.mocked(ensureCategoryOwnership).mockResolvedValueOnce(mockCategory);
      const archived = { ...mockCategory, isArchived: true };
      vi.mocked(archiveCategory).mockResolvedValueOnce(archived);

      const result = await call(
         categoriesRouter.archive,
         { id: CATEGORY_ID },
         { context: createTestContext() },
      );

      expect(result.isArchived).toBe(true);
      expect(ensureCategoryOwnership).toHaveBeenCalledWith(
         CATEGORY_ID,
         TEST_TEAM_ID,
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureCategoryOwnership).mockRejectedValueOnce(
         AppError.notFound("Categoria não encontrada."),
      );

      await expect(
         call(
            categoriesRouter.archive,
            { id: CATEGORY_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Categoria não encontrada.");
   });
});
