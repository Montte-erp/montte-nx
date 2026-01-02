import { mock } from "bun:test";

export type MockQueryResult<T = unknown> = T[];

export interface MockDbOverrides {
   selectResult?: MockQueryResult;
   insertResult?: MockQueryResult;
   updateResult?: MockQueryResult;
   deleteResult?: MockQueryResult;
}

export function createMockDb(overrides: MockDbOverrides = {}) {
   const {
      selectResult = [],
      insertResult = [{ id: "new-id" }],
      updateResult = [{ id: "tx-123" }],
      deleteResult = [],
   } = overrides;

   const mockSelect = mock(() => ({
      from: mock(() => ({
         where: mock(() => ({
            limit: mock(() => Promise.resolve(selectResult)),
         })),
         leftJoin: mock(() => ({
            where: mock(() => ({
               limit: mock(() => Promise.resolve(selectResult)),
            })),
         })),
      })),
   }));

   const mockInsert = mock(() => ({
      values: mock(() => ({
         returning: mock(() => Promise.resolve(insertResult)),
      })),
   }));

   const mockUpdate = mock(() => ({
      set: mock(() => ({
         where: mock(() => ({
            returning: mock(() => Promise.resolve(updateResult)),
         })),
      })),
   }));

   const mockDelete = mock(() => ({
      where: mock(() => ({
         returning: mock(() => Promise.resolve(deleteResult)),
      })),
   }));

   return {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      query: {
         transaction: {
            findFirst: mock(() => Promise.resolve(selectResult[0] ?? null)),
            findMany: mock(() => Promise.resolve(selectResult)),
         },
         automationRule: {
            findFirst: mock(() => Promise.resolve(selectResult[0] ?? null)),
            findMany: mock(() => Promise.resolve(selectResult)),
         },
         organization: {
            findFirst: mock(() =>
               Promise.resolve({
                  id: "org-123",
                  name: "Test Organization",
                  slug: "test-org",
               }),
            ),
         },
         member: {
            findFirst: mock(() =>
               Promise.resolve({
                  userId: "user-owner",
                  role: "owner",
                  user: { id: "user-owner", email: "owner@example.com", name: "Owner User" },
               }),
            ),
            findMany: mock(() =>
               Promise.resolve([
                  { userId: "user-owner", role: "owner", user: { id: "user-owner", email: "owner@example.com", name: "Owner User" } },
                  { userId: "user-member", role: "member", user: { id: "user-member", email: "member@example.com", name: "Member User" } },
               ]),
            ),
         },
      },
      transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
         const txDb = createMockDb(overrides);
         return fn(txDb);
      },
   };
}

export type MockDb = ReturnType<typeof createMockDb>;

export function createMockDbWithTransaction(
   existingTransaction: Record<string, unknown> | null = {
      id: "tx-123",
      description: "Test transaction",
      amount: 100,
      type: "expense",
      organizationId: "org-123",
   },
) {
   return createMockDb({
      selectResult: existingTransaction ? [existingTransaction] : [],
      updateResult: existingTransaction ? [existingTransaction] : [],
   });
}

export function createMockDbWithError(errorMessage: string) {
   const error = new Error(errorMessage);
   return {
      select: mock(() => ({
         from: mock(() => ({
            where: mock(() => ({
               limit: mock(() => Promise.reject(error)),
            })),
            leftJoin: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => Promise.reject(error)),
               })),
            })),
         })),
      })),
      insert: mock(() => ({
         values: mock(() => ({
            returning: mock(() => Promise.reject(error)),
         })),
      })),
      update: mock(() => ({
         set: mock(() => ({
            where: mock(() => ({
               returning: mock(() => Promise.reject(error)),
            })),
         })),
      })),
      delete: mock(() => ({
         where: mock(() => ({
            returning: mock(() => Promise.reject(error)),
         })),
      })),
      query: {
         transaction: {
            findFirst: mock(() => Promise.reject(error)),
            findMany: mock(() => Promise.reject(error)),
         },
         automationRule: {
            findFirst: mock(() => Promise.reject(error)),
            findMany: mock(() => Promise.reject(error)),
         },
         organization: {
            findFirst: mock(() => Promise.reject(error)),
         },
         member: {
            findFirst: mock(() => Promise.reject(error)),
            findMany: mock(() => Promise.reject(error)),
         },
      },
      transaction: async () => Promise.reject(error),
   };
}
