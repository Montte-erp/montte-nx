import { describe, expect, it } from "bun:test";
import {
	detectAmountFormat,
	parseAmount,
	parseCsvContent,
	parseDate,
	previewCsv,
} from "../src/parser";

describe("parseAmount", () => {
	describe("decimal-comma format (Brazilian)", () => {
		it("parses positive amounts with comma decimal", () => {
			expect(parseAmount("1.234,56", "decimal-comma")).toBe(1234.56);
		});

		it("parses negative amounts", () => {
			expect(parseAmount("-1.234,56", "decimal-comma")).toBe(-1234.56);
		});

		it("handles amounts without thousands separator", () => {
			expect(parseAmount("123,45", "decimal-comma")).toBe(123.45);
		});

		it("handles whole numbers with thousands separator", () => {
			expect(parseAmount("1.000", "decimal-comma")).toBe(1000);
		});

		it("handles whole numbers without decimal", () => {
			expect(parseAmount("500", "decimal-comma")).toBe(500);
		});

		it("strips R$ currency symbol", () => {
			expect(parseAmount("R$ 1.234,56", "decimal-comma")).toBe(1234.56);
		});

		it("strips R$ with negative value", () => {
			expect(parseAmount("R$ -500,00", "decimal-comma")).toBe(-500);
		});

		it("handles whitespace around value", () => {
			expect(parseAmount("  1.234,56  ", "decimal-comma")).toBe(1234.56);
		});

		it("handles whitespace between currency and amount", () => {
			expect(parseAmount("R$   1.234,56", "decimal-comma")).toBe(1234.56);
		});

		it("returns 0 for empty string", () => {
			expect(parseAmount("", "decimal-comma")).toBe(0);
		});

		it("returns 0 for whitespace only", () => {
			expect(parseAmount("   ", "decimal-comma")).toBe(0);
		});

		it("returns 0 for invalid input", () => {
			expect(parseAmount("invalid", "decimal-comma")).toBe(0);
		});

		it("returns 0 for pure text", () => {
			expect(parseAmount("abc", "decimal-comma")).toBe(0);
		});

		it("handles large numbers", () => {
			expect(parseAmount("1.234.567,89", "decimal-comma")).toBe(1234567.89);
		});

		it("handles small decimal values", () => {
			expect(parseAmount("0,01", "decimal-comma")).toBe(0.01);
		});

		it("handles zero", () => {
			expect(parseAmount("0,00", "decimal-comma")).toBe(0);
		});
	});

	describe("decimal-dot format (US/International)", () => {
		it("parses positive amounts with dot decimal", () => {
			expect(parseAmount("1,234.56", "decimal-dot")).toBe(1234.56);
		});

		it("parses negative amounts", () => {
			expect(parseAmount("-1,234.56", "decimal-dot")).toBe(-1234.56);
		});

		it("handles amounts without thousands separator", () => {
			expect(parseAmount("123.45", "decimal-dot")).toBe(123.45);
		});

		it("handles whole numbers with thousands separator", () => {
			expect(parseAmount("1,000", "decimal-dot")).toBe(1000);
		});

		it("handles whole numbers without separator", () => {
			expect(parseAmount("500", "decimal-dot")).toBe(500);
		});

		it("handles large numbers", () => {
			expect(parseAmount("1,234,567.89", "decimal-dot")).toBe(1234567.89);
		});

		it("handles small decimal values", () => {
			expect(parseAmount("0.01", "decimal-dot")).toBe(0.01);
		});
	});
});

describe("detectAmountFormat", () => {
	describe("decimal-dot detection", () => {
		it("detects dot decimal from Nubank-style values", () => {
			expect(detectAmountFormat(["-1.50", "-3.50", "11196.05"])).toBe(
				"decimal-dot",
			);
		});

		it("detects dot decimal from simple values", () => {
			expect(detectAmountFormat(["100.00", "50.25", "-30.99"])).toBe(
				"decimal-dot",
			);
		});

		it("detects dot decimal from single value", () => {
			expect(detectAmountFormat(["123.45"])).toBe("decimal-dot");
		});
	});

	describe("decimal-comma detection", () => {
		it("detects comma decimal from Brazilian-style values", () => {
			expect(detectAmountFormat(["1.234,56", "-500,00", "100,50"])).toBe(
				"decimal-comma",
			);
		});

		it("detects comma decimal from simple values", () => {
			expect(detectAmountFormat(["100,00", "50,25", "-30,99"])).toBe(
				"decimal-comma",
			);
		});

		it("detects comma decimal from single value", () => {
			expect(detectAmountFormat(["123,45"])).toBe("decimal-comma");
		});
	});

	describe("edge cases", () => {
		it("returns decimal-comma as default for empty array", () => {
			expect(detectAmountFormat([])).toBe("decimal-comma");
		});

		it("returns decimal-comma as default for ambiguous values", () => {
			expect(detectAmountFormat(["100", "200", "300"])).toBe("decimal-comma");
		});

		it("strips R$ currency symbol before detection", () => {
			expect(detectAmountFormat(["R$ 100,50", "R$ -50,00"])).toBe(
				"decimal-comma",
			);
		});

		it("strips R$ and detects dot decimal", () => {
			expect(detectAmountFormat(["R$ 100.50", "R$ -50.00"])).toBe(
				"decimal-dot",
			);
		});

		it("handles whitespace", () => {
			expect(detectAmountFormat(["  100.50  ", "  -50.00  "])).toBe(
				"decimal-dot",
			);
		});

		it("filters out empty strings", () => {
			expect(detectAmountFormat(["", "100.50", ""])).toBe("decimal-dot");
		});
	});
});

describe("parseDate", () => {
	describe("DD/MM/YYYY format", () => {
		it("parses standard date", () => {
			const date = parseDate("15/06/2023", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
			expect(date?.getMonth()).toBe(5);
			expect(date?.getFullYear()).toBe(2023);
		});

		it("parses date at start of year", () => {
			const date = parseDate("01/01/2024", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(1);
			expect(date?.getMonth()).toBe(0);
			expect(date?.getFullYear()).toBe(2024);
		});

		it("parses date at end of year", () => {
			const date = parseDate("31/12/2023", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(31);
			expect(date?.getMonth()).toBe(11);
		});

		it("parses dates with single digit day", () => {
			const date = parseDate("5/06/2023", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(5);
		});

		it("parses dates with single digit month", () => {
			const date = parseDate("15/6/2023", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getMonth()).toBe(5);
		});

		it("parses dates with single digit day and month", () => {
			const date = parseDate("5/6/2023", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(5);
			expect(date?.getMonth()).toBe(5);
		});

		it("parses 2-digit year (DD/MM/YY)", () => {
			const date = parseDate("15/06/23", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getFullYear()).toBe(2023);
		});

		it("parses 2-digit year for year 00", () => {
			const date = parseDate("01/01/00", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getFullYear()).toBe(2000);
		});

		it("strips Nubank time suffix (às HH:MM:SS)", () => {
			const date = parseDate("15/06/2023 às 17:16:03", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
			expect(date?.getMonth()).toBe(5);
		});

		it("strips Nubank time suffix with 2-digit hour", () => {
			const date = parseDate("15/06/2023 às 9:05:00", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
		});

		it("strips generic time (HH:MM)", () => {
			const date = parseDate("15/06/2023 14:30", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
		});

		it("strips generic time (HH:MM:SS)", () => {
			const date = parseDate("15/06/2023 14:30:45", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
		});

		it("returns null for empty string", () => {
			expect(parseDate("", "DD/MM/YYYY")).toBeNull();
		});

		it("returns null for whitespace only", () => {
			expect(parseDate("   ", "DD/MM/YYYY")).toBeNull();
		});

		it("returns null for invalid date string", () => {
			expect(parseDate("invalid", "DD/MM/YYYY")).toBeNull();
		});

		it("returns null for incomplete date", () => {
			expect(parseDate("15/06", "DD/MM/YYYY")).toBeNull();
		});
	});

	describe("YYYY-MM-DD format (ISO)", () => {
		it("parses standard ISO date", () => {
			const date = parseDate("2023-06-15", "YYYY-MM-DD");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
			expect(date?.getMonth()).toBe(5);
			expect(date?.getFullYear()).toBe(2023);
		});

		it("parses dates with single digit day/month", () => {
			const date = parseDate("2023-6-5", "YYYY-MM-DD");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(5);
			expect(date?.getMonth()).toBe(5);
		});

		it("parses date at start of year", () => {
			const date = parseDate("2024-01-01", "YYYY-MM-DD");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(1);
			expect(date?.getMonth()).toBe(0);
		});

		it("parses date at end of year", () => {
			const date = parseDate("2023-12-31", "YYYY-MM-DD");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(31);
			expect(date?.getMonth()).toBe(11);
		});
	});

	describe("MM/DD/YYYY format (US)", () => {
		it("parses standard US date", () => {
			const date = parseDate("06/15/2023", "MM/DD/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
			expect(date?.getMonth()).toBe(5);
			expect(date?.getFullYear()).toBe(2023);
		});

		it("parses dates with single digit values", () => {
			const date = parseDate("6/5/2023", "MM/DD/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(5);
			expect(date?.getMonth()).toBe(5);
		});
	});

	describe("lowercase format variants", () => {
		it("handles dd/mm/yyyy", () => {
			const date = parseDate("15/06/2023", "dd/mm/yyyy");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
			expect(date?.getMonth()).toBe(5);
		});

		it("handles yyyy-mm-dd", () => {
			const date = parseDate("2023-06-15", "yyyy-mm-dd");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
			expect(date?.getMonth()).toBe(5);
		});

		it("handles mm/dd/yyyy", () => {
			const date = parseDate("06/15/2023", "mm/dd/yyyy");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
		});
	});

	describe("edge cases", () => {
		it("handles date with leading/trailing whitespace", () => {
			const date = parseDate("  15/06/2023  ", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(15);
		});

		it("handles leap year date", () => {
			const date = parseDate("29/02/2024", "DD/MM/YYYY");
			expect(date).not.toBeNull();
			expect(date?.getDate()).toBe(29);
			expect(date?.getMonth()).toBe(1);
		});
	});
});

describe("parseCsvContent", () => {
	describe("basic parsing", () => {
		it("parses basic CSV with default settings", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra supermercado,"-123,45"
16/06/2023,Salário,"1.500,00"`;

			const result = await parseCsvContent(csv);

			expect(result.headers).toEqual(["Data", "Descrição", "Valor"]);
			expect(result.rows).toHaveLength(2);
			expect(result.totalRows).toBe(2);
		});

		it("parses CSV with custom column mapping", async () => {
			const csv = `Valor,Data,Descrição
"-50,00",20/06/2023,Pagamento conta
"200,00",21/06/2023,Transferência`;

			const result = await parseCsvContent(csv, {
				columnMapping: { date: 1, amount: 0, description: 2 },
			});

			expect(result.rows).toHaveLength(2);
			expect(result.rows[0]?.amount).toBe(50);
			expect(result.rows[0]?.type).toBe("expense");
			expect(result.rows[1]?.amount).toBe(200);
			expect(result.rows[1]?.type).toBe("income");
		});

		it("throws error for empty CSV", async () => {
			await expect(parseCsvContent("")).rejects.toThrow("CSV file is empty");
		});

		it("handles CSV with only headers", async () => {
			const csv = "Data,Descrição,Valor";
			const result = await parseCsvContent(csv);

			expect(result.headers).toEqual(["Data", "Descrição", "Valor"]);
			expect(result.rows).toHaveLength(0);
		});
	});

	describe("delimiter handling", () => {
		it("handles semicolon delimiter", async () => {
			const csv = `Data;Lançamento;Valor
15/06/2023;Compra;-100,00`;

			const result = await parseCsvContent(csv, { delimiter: ";" });

			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]?.description).toBe("Compra");
		});

		it("auto-detects semicolon delimiter", async () => {
			const csv = `Data;Lançamento;Valor
15/06/2023;Compra;-100,00`;

			const result = await parseCsvContent(csv);

			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]?.description).toBe("Compra");
		});

		it("handles tab delimiter", async () => {
			const csv = `Data\tDescrição\tValor
15/06/2023\tCompra\t-100,00`;

			const result = await parseCsvContent(csv, { delimiter: "\t" });

			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]?.description).toBe("Compra");
		});
	});

	describe("quoted fields (RFC 4180)", () => {
		it("handles quoted fields with commas", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,"Compra em Loja, Centro","-50,00"`;

			const result = await parseCsvContent(csv);

			expect(result.rows[0]?.description).toBe("Compra em Loja, Centro");
		});

		it("handles escaped quotes in fields", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,"Loja ""ABC"" Ltda","-50,00"`;

			const result = await parseCsvContent(csv);

			expect(result.rows[0]?.description).toBe('Loja "ABC" Ltda');
		});

		it("handles newlines in quoted fields", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,"Compra
multilinhas","-50,00"`;

			const result = await parseCsvContent(csv);

			// Newlines are preserved in the parsed content
			expect(result.rows[0]?.description).toBe("Compra\nmultilinhas");
		});
	});

	describe("bank format detection", () => {
		it("detects Nubank format", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,PIX Recebido,100,00`;

			const result = await parseCsvContent(csv);

			expect(result.detectedFormat?.id).toBe("nubank");
		});

		it("detects Itaú format", async () => {
			const csv = `data;lancamento;ag./origem;valor;saldo
15/06/2023;Compra débito;1234;-50,00;1000,00`;

			const result = await parseCsvContent(csv);

			expect(result.detectedFormat?.id).toBe("itau");
		});

		it("returns null for unknown format", async () => {
			const csv = `Col1,Col2,Col3
a,b,c`;

			const result = await parseCsvContent(csv);

			expect(result.detectedFormat).toBeNull();
		});
	});

	describe("error handling", () => {
		it("records errors for invalid dates", async () => {
			const csv = `Data,Descrição,Valor
invalid-date,Compra,-50,00
16/06/2023,Outra compra,-30,00`;

			const result = await parseCsvContent(csv);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.message).toContain("Invalid date");
			expect(result.rows).toHaveLength(1);
		});

		it("records errors for invalid amounts", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra,invalid
16/06/2023,Outra,-30,00`;

			const result = await parseCsvContent(csv);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.message).toContain("Invalid amount");
		});

		it("records error when column mapping is undefined", async () => {
			const csv = `Unknown1,Unknown2,Unknown3
a,b,c`;

			const result = await parseCsvContent(csv);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.message).toBe("Column mapping not defined");
		});

		it("includes row and column info in errors", async () => {
			const csv = `Data,Descrição,Valor
invalid-date,Compra,-50,00`;

			const result = await parseCsvContent(csv);

			expect(result.errors[0]?.row).toBeDefined();
			expect(result.errors[0]?.column).toBe(0);
		});
	});

	describe("row filtering and skipping", () => {
		it("filters by selected rows", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Linha 1,-10,00
16/06/2023,Linha 2,-20,00
17/06/2023,Linha 3,-30,00`;

			const result = await parseCsvContent(csv, { selectedRows: [1, 3] });

			expect(result.rows).toHaveLength(2);
			expect(result.rows[0]?.description).toBe("Linha 1");
			expect(result.rows[1]?.description).toBe("Linha 3");
		});

		it("skips custom number of rows", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Linha 1,-10,00
16/06/2023,Linha 2,-20,00
17/06/2023,Linha 3,-30,00`;

			const result = await parseCsvContent(csv, { skipRows: 2 });

			expect(result.rows).toHaveLength(2);
			expect(result.rows[0]?.description).toBe("Linha 2");
		});

		it("skips no rows when skipRows is 1 (default)", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Primeira,-10,00`;

			const result = await parseCsvContent(csv, { skipRows: 1 });

			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]?.description).toBe("Primeira");
		});
	});

	describe("transaction type detection", () => {
		it("determines type from amount sign (positive = income)", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Salário,"1.000,00"`;

			const result = await parseCsvContent(csv);

			expect(result.rows[0]?.type).toBe("income");
		});

		it("determines type from amount sign (negative = expense)", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra,"-500,00"`;

			const result = await parseCsvContent(csv);

			expect(result.rows[0]?.type).toBe("expense");
		});

		it("detects type from type column (Crédito)", async () => {
			const csv = `Data;Descrição;Valor;Tipo
15/06/2023;PIX;-100,00;Crédito`;

			const result = await parseCsvContent(csv, {
				delimiter: ";",
				columnMapping: { date: 0, description: 1, amount: 2, type: 3 },
			});

			expect(result.rows[0]?.type).toBe("income");
		});

		it("detects type from type column (Débito)", async () => {
			const csv = `Data;Descrição;Valor;Tipo
15/06/2023;Compra;100,00;Débito`;

			const result = await parseCsvContent(csv, {
				delimiter: ";",
				columnMapping: { date: 0, description: 1, amount: 2, type: 3 },
			});

			expect(result.rows[0]?.type).toBe("expense");
		});

		it("detects type from type column (Entrada)", async () => {
			const csv = `Data;Descrição;Valor;Tipo
15/06/2023;Depósito;500,00;Entrada`;

			const result = await parseCsvContent(csv, {
				delimiter: ";",
				columnMapping: { date: 0, description: 1, amount: 2, type: 3 },
			});

			expect(result.rows[0]?.type).toBe("income");
		});

		it("detects type from type column (Saída)", async () => {
			const csv = `Data;Descrição;Valor;Tipo
15/06/2023;Saque;200,00;Saída`;

			const result = await parseCsvContent(csv, {
				delimiter: ";",
				columnMapping: { date: 0, description: 1, amount: 2, type: 3 },
			});

			expect(result.rows[0]?.type).toBe("expense");
		});
	});

	describe("format options", () => {
		it("uses decimal-dot format when specified", async () => {
			const csv = `Date;Description;Amount
06/15/2023;Purchase;-1,234.56`;

			const result = await parseCsvContent(csv, {
				delimiter: ";",
				dateFormat: "MM/DD/YYYY",
				amountFormat: "decimal-dot",
				columnMapping: { date: 0, description: 1, amount: 2 },
			});

			expect(result.rows[0]?.amount).toBe(1234.56);
		});

		it("uses custom date format", async () => {
			const csv = `Date;Description;Amount
2023-06-15;Purchase;-100,00`;

			const result = await parseCsvContent(csv, {
				delimiter: ";",
				dateFormat: "YYYY-MM-DD",
				columnMapping: { date: 0, description: 1, amount: 2 },
			});

			expect(result.rows[0]?.date.getDate()).toBe(15);
			expect(result.rows[0]?.date.getMonth()).toBe(5);
		});
	});

	describe("amount normalization", () => {
		it("converts amount to absolute value", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra,"-123,45"`;

			const result = await parseCsvContent(csv);

			expect(result.rows[0]?.amount).toBe(123.45);
		});

		it("preserves positive amounts", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Salário,"500,00"`;

			const result = await parseCsvContent(csv);

			expect(result.rows[0]?.amount).toBe(500);
		});
	});

	describe("description handling", () => {
		it("provides default description when empty", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,,-50,00`;

			const result = await parseCsvContent(csv);

			expect(result.rows[0]?.description).toBe("Sem descricao");
		});

		it("normalizes description text", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra café,-10,00`;

			const result = await parseCsvContent(csv);

			// normalizeText handles accents
			expect(result.rows[0]?.description).toBe("Compra cafe");
		});
	});

	describe("progress callback", () => {
		it("calls progress callback during parsing", async () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra 1,-10,00
16/06/2023,Compra 2,-20,00`;

			const events: string[] = [];
			await parseCsvContent(csv, {
				onProgress: (event) => {
					events.push(event.type);
				},
			});

			expect(events).toContain("headers");
			expect(events).toContain("complete");
		});

		it("emits progress events for large files (>100 rows)", async () => {
			// Generate CSV with 150 data rows to trigger progress emission (fires every 100 rows)
			const rows = ["Data,Descrição,Valor"];
			for (let i = 1; i <= 150; i++) {
				rows.push(`15/06/2023,Compra ${i},-${i * 10},00`);
			}
			const csv = rows.join("\n");

			const events: string[] = [];
			await parseCsvContent(csv, {
				onProgress: (event) => {
					events.push(event.type);
				},
			});

			expect(events).toContain("headers");
			expect(events).toContain("progress");
			expect(events).toContain("complete");
		});
	});
});

describe("previewCsv", () => {
	describe("basic preview", () => {
		it("returns headers and sample rows", () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra 1,-10,00
16/06/2023,Compra 2,-20,00
17/06/2023,Compra 3,-30,00`;

			const preview = previewCsv(csv);

			expect(preview.headers).toEqual(["Data", "Descrição", "Valor"]);
			expect(preview.sampleRows).toHaveLength(3);
			expect(preview.totalRows).toBe(3);
		});

		it("limits sample rows with maxRows option", () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra 1,-10,00
16/06/2023,Compra 2,-20,00
17/06/2023,Compra 3,-30,00
18/06/2023,Compra 4,-40,00
19/06/2023,Compra 5,-50,00
20/06/2023,Compra 6,-60,00`;

			const preview = previewCsv(csv, { maxRows: 3 });

			expect(preview.sampleRows).toHaveLength(3);
			expect(preview.totalRows).toBe(6);
		});

		it("throws error for empty CSV", () => {
			expect(() => previewCsv("")).toThrow("CSV file is empty");
		});
	});

	describe("format detection", () => {
		it("detects Nubank format", () => {
			const csv = `Data,Descrição,Valor
15/06/2023,PIX Recebido,100,00`;

			const preview = previewCsv(csv);

			expect(preview.detectedFormat?.id).toBe("nubank");
			expect(preview.detectedFormat?.name).toBe("Nubank");
		});

		it("returns null for unknown format", () => {
			const csv = `Col1,Col2,Col3
a,b,c`;

			const preview = previewCsv(csv);

			expect(preview.detectedFormat).toBeNull();
		});
	});

	describe("amount format detection", () => {
		it("detects decimal-comma format from sample values", () => {
			const csv = `Data,Descrição,Valor
15/06/2023,PIX Recebido,100,00
16/06/2023,Compra,-50,25`;

			const preview = previewCsv(csv);

			expect(preview.amountFormat).toBe("decimal-comma");
		});

		it("detects decimal-dot format from Nubank-style values", () => {
			const csv = `Data,Valor,Identificador,Descrição
01/12/2025,-1.50,abc-123,Transferência enviada
01/12/2025,-3.50,def-456,Compra no débito
05/12/2025,11196.05,ghi-789,Transferência Recebida`;

			const preview = previewCsv(csv);

			expect(preview.amountFormat).toBe("decimal-dot");
		});

		it("defaults to decimal-comma for ambiguous values", () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra,100`;

			const preview = previewCsv(csv);

			expect(preview.amountFormat).toBe("decimal-comma");
		});
	});

	describe("column mapping suggestions", () => {
		it("suggests column mapping for standard headers", () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra,-50,00`;

			const preview = previewCsv(csv);

			expect(preview.suggestedMapping.date).toBe(0);
			expect(preview.suggestedMapping.description).toBe(1);
			expect(preview.suggestedMapping.amount).toBe(2);
		});

		it("suggests mapping for alternative header names", () => {
			const csv = `date,description,amount
15/06/2023,Purchase,-50,00`;

			const preview = previewCsv(csv);

			expect(preview.suggestedMapping.date).toBe(0);
			expect(preview.suggestedMapping.description).toBe(1);
			expect(preview.suggestedMapping.amount).toBe(2);
		});
	});

	describe("delimiter detection", () => {
		it("detects semicolon delimiter", () => {
			const csv = `Data;Descrição;Valor
15/06/2023;Compra;-50,00`;

			const preview = previewCsv(csv);

			expect(preview.delimiter).toBe(";");
		});

		it("detects comma delimiter", () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra,-50,00`;

			const preview = previewCsv(csv);

			expect(preview.delimiter).toBe(",");
		});

		it("uses custom delimiter when specified", () => {
			const csv = `Data|Descrição|Valor
15/06/2023|Compra|-50,00`;

			const preview = previewCsv(csv, { delimiter: "|" });

			expect(preview.headers).toEqual(["Data", "Descrição", "Valor"]);
		});
	});

	describe("sample row content", () => {
		it("preserves field values in sample rows", () => {
			const csv = `Data,Descrição,Valor
15/06/2023,Compra,-50,00`;

			const preview = previewCsv(csv);

			expect(preview.sampleRows[0]).toEqual([
				"15/06/2023",
				"Compra",
				"-50",
				"00",
			]);
		});

		it("handles quoted fields in sample rows", () => {
			const csv = `Data,Descrição,Valor
15/06/2023,"Compra, teste","-50,00"`;

			const preview = previewCsv(csv);

			expect(preview.sampleRows[0]?.[1]).toBe("Compra, teste");
			expect(preview.sampleRows[0]?.[2]).toBe("-50,00");
		});
	});
});
