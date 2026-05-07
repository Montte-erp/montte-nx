export type E2EUser = Readonly<{
   email: string;
   password: string;
   name: string;
   workspace: string;
}>;

export const E2E_USER: E2EUser = {
   email: "e2e@test.local",
   password: "Test12345!",
   name: "E2E Tester",
   workspace: "E2E Workspace",
};
