import { z } from "zod";
import { accountTypeSchema, transactionTypeSchema } from "./schemas";
import { escapeOfxText, formatAmount, formatOfxDate } from "./utils";

export const generateHeaderOptionsSchema = z
   .object({
      version: z.string().optional(),
      encoding: z.string().optional(),
      charset: z.string().optional(),
   })
   .optional();

export type GenerateHeaderOptions = z.infer<typeof generateHeaderOptionsSchema>;

export function generateHeader(options?: GenerateHeaderOptions): string {
   const version = options?.version ?? "100";
   const encoding = options?.encoding ?? "USASCII";
   const charset = options?.charset ?? "1252";

   return [
      "OFXHEADER:100",
      "DATA:OFXSGML",
      `VERSION:${version}`,
      "SECURITY:NONE",
      `ENCODING:${encoding}`,
      `CHARSET:${charset}`,
      "COMPRESSION:NONE",
      "OLDFILEUID:NONE",
      "NEWFILEUID:NONE",
      "",
   ].join("\n");
}

export const generateTransactionInputSchema = z.object({
   type: transactionTypeSchema,
   datePosted: z.date(),
   amount: z.number(),
   fitId: z.string().min(1),
   name: z.string().optional(),
   memo: z.string().optional(),
   checkNum: z.string().optional(),
   refNum: z.string().optional(),
});

export type GenerateTransactionInput = z.infer<
   typeof generateTransactionInputSchema
>;

function generateTransaction(trn: GenerateTransactionInput): string {
   const lines: string[] = [
      "<STMTTRN>",
      `<TRNTYPE>${trn.type}`,
      `<DTPOSTED>${formatOfxDate(trn.datePosted)}`,
      `<TRNAMT>${formatAmount(trn.amount)}`,
      `<FITID>${escapeOfxText(trn.fitId)}`,
   ];

   if (trn.name) {
      lines.push(`<NAME>${escapeOfxText(trn.name)}`);
   }
   if (trn.memo) {
      lines.push(`<MEMO>${escapeOfxText(trn.memo)}`);
   }
   if (trn.checkNum) {
      lines.push(`<CHECKNUM>${escapeOfxText(trn.checkNum)}`);
   }
   if (trn.refNum) {
      lines.push(`<REFNUM>${escapeOfxText(trn.refNum)}`);
   }

   lines.push("</STMTTRN>");
   return lines.join("\n");
}

const balanceSchema = z.object({
   amount: z.number(),
   asOfDate: z.date(),
});

const financialInstitutionSchema = z.object({
   org: z.string().optional(),
   fid: z.string().optional(),
});

export const generateBankStatementOptionsSchema = z.object({
   bankId: z.string().min(1),
   accountId: z.string().min(1),
   accountType: accountTypeSchema,
   currency: z.string().min(1),
   startDate: z.date(),
   endDate: z.date(),
   transactions: z.array(generateTransactionInputSchema),
   ledgerBalance: balanceSchema.optional(),
   availableBalance: balanceSchema.optional(),
   financialInstitution: financialInstitutionSchema.optional(),
   language: z.string().optional(),
});

export type GenerateBankStatementOptions = z.infer<
   typeof generateBankStatementOptionsSchema
>;

export function generateBankStatement(
   options: GenerateBankStatementOptions,
): string {
   const parts: string[] = [generateHeader()];
   const serverDate = formatOfxDate(new Date());
   const language = options.language ?? "POR";

   parts.push(`<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${serverDate}
<LANGUAGE>${language}`);

   if (options.financialInstitution) {
      parts.push("<FI>");
      if (options.financialInstitution.org) {
         parts.push(`<ORG>${escapeOfxText(options.financialInstitution.org)}`);
      }
      if (options.financialInstitution.fid) {
         parts.push(`<FID>${escapeOfxText(options.financialInstitution.fid)}`);
      }
      parts.push("</FI>");
   }

   parts.push(`</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>0
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>${options.currency}
<BANKACCTFROM>
<BANKID>${escapeOfxText(options.bankId)}
<ACCTID>${escapeOfxText(options.accountId)}
<ACCTTYPE>${options.accountType}
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${formatOfxDate(options.startDate)}
<DTEND>${formatOfxDate(options.endDate)}`);

   for (const trn of options.transactions) {
      parts.push(generateTransaction(trn));
   }

   parts.push("</BANKTRANLIST>");

   if (options.ledgerBalance) {
      parts.push(`<LEDGERBAL>
<BALAMT>${formatAmount(options.ledgerBalance.amount)}
<DTASOF>${formatOfxDate(options.ledgerBalance.asOfDate)}
</LEDGERBAL>`);
   }

   if (options.availableBalance) {
      parts.push(`<AVAILBAL>
<BALAMT>${formatAmount(options.availableBalance.amount)}
<DTASOF>${formatOfxDate(options.availableBalance.asOfDate)}
</AVAILBAL>`);
   }

   parts.push(`</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`);

   return parts.join("\n");
}

export const generateCreditCardStatementOptionsSchema = z.object({
   accountId: z.string().min(1),
   currency: z.string().min(1),
   startDate: z.date(),
   endDate: z.date(),
   transactions: z.array(generateTransactionInputSchema),
   ledgerBalance: balanceSchema.optional(),
   availableBalance: balanceSchema.optional(),
   financialInstitution: financialInstitutionSchema.optional(),
   language: z.string().optional(),
});

export type GenerateCreditCardStatementOptions = z.infer<
   typeof generateCreditCardStatementOptionsSchema
>;

export function generateCreditCardStatement(
   options: GenerateCreditCardStatementOptions,
): string {
   const parts: string[] = [generateHeader()];
   const serverDate = formatOfxDate(new Date());
   const language = options.language ?? "POR";

   parts.push(`<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${serverDate}
<LANGUAGE>${language}`);

   if (options.financialInstitution) {
      parts.push("<FI>");
      if (options.financialInstitution.org) {
         parts.push(`<ORG>${escapeOfxText(options.financialInstitution.org)}`);
      }
      if (options.financialInstitution.fid) {
         parts.push(`<FID>${escapeOfxText(options.financialInstitution.fid)}`);
      }
      parts.push("</FI>");
   }

   parts.push(`</SONRS>
</SIGNONMSGSRSV1>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<TRNUID>0
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<CCSTMTRS>
<CURDEF>${options.currency}
<CCACCTFROM>
<ACCTID>${escapeOfxText(options.accountId)}
</CCACCTFROM>
<BANKTRANLIST>
<DTSTART>${formatOfxDate(options.startDate)}
<DTEND>${formatOfxDate(options.endDate)}`);

   for (const trn of options.transactions) {
      parts.push(generateTransaction(trn));
   }

   parts.push("</BANKTRANLIST>");

   if (options.ledgerBalance) {
      parts.push(`<LEDGERBAL>
<BALAMT>${formatAmount(options.ledgerBalance.amount)}
<DTASOF>${formatOfxDate(options.ledgerBalance.asOfDate)}
</LEDGERBAL>`);
   }

   if (options.availableBalance) {
      parts.push(`<AVAILBAL>
<BALAMT>${formatAmount(options.availableBalance.amount)}
<DTASOF>${formatOfxDate(options.availableBalance.asOfDate)}
</AVAILBAL>`);
   }

   parts.push(`</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>`);

   return parts.join("\n");
}
