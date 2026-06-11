import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { evalite } from "evalite";
import type { extractContractWithAi } from "../src/extraction/contract-ai-extraction";
import { goldenCases, type GoldenCase } from "./contract-extraction-dataset";

const execFileAsync = promisify(execFile);
const childScript = join(import.meta.dirname, "run-contract-extraction.ts");

type ExtractionOutput = Awaited<ReturnType<typeof extractContractWithAi>>;

type Expected = GoldenCase["expected"] & { __sourceText: string };

function normalizeText(value: unknown) {
   return JSON.stringify(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9%.,/$\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
}

function includesAll(haystack: unknown, terms: Array<string>) {
   const text = normalizeText(haystack);
   return terms.every((term) => text.includes(normalizeText(term)));
}

function ratio(matches: Array<boolean>) {
   if (matches.length === 0) return 1;
   return matches.filter(Boolean).length / matches.length;
}

function bestScore<T>(items: Array<T>, scorer: (item: T) => number) {
   if (items.length === 0) return 0;
   return Math.max(...items.map(scorer));
}

function average(scores: Array<number>) {
   if (scores.length === 0) return 1;
   return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function scoreTitleAndType(output: ExtractionOutput, expected: Expected) {
   return average([
      includesAll(output.document.title.value, expected.titleIncludes) ? 1 : 0,
      includesAll(output.document.typeLabel.value, expected.typeIncludes)
         ? 1
         : 0,
   ]);
}

function scoreParties(output: ExtractionOutput, expected: Expected) {
   return average(
      expected.parties.map((party) =>
         bestScore(output.parties, (candidate) =>
            average([
               includesAll(candidate.role, [party.roleIncludes]) ? 1 : 0,
               includesAll(candidate.name.value, [party.nameIncludes]) ? 1 : 0,
               candidate.kind !== "unknown" ? 1 : 0,
            ]),
         ),
      ),
   );
}

function scoreMoney(output: ExtractionOutput, expected: Expected) {
   return average(
      expected.monetaryTerms.map((term) =>
         bestScore(output.monetaryTerms, (candidate) =>
            average([
               includesAll(candidate.label, [term.labelIncludes]) ? 1 : 0,
               candidate.amountCents === term.amountCents ? 1 : 0,
               term.recurrenceIncludes
                  ? includesAll(candidate.recurrence, [term.recurrenceIncludes])
                     ? 1
                     : 0
                  : 1,
               candidate.currency === "BRL" || candidate.currency === "R$"
                  ? 1
                  : 0.5,
            ]),
         ),
      ),
   );
}

function scoreDates(output: ExtractionOutput, expected: Expected) {
   return average(
      expected.dates.map((date) =>
         bestScore(output.dates, (candidate) =>
            average([
               includesAll(candidate.label, [date.labelIncludes]) ? 1 : 0,
               includesAll(candidate.value.value, [date.valueIncludes]) ? 1 : 0,
            ]),
         ),
      ),
   );
}

function scoreObligations(output: ExtractionOutput, expected: Expected) {
   return average(
      expected.obligations.map((obligation) =>
         bestScore(output.obligations, (candidate) =>
            average([
               includesAll(candidate.party, [obligation.partyIncludes]) ? 1 : 0,
               includesAll(candidate.title, obligation.titleIncludes) ? 1 : 0,
               obligation.offsetDays === undefined
                  ? 1
                  : candidate.offsetDays === obligation.offsetDays
                    ? 1
                    : 0,
               obligation.calendarBasis === undefined
                  ? 1
                  : candidate.calendarBasis === obligation.calendarBasis
                    ? 1
                    : 0,
            ]),
         ),
      ),
   );
}

function scoreOperationalFlags(output: ExtractionOutput, expected: Expected) {
   return average(
      expected.operationalFlags.map((flag) =>
         bestScore(output.operationalFlags, (candidate) =>
            includesAll(candidate, flag.labelIncludes) ? 1 : 0,
         ),
      ),
   );
}

function scoreSignatures(output: ExtractionOutput, expected: Expected) {
   return average(
      expected.signatures.map((signature) =>
         bestScore(output.signatures, (candidate) =>
            average([
               signature.signerIncludes
                  ? includesAll(candidate.signerName, [
                       signature.signerIncludes,
                    ])
                     ? 1
                     : 0
                  : 1,
               signature.providerIncludes
                  ? includesAll(candidate.provider, [
                       signature.providerIncludes,
                    ])
                     ? 1
                     : 0
                  : 1,
               signature.statusIncludes
                  ? includesAll(candidate, [signature.statusIncludes])
                     ? 1
                     : 0
                  : 1,
            ]),
         ),
      ),
   );
}

function scoreFindings(output: ExtractionOutput, expected: Expected) {
   return average(
      expected.findings.map((finding) =>
         bestScore(output.findings, (candidate) =>
            average([
               includesAll(candidate.category, finding.categoryIncludes)
                  ? 1
                  : 0,
               includesAll(
                  `${candidate.title} ${candidate.description} ${candidate.suggestedAction ?? ""}`,
                  finding.titleOrDescriptionIncludes,
               )
                  ? 1
                  : 0,
               finding.severity
                  ? candidate.severity === finding.severity
                     ? 1
                     : 0.5
                  : 1,
            ]),
         ),
      ),
   );
}

function collectEvidence(output: ExtractionOutput) {
   return [
      output.document.title.evidence,
      output.document.typeLabel.evidence,
      output.document.summary.evidence,
      output.document.pageCount.evidence,
      output.document.hasAttachments.evidence,
      ...output.parties.flatMap((party) => [
         party.name.evidence,
         party.documentNumberMasked.evidence,
         party.email.evidence,
         party.phone.evidence,
         party.address.evidence,
      ]),
      ...output.dates.map((date) => date.value.evidence),
      ...output.monetaryTerms.map((term) => term.evidence),
      ...output.operationalFlags.map((flag) => flag.evidence),
      ...output.obligations.map((obligation) => obligation.evidence),
      ...output.signatures.map((signature) => signature.evidence),
      ...output.findings.map((finding) => finding.evidence),
   ].flat();
}

function scoreEvidenceGrounding(output: ExtractionOutput, sourceText: string) {
   const source = normalizeText(sourceText);
   const evidence = collectEvidence(output).filter((item) => item.quote.trim());
   if (evidence.length === 0) return 0;

   return ratio(
      evidence.map((item) => {
         const quote = normalizeText(item.quote);
         if (quote.length < 8) return false;
         if (source.includes(quote)) return true;

         const quoteTerms = quote.split(" ").filter((term) => term.length > 3);
         if (quoteTerms.length === 0) return false;
         return (
            quoteTerms.filter((term) => source.includes(term)).length /
               quoteTerms.length >=
            0.75
         );
      }),
   );
}

function scoreNoHallucination(output: ExtractionOutput, expected: Expected) {
   const text = normalizeText(output);
   const forbiddenHits = expected.forbidden.filter((term) =>
      text.includes(normalizeText(term)),
   );

   const expectedAmounts = new Set(
      expected.monetaryTerms.map((term) => term.amountCents),
   );
   const unexpectedAmounts = output.monetaryTerms.filter(
      (term) =>
         term.amountCents !== null && !expectedAmounts.has(term.amountCents),
   );

   return average([
      forbiddenHits.length === 0 ? 1 : 0,
      unexpectedAmounts.length === 0
         ? 1
         : Math.max(0, 1 - unexpectedAmounts.length / 3),
   ]);
}

async function runExtraction(fileNames: Array<string>) {
   let lastError: unknown;

   for (let attempt = 1; attempt <= 5; attempt++) {
      try {
         const { stdout } = await execFileAsync(
            "bun",
            [childScript, ...fileNames],
            {
               maxBuffer: 1024 * 1024 * 10,
               timeout: 180_000,
            },
         );

         return JSON.parse(stdout) as ExtractionOutput;
      } catch (error) {
         lastError = error;
      }
   }

   throw lastError;
}

evalite("contract-ai-extraction golden ERP set", {
   data: goldenCases.map((testCase) => ({
      input: { id: testCase.id, fileNames: testCase.inputFiles },
      expected: { ...testCase.expected, __sourceText: testCase.sourceText },
   })),
   task: async (input) => runExtraction(input.fileNames),
   scorers: [
      {
         name: "document title/type",
         scorer: ({ output, expected }) =>
            scoreTitleAndType(output, expected as Expected),
      },
      {
         name: "parties exact-ish",
         scorer: ({ output, expected }) =>
            scoreParties(output, expected as Expected),
      },
      {
         name: "money exact cents",
         scorer: ({ output, expected }) =>
            scoreMoney(output, expected as Expected),
      },
      {
         name: "dates deadlines",
         scorer: ({ output, expected }) =>
            scoreDates(output, expected as Expected),
      },
      {
         name: "obligations structured",
         scorer: ({ output, expected }) =>
            scoreObligations(output, expected as Expected),
      },
      {
         name: "operational flags",
         scorer: ({ output, expected }) =>
            scoreOperationalFlags(output, expected as Expected),
      },
      {
         name: "signatures",
         scorer: ({ output, expected }) =>
            scoreSignatures(output, expected as Expected),
      },
      {
         name: "findings/risk",
         scorer: ({ output, expected }) =>
            scoreFindings(output, expected as Expected),
      },
      {
         name: "evidence grounded",
         scorer: ({ output, expected }) =>
            scoreEvidenceGrounding(output, (expected as Expected).__sourceText),
      },
      {
         name: "no hallucination",
         scorer: ({ output, expected }) =>
            scoreNoHallucination(output, expected as Expected),
      },
   ],
});
