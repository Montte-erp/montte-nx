/**
 * Seed script for automation templates
 *
 * This script seeds system automation templates into the database.
 * Templates provide pre-built workflows that users can activate.
 *
 * Usage:
 *   bun run scripts/seed-automation-templates.ts check --env local
 *   bun run scripts/seed-automation-templates.ts run --env local --dry-run
 *   bun run scripts/seed-automation-templates.ts run --env local
 */

import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { ConditionGroup } from "@f-o-t/rules-engine";
import { upsertSystemTemplate } from "../packages/database/src/repositories/automation-template-repository";
import type { TemplateCategory } from "../packages/database/src/schemas/automation-templates";
import type {
	Consequence,
	FlowData,
	TriggerConfig,
	TriggerType,
} from "../packages/database/src/schemas/automations";
import * as schema from "../packages/database/src/schema";

const program = new Command();

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

// ============================================
// Flow Data Generation Helpers
// ============================================

type NodeBase = {
	id: string;
	position: { x: number; y: number };
	type: "trigger" | "action" | "condition";
};

type TriggerNode = NodeBase & {
	type: "trigger";
	data: {
		label: string;
		triggerType: TriggerType;
		config: TriggerConfig;
	};
};

type ActionNode = NodeBase & {
	type: "action";
	data: {
		label: string;
		actionType: string;
		config: Record<string, unknown>;
	};
};

type AutomationNode = TriggerNode | ActionNode;

type AutomationEdge = {
	id: string;
	source: string;
	target: string;
	sourceHandle: string;
	targetHandle: string;
};

function generateFlowData(
	triggerType: TriggerType,
	triggerConfig: TriggerConfig,
	actions: Array<{
		type: string;
		label: string;
		config: Record<string, unknown>;
	}>,
): FlowData {
	const nodes: AutomationNode[] = [];
	const edges: AutomationEdge[] = [];

	// Create trigger node
	const triggerId = "trigger-template-1";
	nodes.push({
		id: triggerId,
		position: { x: 250, y: 0 },
		type: "trigger",
		data: {
			label: "Gatilho",
			triggerType,
			config: triggerConfig,
		},
	});

	let lastNodeId = triggerId;
	let yPosition = 150;

	// Create action nodes
	actions.forEach((action, index) => {
		const actionId = `action-template-${index + 1}`;
		nodes.push({
			id: actionId,
			position: { x: 250, y: yPosition },
			type: "action",
			data: {
				label: action.label,
				actionType: action.type,
				config: action.config,
			},
		});

		edges.push({
			id: `edge-${lastNodeId}-${actionId}`,
			source: lastNodeId,
			target: actionId,
			sourceHandle: "bottom",
			targetHandle: "top",
		});

		lastNodeId = actionId;
		yPosition += 150;
	});

	return {
		nodes: nodes as unknown[],
		edges: edges as unknown[],
		viewport: { x: 0, y: 0, zoom: 1 },
	};
}

// ============================================
// System Templates
// ============================================

type SystemTemplate = {
	name: string;
	description: string;
	category: TemplateCategory;
	icon: string;
	tags: string[];
	triggerType: TriggerType;
	triggerConfig: TriggerConfig;
	conditions: ConditionGroup;
	consequences: Consequence[];
	flowData: FlowData;
};

const SYSTEM_TEMPLATES: SystemTemplate[] = [
	// Weekly Bills Digest
	{
		name: "Resumo Semanal de Contas",
		description:
			"Envia um e-mail semanal com o resumo das contas a pagar e receber dos proximos dias",
		category: "bill_management",
		icon: "ClipboardList",
		tags: ["contas", "semanal", "email", "relatorio"],
		triggerType: "schedule.weekly",
		triggerConfig: {
			time: "09:00",
			timezone: "America/Sao_Paulo",
			dayOfWeek: 1, // Monday
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "fetch_bills_report",
				payload: {
					includePending: true,
					includeOverdue: true,
					daysAhead: 7,
					billTypes: ["expense", "income"],
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					useTemplate: "bills_digest",
				},
			},
		],
		flowData: generateFlowData(
			"schedule.weekly",
			{
				time: "09:00",
				timezone: "America/Sao_Paulo",
				dayOfWeek: 1,
			} as TriggerConfig,
			[
				{
					type: "fetch_bills_report",
					label: "Buscar Relatorio de Contas",
					config: {
						includePending: true,
						includeOverdue: true,
						daysAhead: 7,
						billTypes: ["expense", "income"],
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail",
					config: {
						to: "owner",
						useTemplate: "bills_digest",
					},
				},
			],
		),
	},

	// Daily Overdue Bills Alert
	{
		name: "Alerta Diario de Contas Vencidas",
		description: "Envia uma notificacao diaria se houver contas vencidas",
		category: "bill_management",
		icon: "Bell",
		tags: ["contas", "vencidas", "diario", "alerta"],
		triggerType: "schedule.daily",
		triggerConfig: {
			time: "08:00",
			timezone: "America/Sao_Paulo",
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "fetch_bills_report",
				payload: {
					includePending: false,
					includeOverdue: true,
					daysAhead: 0,
					billTypes: ["expense"],
				},
			},
			{
				type: "send_push_notification",
				payload: {
					title: "Contas Vencidas",
					body: "Voce tem contas vencidas que precisam de atencao",
				},
			},
		],
		flowData: generateFlowData(
			"schedule.daily",
			{
				time: "08:00",
				timezone: "America/Sao_Paulo",
			} as TriggerConfig,
			[
				{
					type: "fetch_bills_report",
					label: "Buscar Contas Vencidas",
					config: {
						includePending: false,
						includeOverdue: true,
						daysAhead: 0,
						billTypes: ["expense"],
					},
				},
				{
					type: "send_push_notification",
					label: "Enviar Notificacao",
					config: {
						title: "Contas Vencidas",
						body: "Voce tem contas vencidas que precisam de atencao",
					},
				},
			],
		),
	},

	// Weekly Bills Report with CSV Attachment
	{
		name: "Relatorio Semanal em CSV",
		description:
			"Gera e envia um relatorio CSV das contas da semana por e-mail",
		category: "reporting",
		icon: "FileBarChart",
		tags: ["relatorio", "csv", "semanal", "email"],
		triggerType: "schedule.weekly",
		triggerConfig: {
			time: "18:00",
			timezone: "America/Sao_Paulo",
			dayOfWeek: 5, // Friday
		} as TriggerConfig,
		conditions: {
			id: "root",
			operator: "AND",
			conditions: [],
		},
		consequences: [
			{
				type: "fetch_bills_report",
				payload: {
					includePending: true,
					includeOverdue: true,
					daysAhead: 7,
					billTypes: ["expense", "income"],
				},
			},
			{
				type: "format_data",
				payload: {
					outputFormat: "csv",
					fileName: "relatorio_contas_{{date}}",
					csvIncludeHeaders: true,
					csvDelimiter: ";",
				},
			},
			{
				type: "send_email",
				payload: {
					to: "owner",
					subject: "Relatorio Semanal de Contas",
					body: "<p>Segue em anexo o relatorio semanal de contas.</p><p>Este e-mail foi gerado automaticamente.</p>",
					includeAttachment: true,
				},
			},
		],
		flowData: generateFlowData(
			"schedule.weekly",
			{
				time: "18:00",
				timezone: "America/Sao_Paulo",
				dayOfWeek: 5,
			} as TriggerConfig,
			[
				{
					type: "fetch_bills_report",
					label: "Buscar Relatorio de Contas",
					config: {
						includePending: true,
						includeOverdue: true,
						daysAhead: 7,
						billTypes: ["expense", "income"],
					},
				},
				{
					type: "format_data",
					label: "Formatar como CSV",
					config: {
						outputFormat: "csv",
						fileName: "relatorio_contas_{{date}}",
						csvIncludeHeaders: true,
						csvDelimiter: ";",
					},
				},
				{
					type: "send_email",
					label: "Enviar E-mail com Anexo",
					config: {
						to: "owner",
						subject: "Relatorio Semanal de Contas",
						body: "<p>Segue em anexo o relatorio semanal de contas.</p><p>Este e-mail foi gerado automaticamente.</p>",
						includeAttachment: true,
					},
				},
			],
		),
	},
];

// ============================================
// Seed Functions
// ============================================

async function seedAutomationTemplates(
	db: ReturnType<typeof drizzle>,
	dryRun: boolean,
) {
	console.log(colors.blue("\n📦 Seeding automation templates..."));

	let seeded = 0;
	let skipped = 0;

	for (const template of SYSTEM_TEMPLATES) {
		try {
			if (dryRun) {
				console.log(colors.cyan(`   Would upsert: ${template.name}`));
				seeded++;
			} else {
				const result = await upsertSystemTemplate(db, template);
				if (result) {
					console.log(colors.green(`   ✅ Upserted: ${result.name}`));
					seeded++;
				} else {
					console.log(colors.yellow(`   ⏭️  Skipped: ${template.name}`));
					skipped++;
				}
			}
		} catch (error) {
			console.error(
				colors.red(`   ❌ Failed to upsert "${template.name}":`),
				error,
			);
			throw error;
		}
	}

	console.log(
		colors.green(
			`\n   ${dryRun ? "Would seed" : "Seeded"}: ${seeded}, Skipped: ${skipped}`,
		),
	);
}

async function runSeed(env: string, dryRun: boolean) {
	console.log(colors.blue("🌱 Starting automation templates seed..."));
	console.log(colors.cyan(`   Environment: ${env}`));
	console.log(colors.cyan(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`));
	console.log(colors.cyan("─".repeat(50)));

	const envFile = getEnvFilePath(env);
	console.log(colors.cyan(`   Loading env from: ${envFile}`));
	config({ path: envFile });

	const DATABASE_URL = process.env.DATABASE_URL;

	if (!DATABASE_URL) {
		console.error(colors.red("❌ DATABASE_URL is required"));
		process.exit(1);
	}

	const pool = new Pool({ connectionString: DATABASE_URL });
	const db = drizzle(pool, { schema });

	try {
		await seedAutomationTemplates(db, dryRun);

		console.log(colors.cyan("\n" + "─".repeat(50)));
		if (dryRun) {
			console.log(colors.yellow("⚠️  DRY RUN completed - no data was modified"));
			console.log(colors.yellow("   Run without --dry-run to apply changes"));
		} else {
			console.log(colors.green("✅ Seed completed successfully!"));
		}
	} catch (error) {
		console.error(colors.red("\n❌ Seed failed:"), error);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

program
	.name("seed-automation-templates")
	.description("Seed system automation templates into the database")
	.version("1.0.0");

program
	.command("run")
	.description("Run the seed")
	.option("-e, --env <environment>", "Environment (local, production)", "local")
	.option("--dry-run", "Preview changes without modifying data", false)
	.action(async (options) => {
		await runSeed(options.env, options.dryRun).catch((err) => {
			console.error(err);
			process.exit(1);
		});
	});

program
	.command("check")
	.description("Check if required configuration is present")
	.option("-e, --env <environment>", "Environment to use", "local")
	.action((options) => {
		const envFile = getEnvFilePath(options.env);
		config({ path: envFile });

		const dbUrl = process.env.DATABASE_URL;

		console.log(colors.blue("🔍 Checking configuration...\n"));

		if (!dbUrl) {
			console.log(colors.red("❌ DATABASE_URL is not set"));
		} else {
			console.log(colors.green("✅ DATABASE_URL is set"));
		}

		console.log(
			colors.cyan(`\n📋 Templates to seed: ${SYSTEM_TEMPLATES.length}`),
		);
		for (const template of SYSTEM_TEMPLATES) {
			console.log(colors.cyan(`   - ${template.name} (${template.category})`));
		}
	});

program.parse();
