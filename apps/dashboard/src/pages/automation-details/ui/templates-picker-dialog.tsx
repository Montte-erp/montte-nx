import type { AutomationTemplate } from "@packages/database/repositories/automation-template-repository";
import { Badge } from "@packages/ui/components/badge";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@packages/ui/components/command";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
	Bell,
	BookTemplate,
	ClipboardList,
	FileBarChart,
	FileText,
	LayoutTemplate,
	Mail,
	Settings,
	Sparkles,
} from "lucide-react";
import { useTRPC } from "@/integrations/clients";

// ============================================
// Types
// ============================================

type TemplateCategory =
	| "bill_management"
	| "transaction_processing"
	| "notifications"
	| "reporting"
	| "custom";

type TemplatesPickerDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (template: AutomationTemplate) => void;
};

// ============================================
// Category Metadata
// ============================================

const CATEGORY_META: Record<
	TemplateCategory,
	{ label: string; icon: React.ComponentType<{ className?: string }> }
> = {
	bill_management: { label: "Gestao de Contas", icon: ClipboardList },
	transaction_processing: { label: "Processamento de Transacoes", icon: FileText },
	notifications: { label: "Notificacoes", icon: Bell },
	reporting: { label: "Relatorios", icon: FileBarChart },
	custom: { label: "Personalizados", icon: Settings },
};

// Icon mapping for template icons (stored in DB as string)
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
	ClipboardList: ClipboardList,
	FileBarChart: FileBarChart,
	Mail: Mail,
	Bell: Bell,
	FileText: FileText,
	Settings: Settings,
	LayoutTemplate: LayoutTemplate,
	Sparkles: Sparkles,
	BookTemplate: BookTemplate,
};

// ============================================
// Component
// ============================================

export function TemplatesPickerDialog({
	open,
	onOpenChange,
	onSelect,
}: TemplatesPickerDialogProps) {
	const trpc = useTRPC();

	const { data: templates, isLoading } = useQuery({
		...trpc.automationTemplates.list.queryOptions(),
		enabled: open,
	});

	const handleSelect = (template: AutomationTemplate) => {
		onSelect(template);
		onOpenChange(false);
	};

	// Group templates by category
	const templatesByCategory = templates?.reduce(
		(acc, template) => {
			const category = template.category as TemplateCategory;
			if (!acc[category]) {
				acc[category] = [];
			}
			acc[category].push(template);
			return acc;
		},
		{} as Record<TemplateCategory, typeof templates>,
	);

	// Separate system and custom templates
	const systemTemplates = templates?.filter((t) => t.isSystemTemplate) ?? [];
	const customTemplates = templates?.filter((t) => !t.isSystemTemplate) ?? [];

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Selecionar Template"
			description="Escolha um template para criar sua automacao"
			showCloseButton={false}
		>
			<CommandInput placeholder="Buscar template..." />
			<CommandList>
				{isLoading ? (
					<div className="p-4 space-y-3">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
				) : !templates || templates.length === 0 ? (
					<CommandEmpty>
						<div className="flex flex-col items-center gap-2 py-6">
							<BookTemplate className="size-8 text-muted-foreground/50" />
							<p>Nenhum template disponivel</p>
							<p className="text-xs text-muted-foreground">
								Templates serao adicionados em breve
							</p>
						</div>
					</CommandEmpty>
				) : (
					<>
						{/* System Templates by Category */}
						{systemTemplates.length > 0 && (
							<>
								<CommandGroup heading="Templates do Sistema">
									{Object.entries(templatesByCategory ?? {})
										.filter(([_, categoryTemplates]) =>
											categoryTemplates?.some((t) => t.isSystemTemplate),
										)
										.map(([category, categoryTemplates]) => {
											const categoryMeta = CATEGORY_META[category as TemplateCategory];
											const systemCategoryTemplates = categoryTemplates?.filter(
												(t) => t.isSystemTemplate,
											);

											if (!systemCategoryTemplates?.length) return null;

											return systemCategoryTemplates.map((template) => {
												const TemplateIcon = template.icon
													? ICON_MAP[template.icon] ?? categoryMeta.icon
													: categoryMeta.icon;

												return (
													<CommandItem
														key={template.id}
														value={`${template.name}-${template.description}`}
														onSelect={() => handleSelect(template)}
													>
														<TemplateIcon className="size-4 text-primary" />
														<div className="flex flex-1 flex-col">
															<div className="flex items-center gap-2">
																<span>{template.name}</span>
																<Badge variant="secondary" className="text-[10px] px-1 py-0">
																	{categoryMeta.label}
																</Badge>
															</div>
															<span className="text-xs text-muted-foreground line-clamp-1">
																{template.description}
															</span>
														</div>
														{template.usageCount > 0 && (
															<span className="text-[10px] text-muted-foreground">
																{template.usageCount} usos
															</span>
														)}
													</CommandItem>
												);
											});
										})}
								</CommandGroup>
								<CommandSeparator />
							</>
						)}

						{/* Custom/Organization Templates */}
						{customTemplates.length > 0 && (
							<CommandGroup heading="Meus Templates">
								{customTemplates.map((template) => {
									const categoryMeta =
										CATEGORY_META[template.category as TemplateCategory];
									const TemplateIcon = template.icon
										? ICON_MAP[template.icon] ?? Settings
										: Settings;

									return (
										<CommandItem
											key={template.id}
											value={`custom-${template.name}-${template.description}`}
											onSelect={() => handleSelect(template)}
										>
											<TemplateIcon className="size-4" />
											<div className="flex flex-1 flex-col">
												<div className="flex items-center gap-2">
													<span>{template.name}</span>
													{categoryMeta && (
														<Badge
															variant="outline"
															className="text-[10px] px-1 py-0"
														>
															{categoryMeta.label}
														</Badge>
													)}
												</div>
												<span className="text-xs text-muted-foreground line-clamp-1">
													{template.description}
												</span>
											</div>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}
					</>
				)}
			</CommandList>
		</CommandDialog>
	);
}
