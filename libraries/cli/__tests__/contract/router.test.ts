import { describe, it, expect } from "vitest";
import { contract } from "../../src/contract";

describe("contract structure", () => {
   it("has accounts namespace with all procedures", () => {
      expect(contract.accounts.list).toBeDefined();
      expect(contract.accounts.get).toBeDefined();
      expect(contract.accounts.create).toBeDefined();
      expect(contract.accounts.update).toBeDefined();
      expect(contract.accounts.remove).toBeDefined();
   });

   it("has transactions namespace with all procedures", () => {
      expect(contract.transactions.list).toBeDefined();
      expect(contract.transactions.get).toBeDefined();
      expect(contract.transactions.create).toBeDefined();
      expect(contract.transactions.update).toBeDefined();
      expect(contract.transactions.remove).toBeDefined();
      expect(contract.transactions.summary).toBeDefined();
   });

   it("has categories namespace with all procedures", () => {
      expect(contract.categories.list).toBeDefined();
      expect(contract.categories.create).toBeDefined();
      expect(contract.categories.update).toBeDefined();
      expect(contract.categories.remove).toBeDefined();
      expect(contract.categories.archive).toBeDefined();
   });

   it("has budgets namespace with all procedures", () => {
      expect(contract.budgets.list).toBeDefined();
      expect(contract.budgets.get).toBeDefined();
      expect(contract.budgets.create).toBeDefined();
      expect(contract.budgets.update).toBeDefined();
      expect(contract.budgets.remove).toBeDefined();
   });
});
