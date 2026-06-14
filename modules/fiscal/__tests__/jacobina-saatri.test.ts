import { Result } from "better-result";
import { describe, expect, it } from "vitest";
import { fiscalDocuments } from "@core/database/schemas/fiscal";
import { seedTeam } from "@core/database/testing/factories";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import {
   loadJacobinaSaatriSecret,
   saveJacobinaSaatriSecret,
} from "../src/services/fiscal-vault";
import { issueJacobinaNfse } from "../src/services/jacobina-saatri";

const vaultKey = {
   value: Buffer.from("01234567890123456789012345678901").toString("base64"),
};

const fiscalAddress = {
   street: "Rua Exemplo",
   number: "100",
   district: "Centro",
   cityCode: "2917706",
   city: "Jacobina",
   state: "BA",
   postalCode: "44700000",
   countryCode: "1058",
} satisfies {
   street: string;
   number: string;
   district: string;
   cityCode: string;
   city: string;
   state: "BA";
   postalCode: string;
   countryCode: string;
};

describe("Jacobina SAATRI fiscal flow", () => {
   it("stores SAATRI email/password in the fiscal vault and issues a minimal NFS-e", async () => {
      const testDb = await setupTestDb();
      const { organizationId, teamId } = await seedTeam(testDb.db);

      const savedSecret = await saveJacobinaSaatriSecret(testDb.db, vaultKey, {
         organizationId,
         teamId,
         environment: "homologation",
         issuerTaxId: "12345678000195",
         municipalRegistration: "12345",
         username: "fiscal@example.com",
         password: "senha-de-teste",
      });

      if (Result.isError(savedSecret)) throw savedSecret.error;
      expect(savedSecret.value).toEqual({ configured: true });

      const secret = await loadJacobinaSaatriSecret(
         testDb.db,
         vaultKey,
         teamId,
      );
      if (Result.isError(secret)) throw secret.error;
      expect(secret.value).toEqual({
         issuerTaxId: "12345678000195",
         municipalRegistration: "12345",
         username: "fiscal@example.com",
         password: "senha-de-teste",
      });

      const issued = await issueJacobinaNfse({
         db: testDb.db,
         organizationId,
         teamId,
         secret: secret.value,
         input: {
            environment: "homologation",
            series: "1",
            number: "1",
            issuedAt: "2026-01-02T03:04:05.000Z",
            issuer: {
               legalName: "Empresa Prestadora LTDA",
               address: fiscalAddress,
            },
            customer: {
               legalName: "Cliente Tomador",
               cpf: "12345678909",
               address: fiscalAddress,
            },
            services: [
               {
                  description: "Serviço de teste em homologação",
                  serviceListCode: "01.05",
                  amount: "150.00",
                  taxable: true,
               },
            ],
         },
         createProvider: () => ({
            manifest: {
               id: "jacobina-saatri",
               name: "Jacobina SAATRI",
               documentKinds: ["nfse"],
               environments: ["homologation"],
               capabilities: ["issue_nfse"],
            },
            issue: async (input) =>
               Result.ok({
                  documentRef: {
                     documentKind: "nfse",
                     providerId: "jacobina-saatri",
                     environment: input.environment,
                     issuerTaxId: "12345678000195",
                     series: input.series,
                     number: input.number,
                  },
                  providerResponse: {
                     status: "authorized",
                     providerDocumentId: "NFSE-1",
                     protocol: "PROTOCOLO-1",
                     verificationUrl: "https://jacobina.saatri.com.br/",
                     rejections: [],
                     artifacts: [
                        {
                           kind: "request_xml",
                           mediaType: "application/xml",
                           bytes: new TextEncoder().encode(
                              "<GerarNfseEnvio />",
                           ),
                        },
                     ],
                  },
               }),
         }),
      });

      if (Result.isError(issued)) throw issued.error;
      expect(issued.value.document.status).toBe("authorized");

      const rows = await testDb.db.select().from(fiscalDocuments);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.providerId).toBe("jacobina-saatri");
      expect(rows[0]?.artifacts[0]?.base64).toBe(
         Buffer.from("<GerarNfseEnvio />").toString("base64"),
      );

      await testDb.cleanup();
   });
});
