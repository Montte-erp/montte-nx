import * as fs from "node:fs";
import * as path from "node:path";
import { createDb } from "@core/database/client";
import { fiscalSettings, nfeDocuments } from "@core/database/schemas/fiscal";
import { parties } from "@core/database/schemas/relationships";
import { vaultDocuments, vaultFolders } from "@core/database/schemas/vault";
import { VAULT_DEFAULT_FOLDER_KEYS } from "@core/vault/catalog";
import dayjs from "dayjs";
import { and, desc, eq, inArray } from "drizzle-orm";
import { config } from "dotenv";

const WEB_DIR = path.join(process.cwd(), "apps", "web");
const SEED_DESCRIPTION = "Amostra Montte para Vault e NF-e";

const FOLDER_SEEDS = [
   {
      name: "Anexos",
      systemKey: VAULT_DEFAULT_FOLDER_KEYS.attachments,
      isDefault: true,
   },
   { name: "Fiscal", systemKey: null, isDefault: false },
   { name: "Contratos", systemKey: null, isDefault: false },
   { name: "Empresa", systemKey: null, isDefault: false },
] as const;

const VAULT_DOCUMENT_SEEDS = [
   {
      folder: "Fiscal",
      title: "XML NF-e 000128 - Clínica Aurora",
      description: SEED_DESCRIPTION,
      status: "stored",
      source: "fiscal",
      fileKey: "demo/vault/nfe-000128-clinica-aurora.xml",
      originalFileName: "nfe-000128-clinica-aurora.xml",
      mimeType: "application/xml",
      fileSize: 42_180,
      daysAgo: 2,
   },
   {
      folder: "Fiscal",
      title: "DANFE 000128 - Clínica Aurora",
      description: SEED_DESCRIPTION,
      status: "stored",
      source: "fiscal",
      fileKey: "demo/vault/danfe-000128-clinica-aurora.pdf",
      originalFileName: "danfe-000128-clinica-aurora.pdf",
      mimeType: "application/pdf",
      fileSize: 184_220,
      daysAgo: 2,
   },
   {
      folder: "Fiscal",
      title: "XML NF-e 000129 - Oficina Prado",
      description: SEED_DESCRIPTION,
      status: "stored",
      source: "fiscal",
      fileKey: "demo/vault/nfe-000129-oficina-prado.xml",
      originalFileName: "nfe-000129-oficina-prado.xml",
      mimeType: "application/xml",
      fileSize: 39_744,
      daysAgo: 4,
   },
   {
      folder: "Fiscal",
      title: "DANFE 000129 - Oficina Prado",
      description: SEED_DESCRIPTION,
      status: "stored",
      source: "fiscal",
      fileKey: "demo/vault/danfe-000129-oficina-prado.pdf",
      originalFileName: "danfe-000129-oficina-prado.pdf",
      mimeType: "application/pdf",
      fileSize: 176_900,
      daysAgo: 4,
   },
   {
      folder: "Contratos",
      title: "Contrato de prestação - Mercado Jardim",
      description: SEED_DESCRIPTION,
      status: "stored",
      source: "contracts",
      fileKey: "demo/vault/contrato-mercado-jardim.pdf",
      originalFileName: "contrato-mercado-jardim.pdf",
      mimeType: "application/pdf",
      fileSize: 392_500,
      daysAgo: 8,
   },
   {
      folder: "Anexos",
      title: "Comprovante AWS - maio",
      description: SEED_DESCRIPTION,
      status: "stored",
      source: "finance",
      fileKey: "demo/vault/comprovante-aws-maio.pdf",
      originalFileName: "comprovante-aws-maio.pdf",
      mimeType: "application/pdf",
      fileSize: 118_240,
      daysAgo: 11,
   },
   {
      folder: "Empresa",
      title: "Cartão CNPJ",
      description: SEED_DESCRIPTION,
      status: "needs_review",
      source: "manual",
      fileKey: "demo/vault/cartao-cnpj.pdf",
      originalFileName: "cartao-cnpj.pdf",
      mimeType: "application/pdf",
      fileSize: 92_400,
      daysAgo: 15,
   },
] satisfies Array<
   Omit<
      typeof vaultDocuments.$inferInsert,
      "teamId" | "organizationId" | "folderId" | "createdAt" | "updatedAt"
   > & { folder: string; daysAgo: number }
>;

const SUPPLIER_SEEDS = [
   {
      name: "Clínica Aurora",
      documentNumber: "11222333000181",
      email: "financeiro@clinicaaurora.com.br",
   },
   {
      name: "Oficina Prado",
      documentNumber: "22333444000172",
      email: "notas@oficinaprado.com.br",
   },
   {
      name: "Mercado Jardim",
      documentNumber: "33444555000163",
      email: "fiscal@mercadojardim.com.br",
   },
   {
      name: "Studio Bento",
      documentNumber: "44555666000154",
      email: "admin@studiobento.com.br",
   },
   {
      name: "Contabilidade Norte",
      documentNumber: "55666777000145",
      email: "contato@contabilidadenorte.com.br",
   },
] as const;

const NFE_SEEDS = [
   {
      accessKey: "29260611222333000181550010000001281000001281",
      number: "000128",
      series: "1",
      issuerName: "Montte Tecnologia LTDA",
      supplierName: "Clínica Aurora",
      totalAmountCents: 12_900_00,
      issuedAtDaysAgo: 2,
      status: "authorized",
   },
   {
      accessKey: "29260622333444000172550010000001291000001292",
      number: "000129",
      series: "1",
      issuerName: "Montte Tecnologia LTDA",
      supplierName: "Oficina Prado",
      totalAmountCents: 8_450_00,
      issuedAtDaysAgo: 4,
      status: "authorized",
   },
   {
      accessKey: "29260633444555000163550010000001301000001303",
      number: "000130",
      series: "1",
      issuerName: "Montte Tecnologia LTDA",
      supplierName: "Mercado Jardim",
      totalAmountCents: 15_300_00,
      issuedAtDaysAgo: 6,
      status: "received",
   },
   {
      accessKey: "29260644555666000154550010000001311000001314",
      number: "000131",
      series: "1",
      issuerName: "Montte Tecnologia LTDA",
      supplierName: "Studio Bento",
      totalAmountCents: 4_790_00,
      issuedAtDaysAgo: 9,
      status: "cancelled",
   },
   {
      accessKey: "29260655666777000145550010000001321000001325",
      number: "000132",
      series: "1",
      issuerName: "Montte Tecnologia LTDA",
      supplierName: "Contabilidade Norte",
      totalAmountCents: 2_100_00,
      issuedAtDaysAgo: 13,
      status: "authorized",
   },
] satisfies Array<
   Pick<
      typeof nfeDocuments.$inferInsert,
      | "accessKey"
      | "number"
      | "series"
      | "issuerName"
      | "totalAmountCents"
      | "status"
   > & { issuedAtDaysAgo: number; supplierName: string }
>;

function getEnvFilePath(env: string) {
   const possibleFiles = [
      `.env.${env}.local`,
      `.env.${env}`,
      ".env.local",
      ".env",
   ];

   for (const file of possibleFiles) {
      const filePath = path.join(WEB_DIR, file);
      if (fs.existsSync(filePath)) return filePath;
   }

   throw new Error(`No environment file found for ${env} in apps/web`);
}

function loadEnv(env: string) {
   const envFile = getEnvFilePath(env);
   config({ path: envFile });
   console.log(`Env: ${envFile}`);
}

type Db = ReturnType<typeof createDb>;

async function resolveTeam(db: Db) {
   const requestedTeamId = process.env.TEAM_ID;
   const team = requestedTeamId
      ? await db.query.team.findFirst({
           where: (fields) => eq(fields.id, requestedTeamId),
           columns: { id: true, name: true, slug: true, organizationId: true },
        })
      : await db.query.team.findFirst({
           orderBy: (fields) => desc(fields.createdAt),
           columns: { id: true, name: true, slug: true, organizationId: true },
        });

   if (!team) {
      throw new Error(
         "Nenhuma equipe encontrada. Crie uma equipe antes do seed.",
      );
   }

   console.log(`Equipe: ${team.name} (${team.slug})`);
   return team;
}

async function ensureFolder(
   db: Db,
   team: Awaited<ReturnType<typeof resolveTeam>>,
   seed: (typeof FOLDER_SEEDS)[number],
) {
   const existing = await db.query.vaultFolders.findFirst({
      where: (fields) =>
         and(eq(fields.teamId, team.id), eq(fields.name, seed.name)),
      columns: { id: true, name: true },
   });
   if (existing) return existing;

   const [created] = await db
      .insert(vaultFolders)
      .values({
         organizationId: team.organizationId,
         teamId: team.id,
         name: seed.name,
         systemKey: seed.systemKey,
         isDefault: seed.isDefault,
      })
      .returning({ id: vaultFolders.id, name: vaultFolders.name });

   if (!created) throw new Error(`Falha ao criar pasta ${seed.name}.`);
   return created;
}

async function ensureSupplier(
   db: Db,
   team: Awaited<ReturnType<typeof resolveTeam>>,
   seed: (typeof SUPPLIER_SEEDS)[number],
) {
   const existing = await db.query.parties.findFirst({
      where: (fields) =>
         and(
            eq(fields.teamId, team.id),
            eq(fields.role, "supplier"),
            eq(fields.documentNumber, seed.documentNumber),
         ),
      columns: { id: true, name: true },
   });
   if (existing) return { ...existing, name: seed.name };

   const [created] = await db
      .insert(parties)
      .values({
         teamId: team.id,
         role: "supplier",
         kind: "company",
         name: seed.name,
         documentNumber: seed.documentNumber,
         email: seed.email,
      })
      .returning({ id: parties.id, name: parties.name });

   if (!created) throw new Error(`Falha ao criar fornecedor ${seed.name}.`);
   return created;
}

async function seedFiscalSettings(
   db: Db,
   team: Awaited<ReturnType<typeof resolveTeam>>,
) {
   await db
      .insert(fiscalSettings)
      .values({
         organizationId: team.organizationId,
         teamId: team.id,
         dfeProvider: "jacobina-saatri",
         dfeUsername: "demo@montte.com.br",
         dfePassword: "senha-demo",
         municipalRegistration: "123456",
         enabled: true,
      })
      .onConflictDoUpdate({
         target: fiscalSettings.teamId,
         set: {
            dfeProvider: "jacobina-saatri",
            dfeUsername: "demo@montte.com.br",
            dfePassword: "senha-demo",
            municipalRegistration: "123456",
            enabled: true,
            updatedAt: new Date(),
         },
      });
}

async function main() {
   const env = process.env.APP_ENV ?? "local";
   loadEnv(env);

   const databaseUrl = process.env.DATABASE_URL;
   if (!databaseUrl) throw new Error("DATABASE_URL não definido.");

   const db = createDb({ databaseUrl, max: 4 });
   const team = await resolveTeam(db);

   const folders = [];
   for (const seed of FOLDER_SEEDS) {
      folders.push(await ensureFolder(db, team, seed));
   }
   const foldersByName = new Map(
      folders.map((folder) => [folder.name, folder.id]),
   );

   const suppliers = [];
   for (const seed of SUPPLIER_SEEDS) {
      suppliers.push(await ensureSupplier(db, team, seed));
   }
   const suppliersByName = new Map(
      suppliers.map((supplier) => [supplier.name, supplier.id]),
   );

   await seedFiscalSettings(db, team);

   await db.transaction(async (tx) => {
      await tx
         .delete(vaultDocuments)
         .where(
            and(
               eq(vaultDocuments.teamId, team.id),
               eq(vaultDocuments.description, SEED_DESCRIPTION),
            ),
         );

      await tx.delete(nfeDocuments).where(
         and(
            eq(nfeDocuments.teamId, team.id),
            inArray(
               nfeDocuments.accessKey,
               NFE_SEEDS.map((seed) => seed.accessKey),
            ),
         ),
      );

      await tx.insert(vaultDocuments).values(
         VAULT_DOCUMENT_SEEDS.map((seed) => ({
            organizationId: team.organizationId,
            teamId: team.id,
            folderId: foldersByName.get(seed.folder),
            title: seed.title,
            description: seed.description,
            status: seed.status,
            source: seed.source,
            fileKey: seed.fileKey,
            originalFileName: seed.originalFileName,
            mimeType: seed.mimeType,
            fileSize: seed.fileSize,
            createdAt: dayjs().subtract(seed.daysAgo, "day").toDate(),
            updatedAt: dayjs().subtract(seed.daysAgo, "day").toDate(),
         })),
      );

      await tx.insert(nfeDocuments).values(
         NFE_SEEDS.map((seed) => ({
            organizationId: team.organizationId,
            teamId: team.id,
            accessKey: seed.accessKey,
            number: seed.number,
            series: seed.series,
            issuerName: seed.issuerName,
            supplierId: suppliersByName.get(seed.supplierName),
            recipientName: seed.supplierName,
            totalAmountCents: seed.totalAmountCents,
            issuedAt: dayjs().subtract(seed.issuedAtDaysAgo, "day").toDate(),
            status: seed.status,
            createdAt: dayjs().subtract(seed.issuedAtDaysAgo, "day").toDate(),
            updatedAt: dayjs().subtract(seed.issuedAtDaysAgo, "day").toDate(),
         })),
      );
   });

   console.log(
      `Seed concluído: ${VAULT_DOCUMENT_SEEDS.length} documentos no Vault, ${NFE_SEEDS.length} NF-e e portal jacobina-saatri configurado.`,
   );
   process.exit(0);
}

main().catch((error: unknown) => {
   console.error(error);
   process.exit(1);
});
