/**
 * Migration script to backfill search indexes for encrypted data
 *
 * This script generates search indexes for existing bills and transactions
 * that were created before the blind index feature was implemented.
 *
 * Usage:
 *   bun run scripts/backfill-search-index.ts check --env local
 *   bun run scripts/backfill-search-index.ts run --env local --dry-run
 *   bun run scripts/backfill-search-index.ts run --env local
 */

import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { asc, eq, gt } from "drizzle-orm";
import { Pool } from "pg";

import { bill } from "../packages/database/src/schemas/bills";
import { transaction } from "../packages/database/src/schemas/transactions";
import { decryptIfNeeded, isEncrypted } from "../packages/encryption/src/server";
import { createSearchIndex } from "../packages/encryption/src/search-index";

const program = new Command();

const BATCH_SIZE = 100;

const colors = {
	blue: chalk.blue,
	cyan: chalk.cyan,
	green: chalk.green,
	red: chalk.red,
	yellow: chalk.yellow,
};

function getEnvFilePath(env: string): string {
	const packageDir = path.join(process.cwd(), "packages", "database");
	const possibleFiles = [`.env.${env}`, ".env.local", ".env"];

	for (const file of possibleFiles) {
		const filePath = path.join(packageDir, file);
		if (fs.existsSync(filePath)) {
			return filePath;
		}
	}

	throw new Error(`No environment file found for ${env}`);
}

function decryptValue(
	value: string | null,
	encryptionKey: string,
): string | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value);
		if (isEncrypted(parsed)) {
			return decryptIfNeeded(parsed, encryptionKey);
		}
		return value;
	} catch {
		return value; // Not encrypted, return as-is
	}
}

type SearchableTable = typeof bill | typeof transaction;

interface BackfillResult {
	updated: number;
	skipped: number;
}

async function backfillTable(
	db: ReturnType<typeof drizzle>,
	table: SearchableTable,
	tableName: string,
	encryptionKey: string,
	searchKey: string,
	dryRun: boolean,
): Promise<BackfillResult> {
	console.log(colors.blue(`\n📦 Backfilling ${tableName} search indexes...`));

	let lastId: string | null = null;
	let totalUpdated = 0;
	let totalSkipped = 0;
	let totalProcessed = 0;
	let batchNumber = 0;

	while (true) {
		const query = db
			.select({
				id: table.id,
				description: table.description,
				searchIndex: table.searchIndex,
			})
			.from(table)
			.orderBy(asc(table.id))
			.limit(BATCH_SIZE);

		const records = lastId
			? await query.where(gt(table.id, lastId))
			: await query;

		if (records.length === 0) break;
		batchNumber++;

		const updates: Array<{ id: string; searchIndex: string }> = [];

		for (const record of records) {
			// Skip if already has search index
			if (record.searchIndex) {
				totalSkipped++;
				continue;
			}

			// Decrypt description to get plaintext
			const plaintext = decryptValue(record.description, encryptionKey);
			if (!plaintext) {
				totalSkipped++;
				continue;
			}

			// Generate search index from plaintext
			const searchIndex = createSearchIndex(plaintext, searchKey);
			updates.push({ id: record.id, searchIndex });
		}

		if (updates.length > 0) {
			if (dryRun) {
				totalUpdated += updates.length;
			} else {
				try {
					await db.transaction(async (tx) => {
						for (const update of updates) {
							await tx
								.update(table)
								.set({ searchIndex: update.searchIndex })
								.where(eq(table.id, update.id));
						}
					});
					totalUpdated += updates.length;
				} catch (error) {
					console.error(
						colors.red(`\n   ❌ Batch ${batchNumber} failed: ${error}`),
					);
					throw error;
				}
			}
		}

		// Update cursor to last record's id for next batch
		lastId = records[records.length - 1].id;
		totalProcessed += records.length;
		process.stdout.write(
			`\r   Processed ${totalProcessed} ${tableName}... (${dryRun ? "DRY RUN" : "LIVE"})`,
		);

		// Exit if we got fewer records than the batch size (last batch)
		if (records.length < BATCH_SIZE) break;
	}

	console.log(
		colors.green(
			`\n   ✅ ${dryRun ? "Would update" : "Updated"}: ${totalUpdated}, Skipped: ${totalSkipped}`,
		),
	);

	return { updated: totalUpdated, skipped: totalSkipped };
}

async function backfillBills(
	db: ReturnType<typeof drizzle>,
	encryptionKey: string,
	searchKey: string,
	dryRun: boolean,
): Promise<BackfillResult> {
	return backfillTable(db, bill, "bills", encryptionKey, searchKey, dryRun);
}

async function backfillTransactions(
	db: ReturnType<typeof drizzle>,
	encryptionKey: string,
	searchKey: string,
	dryRun: boolean,
): Promise<BackfillResult> {
	return backfillTable(
		db,
		transaction,
		"transactions",
		encryptionKey,
		searchKey,
		dryRun,
	);
}

async function runBackfill(env: string, dryRun: boolean) {
	console.log(colors.blue("🔍 Starting search index backfill migration..."));
	console.log(colors.cyan(`   Environment: ${env}`));
	console.log(colors.cyan(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`));
	console.log(colors.cyan("─".repeat(50)));

	const envFile = getEnvFilePath(env);
	console.log(colors.cyan(`   Loading env from: ${envFile}`));
	config({ path: envFile });

	const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
	const SEARCH_KEY = process.env.SEARCH_KEY;
	const DATABASE_URL = process.env.DATABASE_URL;

	if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
		console.error(
			colors.red("❌ ENCRYPTION_KEY must be a 64-character hex string"),
		);
		process.exit(1);
	}

	if (!SEARCH_KEY || SEARCH_KEY.length !== 64) {
		console.error(
			colors.red("❌ SEARCH_KEY must be a 64-character hex string"),
		);
		process.exit(1);
	}

	if (!DATABASE_URL) {
		console.error(colors.red("❌ DATABASE_URL is required"));
		process.exit(1);
	}

	console.log(
		colors.cyan(`   ENCRYPTION_KEY: ${ENCRYPTION_KEY.substring(0, 8)}...`),
	);
	console.log(colors.cyan(`   SEARCH_KEY: ${SEARCH_KEY.substring(0, 8)}...`));

	const pool = new Pool({ connectionString: DATABASE_URL });
	const db = drizzle(pool);

	try {
		await backfillBills(db, ENCRYPTION_KEY, SEARCH_KEY, dryRun);
		await backfillTransactions(db, ENCRYPTION_KEY, SEARCH_KEY, dryRun);

		console.log(colors.cyan("\n" + "─".repeat(50)));
		if (dryRun) {
			console.log(
				colors.yellow("⚠️  DRY RUN completed - no data was modified"),
			);
			console.log(colors.yellow("   Run without --dry-run to apply changes"));
		} else {
			console.log(colors.green("✅ Backfill completed successfully!"));
		}
	} catch (error) {
		console.error(colors.red("\n❌ Backfill failed:"), error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

program
	.name("backfill-search-index")
	.description(
		"Backfill search indexes for encrypted bill/transaction descriptions",
	)
	.version("1.0.0");

program
	.command("run")
	.description("Run the backfill migration")
	.option("-e, --env <environment>", "Environment (local, production)", "local")
	.option("--dry-run", "Preview changes without modifying data", false)
	.action(async (options) => {
		await runBackfill(options.env, options.dryRun).catch((err) => {
			console.error(err);
			process.exit(1);
		});
	});

program
	.command("check")
	.description("Check if required keys are properly configured")
	.option("-e, --env <environment>", "Environment to use", "local")
	.action((options) => {
		const envFile = getEnvFilePath(options.env);
		config({ path: envFile });

		const encKey = process.env.ENCRYPTION_KEY;
		const searchKey = process.env.SEARCH_KEY;
		const dbUrl = process.env.DATABASE_URL;

		console.log(colors.blue("🔍 Checking configuration...\n"));

		// Check ENCRYPTION_KEY
		if (!encKey) {
			console.log(colors.red("❌ ENCRYPTION_KEY is not set"));
		} else if (encKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(encKey)) {
			console.log(colors.red("❌ ENCRYPTION_KEY is invalid"));
		} else {
			console.log(
				colors.green(`✅ ENCRYPTION_KEY is valid (${encKey.substring(0, 8)}...)`),
			);
		}

		// Check SEARCH_KEY
		if (!searchKey) {
			console.log(colors.red("❌ SEARCH_KEY is not set"));
			console.log(
				colors.yellow(
					'   Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
				),
			);
		} else if (searchKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(searchKey)) {
			console.log(colors.red("❌ SEARCH_KEY is invalid"));
		} else {
			console.log(
				colors.green(`✅ SEARCH_KEY is valid (${searchKey.substring(0, 8)}...)`),
			);
		}

		// Check DATABASE_URL
		if (!dbUrl) {
			console.log(colors.red("❌ DATABASE_URL is not set"));
		} else {
			console.log(colors.green("✅ DATABASE_URL is set"));
		}
	});

program.parse();
