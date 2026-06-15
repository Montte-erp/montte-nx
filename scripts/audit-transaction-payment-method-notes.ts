import { config } from "dotenv";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const root = process.cwd();
config({ path: resolve(root, "apps/web/.env.local") });
config({ path: resolve(root, "apps/web/.env.production"), override: true });
config({
   path: "/home/yorizel/Documents/montte-nx/apps/web/.env.production",
   override: true,
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
   console.error("DATABASE_URL não definido.");
   process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, prepare: false });
const db = drizzle(client);

const paymentMatchers = [
   {
      paymentMethod: "pix",
      label: "Pix",
      pattern: "(^|[^[:alnum:]])pix([^[:alnum:]]|$)",
   },
   {
      paymentMethod: "credit_card",
      label: "Cartão de crédito",
      pattern: "cart[aã]o[[:space:]]+(de[[:space:]]+)?cr[eé]dito|credito",
   },
   {
      paymentMethod: "debit_card",
      label: "Cartão de débito",
      pattern: "cart[aã]o[[:space:]]+(de[[:space:]]+)?d[eé]bito|debito",
   },
   { paymentMethod: "boleto", label: "Boleto", pattern: "boleto" },
   {
      paymentMethod: "cash",
      label: "Dinheiro",
      pattern: "dinheiro|esp[eé]cie",
   },
   {
      paymentMethod: "transfer",
      label: "Transferência",
      pattern: "transfer[eê]ncia|ted|doc",
   },
   { paymentMethod: "cheque", label: "Cheque", pattern: "cheque" },
   {
      paymentMethod: "automatic_debit",
      label: "Débito automático",
      pattern:
         "d[eé]bito[[:space:]]+autom[aá]tico|debito[[:space:]]+automatico",
   },
];

const casesSql = paymentMatchers
   .map(
      (matcher) =>
         `WHEN description ~* '${matcher.pattern.replace(/'/g, "''")}' THEN '${matcher.paymentMethod}'`,
   )
   .join("\n            ");

const query = sql.raw(`
   WITH candidates AS (
      SELECT
         id,
         team_id AS "teamId",
         name,
         description,
         payment_method AS "paymentMethod",
         date,
         amount,
         CASE
            ${casesSql}
            ELSE NULL
         END AS "suggestedPaymentMethod"
      FROM finance.transactions
      WHERE payment_method IS NULL
        AND description IS NOT NULL
        AND btrim(description) <> ''
   ), matched AS (
      SELECT *
      FROM candidates
      WHERE "suggestedPaymentMethod" IS NOT NULL
   )
   SELECT
      "suggestedPaymentMethod",
      count(*)::int AS count,
      json_agg(
         json_build_object(
            'id', id,
            'teamId', "teamId",
            'name', name,
            'date', date,
            'amount', amount,
            'description', description
         )
         ORDER BY date DESC
      ) FILTER (WHERE true) AS samples
   FROM (
      SELECT *, row_number() OVER (PARTITION BY "suggestedPaymentMethod" ORDER BY date DESC, id) AS rn
      FROM matched
   ) ranked
   WHERE rn <= 10
   GROUP BY "suggestedPaymentMethod"
   ORDER BY count DESC;
`);

const totalQuery = sql.raw(`
   WITH candidates AS (
      SELECT
         CASE
            ${casesSql}
            ELSE NULL
         END AS "suggestedPaymentMethod"
      FROM finance.transactions
      WHERE payment_method IS NULL
        AND description IS NOT NULL
        AND btrim(description) <> ''
   )
   SELECT "suggestedPaymentMethod", count(*)::int AS count
   FROM candidates
   WHERE "suggestedPaymentMethod" IS NOT NULL
   GROUP BY "suggestedPaymentMethod"
   ORDER BY count DESC;
`);

const rows = await db.execute(query);
const totals = await db.execute(totalQuery);

console.log(JSON.stringify({ totals, samples: rows }, null, 2));
await client.end();
