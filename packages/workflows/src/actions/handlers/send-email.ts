import {
	findOrganizationById,
	getOrganizationMembers,
} from "@packages/database/repositories/auth-repository";
import type { Consequence } from "@packages/database/schema";
import type { BillDigestItem, BillsDigestSummary } from "@packages/transactional/client";
import { sendBillsDigestEmail } from "@packages/transactional/client";
import { renderEmailBlocks, processSubject } from "@packages/transactional/lib/render-blocks";
import type { EmailTemplate } from "@packages/transactional/schemas/email-builder.schema";
import { createTemplateContext, renderTemplate } from "../../utils/template";
import {
	type ActionHandler,
	type ActionHandlerContext,
	createActionResult,
	createSkippedResult,
	getPreviousOutputData,
} from "../types";

/**
 * Builds the email sender address based on organization slug
 * Format: Montte <{slug}@mail.montte.co>
 */
function buildEmailFrom(organizationSlug?: string): string {
	const slug = organizationSlug?.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'suporte';
	return `Montte <${slug}@mail.montte.co>`;
}

type AttachmentData = {
	filename: string;
	content: string; // base64
	contentType: string;
};

export const sendEmailHandler: ActionHandler = {
	type: "send_email",

	async execute(consequence: Consequence, context: ActionHandlerContext) {
		const { to, customEmail, subject, body, useTemplate, includeAttachment, emailTemplate } =
			consequence.payload;

		console.log(`[SendEmail] Starting: useTemplate=${useTemplate}, dryRun=${context.dryRun}, hasResendClient=${!!context.resendClient}`);

		// Get data from previous actions (e.g., fetch_bills_report)
		const previousData = getPreviousOutputData(context.previousResults);
		console.log(`[SendEmail] Previous data keys: ${Object.keys(previousData).join(", ")}`);

		// Determine recipient email
		let recipientEmail: string;
		let recipientName = "Usuario";

		if (to === "custom" && customEmail) {
			recipientEmail = customEmail;
		} else {
			const members = await getOrganizationMembers(
				context.db,
				context.organizationId,
			);
			const owner = members.find((m) => m.role === "owner");

			if (!owner?.user?.email) {
				return createActionResult(
					consequence,
					false,
					undefined,
					"Organization owner email not found",
				);
			}
			recipientEmail = owner.user.email;
			recipientName = owner.user.name || "Usuario";
		}

		// Handle bills_digest template mode
		if (useTemplate === "bills_digest") {
			const bills = previousData.bills as BillDigestItem[] | undefined;
			const summary = previousData.summary as BillsDigestSummary | undefined;
			const period = previousData.period as string | undefined;
			const dashboardUrl = previousData.dashboardUrl as string | undefined;
			const organizationName = previousData.organizationName as string | undefined;

			// Fetch organization for sender address
			const organization = await findOrganizationById(context.db, context.organizationId);

			if (!bills || bills.length === 0) {
				return createSkippedResult(
					consequence,
					"No bills data available from previous action. Use fetch_bills_report before send_email with bills_digest template.",
				);
			}

			if (context.dryRun) {
				return createActionResult(consequence, true, {
					billsCount: bills.length,
					dryRun: true,
					period,
					summary,
					to: recipientEmail,
					useTemplate: "bills_digest",
				});
			}

			if (!context.resendClient) {
				return createActionResult(
					consequence,
					false,
					undefined,
					"Email client not configured",
				);
			}

			try {
				await sendBillsDigestEmail(context.resendClient, {
					bills,
					dashboardUrl: dashboardUrl || "",
					detailLevel: "detailed",
					email: recipientEmail,
					from: buildEmailFrom(organization?.slug),
					organizationName: organizationName || "",
					period: period || "proximos dias",
					summary: summary || {
						totalExpenseAmount: "R$ 0,00",
						totalIncomeAmount: "R$ 0,00",
						totalOverdue: 0,
						totalPending: 0,
					},
					userName: recipientName,
				});

				return createActionResult(consequence, true, {
					billsCount: bills.length,
					period,
					to: recipientEmail,
					useTemplate: "bills_digest",
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				return createActionResult(consequence, false, undefined, message);
			}
		}

		// Handle visual template mode
		if (useTemplate === "visual") {
			const template = emailTemplate as EmailTemplate | undefined;

			if (!template || !template.blocks || template.blocks.length === 0) {
				return createSkippedResult(
					consequence,
					"Visual template is empty. Use the email builder to create a template.",
				);
			}

			// Build data context for template variables
			const organization = await findOrganizationById(context.db, context.organizationId);
			const summary = previousData.summary as BillsDigestSummary | undefined;
			const templateData: Record<string, unknown> = {
				...previousData,
				billsData: previousData.bills, // For table renderer (array)
				bills: { // For template variables (object)
					total: summary?.totalExpenseAmount || "R$ 0,00",
					count: previousData.billsCount || 0,
					overdue_count: summary?.totalOverdue || 0,
					pending_count: summary?.totalPending || 0,
				},
				organization: {
					name: organization?.name || "",
				},
				user: {
					name: recipientName,
					email: recipientEmail,
				},
				date: {
					today: new Date().toLocaleDateString("pt-BR"),
					period: previousData.period || "",
				},
				app: {
					url: process.env.APP_URL || "https://app.montte.co",
				},
			};

			// Get attachment from previous action (format_data output)
			let attachment: AttachmentData | undefined;
			if (includeAttachment) {
				const attachmentOutput = previousData.attachment as AttachmentData | undefined;
				if (attachmentOutput) {
					attachment = attachmentOutput;
				}
			}

			if (context.dryRun) {
				return createActionResult(consequence, true, {
					attachment: attachment
						? { contentType: attachment.contentType, filename: attachment.filename }
						: undefined,
					blocksCount: template.blocks.length,
					dryRun: true,
					to: recipientEmail,
					useTemplate: "visual",
				});
			}

			if (!context.resendClient) {
				return createActionResult(
					consequence,
					false,
					undefined,
					"Email client not configured",
				);
			}

			try {
				// Render the visual template to HTML
				const emailSubject = subject
					? processSubject(subject, templateData)
					: "Notificação";
				const renderedHtml = await renderEmailBlocks(template, templateData, emailSubject);

				// Build email options
				const emailOptions: Parameters<typeof context.resendClient.emails.send>[0] = {
					from: buildEmailFrom(organization?.slug),
					html: renderedHtml,
					subject: emailSubject,
					to: recipientEmail,
				};

				// Add attachment if available
				if (attachment) {
					emailOptions.attachments = [
						{
							content: Buffer.from(attachment.content, "base64"),
							filename: attachment.filename,
						},
					];
				}

				console.log(`[SendEmail] Sending visual email to: ${recipientEmail}, subject: ${emailSubject}`);
				await context.resendClient.emails.send(emailOptions);
				console.log(`[SendEmail] Email sent successfully!`);

				return createActionResult(consequence, true, {
					attachment: attachment
						? { contentType: attachment.contentType, filename: attachment.filename }
						: undefined,
					blocksCount: template.blocks.length,
					subject: emailSubject,
					to: recipientEmail,
					useTemplate: "visual",
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error";
				return createActionResult(consequence, false, undefined, message);
			}
		}

		// Standard email with template variables (custom HTML)
		if (!subject || !body) {
			return createSkippedResult(consequence, "Subject and body are required");
		}

		// Fetch organization for sender address
		const organization = await findOrganizationById(context.db, context.organizationId);

		// Create template context with event data AND previous action output data
		const templateContext = createTemplateContext(context.eventData, previousData);
		const processedSubject = renderTemplate(subject, templateContext);
		const processedBody = renderTemplate(body, templateContext);

		// Get attachment from previous action (format_data output)
		let attachment: AttachmentData | undefined;
		if (includeAttachment) {
			const attachmentOutput = previousData.attachment as
				| AttachmentData
				| undefined;
			if (attachmentOutput) {
				attachment = attachmentOutput;
			}
		}

		if (context.dryRun) {
			return createActionResult(consequence, true, {
				attachment: attachment
					? { contentType: attachment.contentType, filename: attachment.filename }
					: undefined,
				body: processedBody,
				dryRun: true,
				subject: processedSubject,
				to: recipientEmail,
			});
		}

		if (!context.resendClient) {
			return createActionResult(
				consequence,
				false,
				undefined,
				"Email client not configured",
			);
		}

		try {
			// Build email options with optional attachment
			const emailOptions: Parameters<typeof context.resendClient.emails.send>[0] = {
				from: buildEmailFrom(organization?.slug),
				html: processedBody,
				subject: processedSubject,
				to: recipientEmail,
			};

			// Add attachment if available
			if (attachment) {
				emailOptions.attachments = [
					{
						content: Buffer.from(attachment.content, "base64"),
						filename: attachment.filename,
					},
				];
			}

			await context.resendClient.emails.send(emailOptions);

			return createActionResult(consequence, true, {
				attachment: attachment
					? { contentType: attachment.contentType, filename: attachment.filename }
					: undefined,
				body: processedBody,
				subject: processedSubject,
				to: recipientEmail,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error";
			return createActionResult(consequence, false, undefined, message);
		}
	},

	validate(config) {
		const errors: string[] = [];

		// bills_digest template doesn't require subject/body
		if (config.useTemplate === "bills_digest") {
			return { errors, valid: true };
		}

		// visual template validation
		if (config.useTemplate === "visual") {
			const template = config.emailTemplate as EmailTemplate | undefined;
			if (!template || !template.blocks || template.blocks.length === 0) {
				errors.push("Visual template must have at least one block");
			}
			return { errors, valid: errors.length === 0 };
		}

		if (!config.subject) {
			errors.push("Subject is required");
		}
		if (!config.body) {
			errors.push("Body is required");
		}
		if (config.to === "custom" && !config.customEmail) {
			errors.push(
				"Custom email is required when recipient is set to custom",
			);
		}
		return { errors, valid: errors.length === 0 };
	},
};
