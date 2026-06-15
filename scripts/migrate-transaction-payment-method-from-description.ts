import { config } from "dotenv";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const clearExactDescription = !args.has("--keep-description");
const env =
   process.argv.find((arg) => arg.startsWith("--env="))?.slice(6) ?? "local";

const root = process.cwd();
config({ path: resolve(root, "apps/web/.env.local") });
if (env === "production") {
   config({ path: resolve(root, "apps/web/.env.production"), override: true });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
   console.error("DATABASE_URL não definido.");
   process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, prepare: false });
const db = drizzle(client);

const paymentMatchers = [
   {
      paymentMethod: "automatic_debit",
      pattern:
         "d[eé]bito[[:space:]]+autom[aá]tico|debito[[:space:]]+automatico",
      exactPattern:
         "^[[:space:]]*(d[eé]bito[[:space:]]+autom[aá]tico|debito[[:space:]]+automatico)[[:space:]]*$",
   },
   {
      paymentMethod: "pix",
      pattern: "(^|[^[:alnum:]])pix([^[:alnum:]]|$)",
      exactPattern: "^[[:space:]]*pix[[:space:]]*$",
   },
   {
      paymentMethod: "credit_card",
      pattern: "cart[aã]o[[:space:]]+(de[[:space:]]+)?cr[eé]dito|credito",
      exactPattern:
         "^[[:space:]]*(cart[aã]o[[:space:]]+(de[[:space:]]+)?cr[eé]dito|credito)[[:space:]]*$",
   },
   {
      paymentMethod: "debit_card",
      pattern: "cart[aã]o[[:space:]]+(de[[:space:]]+)?d[eé]bito|debito",
      exactPattern:
         "^[[:space:]]*(cart[aã]o[[:space:]]+(de[[:space:]]+)?d[eé]bito|debito)[[:space:]]*$",
   },
   {
      paymentMethod: "boleto",
      pattern: "boleto",
      exactPattern: "^[[:space:]]*boleto[[:space:]]*$",
   },
   {
      paymentMethod: "cash",
      pattern: "dinheiro|esp[eé]cie",
      exactPattern:
         "^[[:space:]]*(dinheiro|em[[:space:]]+dinheiro|esp[eé]cie)[[:space:]]*$",
   },
   {
      paymentMethod: "transfer",
      pattern: "transfer[eê]ncia|ted|doc",
      exactPattern: "^[[:space:]]*(transfer[eê]ncia|ted|doc)[[:space:]]*$",
   },
   {
      paymentMethod: "cheque",
      pattern: "cheque",
      exactPattern: "^[[:space:]]*cheque[[:space:]]*$",
   },
];

const casesSql = paymentMatchers
   .map(
      (matcher) =>
         `WHEN description ~* '${matcher.pattern.replace(/'/g, "''")}' THEN '${matcher.paymentMethod}'`,
   )
   .join("\n            ");

const exactCasesSql = paymentMatchers
   .map(
      (matcher) =>
         `WHEN description ~* '${matcher.exactPattern.replace(/'/g, "''")}' THEN true`,
   )
   .join("\n            ");

const matchedCte = `
   WITH candidates AS (
      SELECT
         id,
         team_id,
         name,
         description,
         date,
         amount,
         CASE
            ${casesSql}
            ELSE NULL
         END AS suggested_payment_method,
         CASE
            ${exactCasesSql}
            ELSE false
         END AS exact_description
      FROM finance.transactions
      WHERE payment_method IS NULL
        AND description IS NOT NULL
        AND btrim(description) <> ''
   ), matched AS (
      SELECT *
      FROM candidates
      WHERE suggested_payment_method IS NOT NULL
   )
`;

if (!apply) {
   const rows = await db.execute(
      sql.raw(`${matchedCte}
      SELECT
         suggested_payment_method AS "suggestedPaymentMethod",
         count(*)::int AS count,
         count(*) FILTER (WHERE exact_description)::int AS "exactDescriptionCount",
         json_agg(
            json_build_object(
               'id', id,
               'teamId', team_id,
               'name', name,
               'date', date,
               'amount', amount,
               'description', description,
               'clearDescription', exact_description
            )
            ORDER BY date DESC
         ) AS samples
      FROM (
         SELECT *, row_number() OVER (PARTITION BY suggested_payment_method ORDER BY date DESC, id) AS rn
         FROM matched
      ) ranked
      WHERE rn <= 20
      GROUP BY suggested_payment_method
      ORDER BY count DESC;
   `),
   );
   console.log(JSON.stringify({ mode: "dry-run", rows }, null, 2));
   await client.end();
   process.exit(0);
}

const updated = await db.execute(
   sql.raw(`${matchedCte}
   UPDATE finance.transactions AS t
   SET
      payment_method = matched.suggested_payment_method::finance.payment_method,
      description = CASE
         WHEN ${clearExactDescription ? "matched.exact_description" : "false"} THEN NULL
         ELSE t.description
      END,
      updated_at = now()
   FROM matched
   WHERE t.id = matched.id
   RETURNING
      t.id,
      t.team_id AS "teamId",
      t.name,
      t.payment_method AS "paymentMethod",
      t.description;
`),
);

console.log(
   JSON.stringify(
      {
         mode: "apply",
         clearExactDescription,
         updatedCount: updated.length,
         updated,
      },
      null,
      2,
   ),
);
await client.end();
