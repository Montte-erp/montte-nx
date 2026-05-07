export const E2E_USER = {
   email: "e2e@test.local",
   password: "Test12345!",
   name: "E2E Tester",
   workspace: "E2E Workspace",
} as const;

export type E2EUser = typeof E2E_USER;
