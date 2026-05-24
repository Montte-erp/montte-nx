import { describe, expect, it } from "vitest";
import {
   createPartyCompanySchema,
   createPartyPersonSchema,
   isValidCpf,
   isValidCnpj,
   normalizeDocument,
   normalizePhone,
   updatePartySchema,
} from "@core/database/schemas/relationships";

describe("relationships helpers", () => {
   it("normaliza documento removendo máscara e converte para maiúsculo", () => {
      const result = normalizeDocument(" 12.abc.345/6789-de  ");
      expect(result).toBe("12ABC3456789DE");
   });

   it("normaliza telefone removendo máscara", () => {
      expect(normalizePhone("(11) 98765-4321")).toBe("11987654321");
   });

   it("valida CPF corretamente", () => {
      expect(isValidCpf("52998224725")).toBe(true);
      expect(isValidCpf("52998224724")).toBe(false);
   });

   it("valida CNPJ alfanumérico", () => {
      expect(isValidCnpj("12ABC34501DE35")).toBe(true);
      expect(isValidCnpj("12ABC34501DE36")).toBe(false);
   });
});

describe("createPartyPersonSchema", () => {
   const baseInput = {
      role: "customer",
      kind: "person",
      name: "João Souza",
   };

   it("aceita CPF válido", () => {
      const result = createPartyPersonSchema.safeParse({
         ...baseInput,
         documentNumber: "529.982.247-25",
         email: "joao@teste.com",
         phone: "(11) 98765-4321",
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.documentNumber).toBe("52998224725");
         expect(result.data.phone).toBe("11987654321");
      }
   });

   it("rejeita CPF inválido", () => {
      const result = createPartyPersonSchema.safeParse({
         ...baseInput,
         documentNumber: "529.982.247-24",
      });
      expect(result.success).toBe(false);
   });

   it("rejeita CNPJ em pessoa", () => {
      const result = createPartyPersonSchema.safeParse({
         ...baseInput,
         documentNumber: "12ABC34501DE35",
      });
      expect(result.success).toBe(false);
   });

   it("aceita documento vazio", () => {
      const result = createPartyPersonSchema.safeParse({
         ...baseInput,
         documentNumber: "  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.documentNumber).toBe(null);
      }
   });

   it("aceita nome com 2 caracteres", () => {
      const result = createPartyPersonSchema.safeParse({
         ...baseInput,
         name: "An",
      });
      expect(result.success).toBe(true);
   });

   it("converte email vazio para null", () => {
      const result = createPartyPersonSchema.safeParse({
         ...baseInput,
         email: "   ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.email).toBe(null);
      }
   });

   it("converte telefone vazio para null", () => {
      const result = createPartyPersonSchema.safeParse({
         ...baseInput,
         phone: "   ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.phone).toBe(null);
      }
   });

   it("rejeita nome com 1 caractere", () => {
      expect(
         createPartyPersonSchema.safeParse({
            ...baseInput,
            name: "A",
         }).success,
      ).toBe(false);
   });

   it("rejeita nome com mais de 160 caracteres", () => {
      expect(
         createPartyPersonSchema.safeParse({
            ...baseInput,
            name: "A".repeat(161),
         }).success,
      ).toBe(false);
   });

   it("rejeita e-mail inválido", () => {
      expect(
         createPartyPersonSchema.safeParse({
            ...baseInput,
            email: "email-invalido",
         }).success,
      ).toBe(false);
   });

   it("rejeita telefone com tamanho inválido", () => {
      expect(
         createPartyPersonSchema.safeParse({
            ...baseInput,
            phone: "(11) 1234-789",
         }).success,
      ).toBe(false);
   });
});

describe("createPartyCompanySchema", () => {
   it("aceita CNPJ válido", () => {
      const result = createPartyCompanySchema.safeParse({
         role: "supplier",
         kind: "company",
         name: "Loja do Zé",
         documentNumber: "11.222.333/0001-81",
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.documentNumber).toBe("11222333000181");
      }
   });

   it("rejeita CNPJ inválido", () => {
      expect(
         createPartyCompanySchema.safeParse({
            role: "supplier",
            kind: "company",
            name: "Loja do Zé",
            documentNumber: "11.222.333/0001-82",
         }).success,
      ).toBe(false);
   });

   it("rejeita CPF em empresa", () => {
      expect(
         createPartyCompanySchema.safeParse({
            role: "supplier",
            kind: "company",
            name: "Loja do Zé",
            documentNumber: "529.982.247-25",
         }).success,
      ).toBe(false);
   });

   it("aceita CNPJ alfanumérico válido", () => {
      expect(
         createPartyCompanySchema.safeParse({
            role: "supplier",
            kind: "company",
            name: "Loja do Zé",
            documentNumber: "12ABC34501DE35",
         }).success,
      ).toBe(true);
   });

   it("aceita documento vazio", () => {
      expect(
         createPartyCompanySchema.safeParse({
            role: "supplier",
            kind: "company",
            name: "Loja do Zé",
            documentNumber: " ",
         }).success,
      ).toBe(true);
   });
});

describe("updatePartySchema", () => {
   it("rejeita trocar tipo sem informar documento", () => {
      const result = updatePartySchema.safeParse({
         kind: "person",
      });
      expect(result.success).toBe(false);
   });

   it("aceita trocar tipo com documento vazio", () => {
      const result = updatePartySchema.safeParse({
         kind: "company",
         documentNumber: "   ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.documentNumber).toBe(null);
      }
   });

   it("aceita trocar tipo com documento null", () => {
      const result = updatePartySchema.safeParse({
         kind: "company",
         documentNumber: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.documentNumber).toBe(null);
      }
   });

   it("rejeita kind incoerente com documento atual: company com CPF", () => {
      const result = updatePartySchema.safeParse({
         kind: "company",
         documentNumber: "529.982.247-25",
      });
      expect(result.success).toBe(false);
   });

   it("rejeita person com CNPJ no documento", () => {
      const result = updatePartySchema.safeParse({
         kind: "person",
         documentNumber: "11.222.333/0001-81",
      });
      expect(result.success).toBe(false);
   });

   it("falha atualizar apenas documento sem informar tipo", () => {
      const result = updatePartySchema.safeParse({
         documentNumber: "529.982.247-25",
      });
      expect(result.success).toBe(false);
   });
});
