import { z } from "zod";
import {
   type OFXDocument,
   type OFXHeader,
   ofxHeaderSchema,
   ofxResponseSchema,
} from "./schemas";
import { decodeEntities, toArray } from "./utils";

interface TagStackItem {
   name: string;
   content: Record<string, unknown>;
}

const CHARSET_MAP: Record<string, string> = {
   "1252": "windows-1252",
   "WINDOWS-1252": "windows-1252",
   CP1252: "windows-1252",
   "8859-1": "windows-1252",
   "ISO-8859-1": "windows-1252",
   LATIN1: "windows-1252",
   "LATIN-1": "windows-1252",
   "UTF-8": "utf-8",
   UTF8: "utf-8",
   NONE: "utf-8",
   "": "utf-8",
};

export function getEncodingFromCharset(charset?: string): string {
   if (!charset) return "utf-8";
   const normalized = charset.toUpperCase().trim();
   return CHARSET_MAP[normalized] ?? "windows-1252";
}

function addToContent(
   content: Record<string, unknown>,
   key: string,
   value: unknown,
): void {
   // Prevent prototype pollution
   if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return;
   }

   const existing = content[key];
   if (existing !== undefined) {
      if (Array.isArray(existing)) {
         existing.push(value);
      } else {
         content[key] = [existing, value];
      }
   } else {
      content[key] = value;
   }
}

export function sgmlToObject(sgml: string): Record<string, unknown> {
   const result: Record<string, unknown> = {};
   const tagStack: TagStackItem[] = [{ content: result, name: "root" }];
   const stackMap = new Map<string, number>([["root", 0]]);

   const hasSpecialContent = sgml.includes("<?") || sgml.includes("<!--");
   const cleanSgml = hasSpecialContent
      ? sgml.replace(/<\?.*?\?>|<!--.*?-->/gs, "").trim()
      : sgml.trim();

   const tagRegex = /<(\/?)([\w.]+)>([^<]*)/g;
   let match: RegExpExecArray | null = tagRegex.exec(cleanSgml);

   while (match !== null) {
      const isClosing = match[1];
      const tagName = match[2];
      const textContent = match[3]?.trim() ?? "";

      if (!tagName) {
         match = tagRegex.exec(cleanSgml);
         continue;
      }

      const current = tagStack[tagStack.length - 1];
      if (!current) {
         match = tagRegex.exec(cleanSgml);
         continue;
      }

      if (isClosing) {
         const stackIndex = stackMap.get(tagName);
         if (stackIndex !== undefined && stackIndex > 0) {
            for (let i = tagStack.length - 1; i >= stackIndex; i--) {
               const item = tagStack[i];
               if (item) stackMap.delete(item.name);
            }
            tagStack.length = stackIndex;
         }
      } else if (textContent) {
         const decoded = textContent.includes("&")
            ? decodeEntities(textContent)
            : textContent;
         addToContent(current.content, tagName, decoded);
      } else {
         const newObj: Record<string, unknown> = {};
         addToContent(current.content, tagName, newObj);
         stackMap.set(tagName, tagStack.length);
         tagStack.push({ content: newObj, name: tagName });
      }

      match = tagRegex.exec(cleanSgml);
   }

   return result;
}

function generateFitId(txn: Record<string, unknown>, index: number): string {
   const date = String(txn.DTPOSTED ?? "");
   const amount = String(txn.TRNAMT ?? "0");
   const name = String(txn.NAME ?? txn.MEMO ?? "");
   const input = `${date}:${amount}:${name}:${index}`;
   let hash = 0;
   for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash = hash | 0; // Convert to 32-bit integer
   }
   return `AUTO${Math.abs(hash).toString(16).toUpperCase().padStart(8, "0")}`;
}

function normalizeResponseArray(
   msgs: Record<string, unknown>,
   responseKey: string,
   statementKey: string,
): void {
   const responses = msgs[responseKey];
   if (!responses) return;

   for (const response of toArray(responses)) {
      const stmt = (response as Record<string, unknown>)?.[statementKey] as
         | Record<string, unknown>
         | undefined;
      const tranList = stmt?.BANKTRANLIST as
         | Record<string, unknown>
         | undefined;
      if (tranList?.STMTTRN !== undefined) {
         tranList.STMTTRN = toArray(tranList.STMTTRN);
         const transactions = tranList.STMTTRN as Array<
            Record<string, unknown>
         >;
         transactions.forEach((txn, idx) => {
            if (!txn.FITID) {
               txn.FITID = generateFitId(txn, idx);
            }
         });
      }
   }
}

function normalizeSignOn(data: Record<string, unknown>): void {
   const ofx = data.OFX as Record<string, unknown> | undefined;
   if (!ofx) return;

   const signonMsgs = ofx.SIGNONMSGSRSV1 as Record<string, unknown> | undefined;
   const sonrs = signonMsgs?.SONRS as Record<string, unknown> | undefined;
   if (!sonrs) return;

   const status = sonrs.STATUS as Record<string, unknown> | undefined;
   if (!status) return;

   if (!sonrs.DTSERVER && status.DTSERVER) {
      sonrs.DTSERVER = status.DTSERVER;
      delete status.DTSERVER;
   }

   if (!sonrs.LANGUAGE && status.LANGUAGE) {
      sonrs.LANGUAGE = status.LANGUAGE;
      delete status.LANGUAGE;
   }
}

export function normalizeTransactions(
   data: Record<string, unknown>,
): Record<string, unknown> {
   const ofx = data.OFX as Record<string, unknown> | undefined;
   if (!ofx) return data;

   normalizeSignOn(data);

   const bankMsgs = ofx.BANKMSGSRSV1 as Record<string, unknown> | undefined;
   if (bankMsgs) {
      normalizeResponseArray(bankMsgs, "STMTTRNRS", "STMTRS");
   }

   const ccMsgs = ofx.CREDITCARDMSGSRSV1 as Record<string, unknown> | undefined;
   if (ccMsgs) {
      normalizeResponseArray(ccMsgs, "CCSTMTTRNRS", "CCSTMTRS");
   }

   return data;
}

export function parseHeader(content: string): {
   header: OFXHeader;
   body: string;
} {
   const lines = content.split(/\r?\n/);
   const header: Record<string, string> = {};
   let bodyStartIndex = 0;

   for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? "";

      if (line.startsWith("<?xml") || line.startsWith("<OFX>")) {
         bodyStartIndex = i;
         break;
      }

      const match = line.match(/^(\w+):(.*)$/);
      if (match?.[1] && match[2] !== undefined) {
         header[match[1]] = match[2];
      }

      if (line === "" && Object.keys(header).length > 0) {
         bodyStartIndex = i + 1;
         break;
      }
   }

   const body = lines.slice(bodyStartIndex).join("\n");
   return { body, header: ofxHeaderSchema.parse(header) };
}

export type ParseResult<T> =
   | { success: true; data: T }
   | { success: false; error: z.ZodError };

export function parse(content: string): ParseResult<OFXDocument> {
   try {
      if (typeof content !== "string") {
         return {
            error: new z.ZodError([
               {
                  code: "invalid_type",
                  expected: "string",
                  message: `Expected string, received ${typeof content}`,
                  path: [],
               },
            ]),
            success: false,
         };
      }

      if (content.trim() === "") {
         return {
            error: new z.ZodError([
               {
                  code: "custom",
                  message: "Content cannot be empty",
                  path: [],
               },
            ]),
            success: false,
         };
      }

      const { header, body } = parseHeader(content);
      const rawData = sgmlToObject(body);
      const normalizedData = normalizeTransactions(rawData);

      const parseResult = ofxResponseSchema.safeParse(normalizedData.OFX);

      if (!parseResult.success) {
         return { error: parseResult.error, success: false };
      }

      return {
         data: { header, OFX: parseResult.data },
         success: true,
      };
   } catch (err) {
      if (err instanceof z.ZodError) {
         return { error: err, success: false };
      }
      throw err;
   }
}

export function parseOrThrow(content: string): OFXDocument {
   const result = parse(content);
   if (!result.success) {
      throw result.error;
   }
   return result.data;
}

function isValidUtf8(buffer: Uint8Array): boolean {
   let i = 0;
   while (i < buffer.length) {
      const byte = buffer[i];
      if (byte === undefined) break;

      if (byte <= 0x7f) {
         i++;
      } else if ((byte & 0xe0) === 0xc0) {
         const b1 = buffer[i + 1];
         if (i + 1 >= buffer.length || b1 === undefined || (b1 & 0xc0) !== 0x80)
            return false;
         i += 2;
      } else if ((byte & 0xf0) === 0xe0) {
         const b1 = buffer[i + 1];
         const b2 = buffer[i + 2];
         if (
            i + 2 >= buffer.length ||
            b1 === undefined ||
            b2 === undefined ||
            (b1 & 0xc0) !== 0x80 ||
            (b2 & 0xc0) !== 0x80
         )
            return false;
         i += 3;
      } else if ((byte & 0xf8) === 0xf0) {
         const b1 = buffer[i + 1];
         const b2 = buffer[i + 2];
         const b3 = buffer[i + 3];
         if (
            i + 3 >= buffer.length ||
            b1 === undefined ||
            b2 === undefined ||
            b3 === undefined ||
            (b1 & 0xc0) !== 0x80 ||
            (b2 & 0xc0) !== 0x80 ||
            (b3 & 0xc0) !== 0x80
         )
            return false;
         i += 4;
      } else {
         return false;
      }
   }
   return true;
}

function hasUtf8MultiByte(buffer: Uint8Array): boolean {
   for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (byte !== undefined && byte > 0x7f) {
         return true;
      }
   }
   return false;
}

function parseHeaderFromBuffer(buffer: Uint8Array): {
   header: OFXHeader;
   encoding: string;
} {
   const maxHeaderSize = Math.min(buffer.length, 1000);
   const headerSection = new TextDecoder("windows-1252").decode(
      buffer.slice(0, maxHeaderSize),
   );

   const header: Record<string, string> = {};

   const singleLineMatch = headerSection.match(
      /^(OFXHEADER:\d+.*?)(?=<OFX|<\?xml)/is,
   );
   if (singleLineMatch?.[1]) {
      const headerPart = singleLineMatch[1];
      const fieldRegex = /(\w+):([^\s<]+)/g;
      let fieldMatch = fieldRegex.exec(headerPart);
      while (fieldMatch !== null) {
         const key = fieldMatch[1];
         const value = fieldMatch[2];
         if (key && value !== undefined) {
            header[key] = value;
         }
         fieldMatch = fieldRegex.exec(headerPart);
      }
   } else {
      const lines = headerSection.split(/\r?\n/);
      for (const line of lines) {
         const trimmed = line.trim();
         if (trimmed.startsWith("<?xml") || trimmed.startsWith("<OFX")) {
            break;
         }

         const match = trimmed.match(/^(\w+):(.*)$/);
         if (match?.[1] && match[2] !== undefined) {
            header[match[1]] = match[2];
         }

         if (trimmed === "" && Object.keys(header).length > 0) {
            break;
         }
      }
   }

   const parsedHeader = ofxHeaderSchema.parse(header);
   let encoding = getEncodingFromCharset(parsedHeader.CHARSET);

   if (
      encoding !== "utf-8" &&
      hasUtf8MultiByte(buffer) &&
      isValidUtf8(buffer)
   ) {
      encoding = "utf-8";
   }

   return { encoding, header: parsedHeader };
}

/**
 * Decodes an OFX buffer to a string with proper charset detection.
 * Automatically detects encoding from OFX header (CHARSET field).
 */
export function decodeOfxBuffer(buffer: Uint8Array): string {
   const { encoding } = parseHeaderFromBuffer(buffer);
   const decoder = new TextDecoder(encoding as Bun.Encoding);
   return decoder.decode(buffer);
}

export function parseBuffer(buffer: Uint8Array): ParseResult<OFXDocument> {
   try {
      if (!(buffer instanceof Uint8Array)) {
         return {
            error: new z.ZodError([
               {
                  code: "invalid_type",
                  expected: "object",
                  message: "Expected Uint8Array",
                  path: [],
               },
            ]),
            success: false,
         };
      }

      if (buffer.length === 0) {
         return {
            error: new z.ZodError([
               {
                  code: "custom",
                  message: "Buffer cannot be empty",
                  path: [],
               },
            ]),
            success: false,
         };
      }

      const content = decodeOfxBuffer(buffer);
      return parse(content);
   } catch (err) {
      if (err instanceof z.ZodError) {
         return { error: err, success: false };
      }
      throw err;
   }
}

export function parseBufferOrThrow(buffer: Uint8Array): OFXDocument {
   const result = parseBuffer(buffer);
   if (!result.success) {
      throw result.error;
   }
   return result.data;
}
