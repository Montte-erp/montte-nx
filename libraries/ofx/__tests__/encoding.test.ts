import { describe, expect, it } from "bun:test";
import {
   getEncodingFromCharset,
   parseBuffer,
   parseBufferOrThrow,
} from "../src/parser";

describe("getEncodingFromCharset", () => {
   it("returns utf-8 for empty charset", () => {
      expect(getEncodingFromCharset("")).toBe("utf-8");
      expect(getEncodingFromCharset(undefined)).toBe("utf-8");
   });

   it("returns utf-8 for NONE charset", () => {
      expect(getEncodingFromCharset("NONE")).toBe("utf-8");
   });

   it("returns windows-1252 for 1252 charset", () => {
      expect(getEncodingFromCharset("1252")).toBe("windows-1252");
      expect(getEncodingFromCharset("WINDOWS-1252")).toBe("windows-1252");
      expect(getEncodingFromCharset("CP1252")).toBe("windows-1252");
   });

   it("returns windows-1252 for Latin-1 variants (per WHATWG spec)", () => {
      expect(getEncodingFromCharset("8859-1")).toBe("windows-1252");
      expect(getEncodingFromCharset("ISO-8859-1")).toBe("windows-1252");
      expect(getEncodingFromCharset("LATIN1")).toBe("windows-1252");
      expect(getEncodingFromCharset("LATIN-1")).toBe("windows-1252");
   });

   it("handles case insensitivity", () => {
      expect(getEncodingFromCharset("utf-8")).toBe("utf-8");
      expect(getEncodingFromCharset("UTF-8")).toBe("utf-8");
      expect(getEncodingFromCharset("latin1")).toBe("windows-1252");
   });

   it("returns windows-1252 as fallback for unknown charsets", () => {
      expect(getEncodingFromCharset("UNKNOWN")).toBe("windows-1252");
   });
});

describe("parseBuffer", () => {
   const createOFXBuffer = (content: string, charset = "UTF-8"): Uint8Array => {
      const header = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:${charset}
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

`;
      const full = header + content;
      return new TextEncoder().encode(full);
   };

   const minimalOFXBody = `<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20231215120000[-3:BRT]
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
</OFX>`;

   it("parses UTF-8 encoded buffer", () => {
      const buffer = createOFXBuffer(minimalOFXBody, "UTF-8");
      const result = parseBuffer(buffer);
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.data.OFX.SIGNONMSGSRSV1.SONRS.LANGUAGE).toBe("POR");
      }
   });

   it("handles Portuguese characters in UTF-8", () => {
      const bodyWithPortuguese = `<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20231215120000[-3:BRT]
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>001
<ACCTID>12345
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20231201
<DTEND>20231231
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20231215
<TRNAMT>-100.00
<FITID>TXN001
<NAME>Compra no Cartão
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1000.00
<DTASOF>20231215
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
      const buffer = createOFXBuffer(bodyWithPortuguese, "UTF-8");
      const result = parseBuffer(buffer);
      expect(result.success).toBe(true);
      if (result.success) {
         const stmtrs = result.data.OFX.BANKMSGSRSV1?.STMTTRNRS;
         if (stmtrs && !Array.isArray(stmtrs)) {
            const txns = stmtrs.STMTRS?.BANKTRANLIST?.STMTTRN ?? [];
            expect(txns[0]?.NAME).toBe("Compra no Cartão");
         }
      }
   });

   it("returns error for empty buffer", () => {
      const result = parseBuffer(new Uint8Array(0));
      expect(result.success).toBe(false);
      if (!result.success) {
         expect(result.error.issues[0]?.message).toContain("empty");
      }
   });

   it("returns error for invalid input type", () => {
      const result = parseBuffer("not a buffer" as unknown as Uint8Array);
      expect(result.success).toBe(false);
   });
});

describe("parseBufferOrThrow", () => {
   const createOFXBuffer = (charset = "UTF-8"): Uint8Array => {
      const content = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:${charset}
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20231215120000[-3:BRT]
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
</OFX>`;
      return new TextEncoder().encode(content);
   };

   it("returns document for valid buffer", () => {
      const buffer = createOFXBuffer();
      const doc = parseBufferOrThrow(buffer);
      expect(doc.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE).toBe("0");
   });

   it("throws for empty buffer", () => {
      expect(() => parseBufferOrThrow(new Uint8Array(0))).toThrow();
   });

   it("throws for invalid buffer", () => {
      const buffer = new TextEncoder().encode("invalid content");
      expect(() => parseBufferOrThrow(buffer)).toThrow();
   });
});

describe("UTF-8 auto-detection", () => {
   it("detects UTF-8 even when charset declares 1252", () => {
      const content = `OFXHEADER:100DATA:OFXSGMLVERSION:102SECURITY:NONEENCODING:USASCIICHARSET:1252COMPRESSION:NONEOLDFILEUID:NONENEWFILEUID:NONE
<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20231215120000
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>001
<ACCTID>12345
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20231201
<DTEND>20231231
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20231215
<TRNAMT>-50.00
<FITID>001
<NAME>Transação UTF-8
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1000.00
<DTASOF>20231215
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
      const buffer = new TextEncoder().encode(content);
      const result = parseBuffer(buffer);

      expect(result.success).toBe(true);
      if (result.success) {
         const stmtrs = result.data.OFX.BANKMSGSRSV1?.STMTTRNRS;
         if (stmtrs && !Array.isArray(stmtrs)) {
            const txns = stmtrs.STMTRS?.BANKTRANLIST?.STMTTRN ?? [];
            expect(txns[0]?.NAME).toBe("Transação UTF-8");
         }
      }
   });
});
