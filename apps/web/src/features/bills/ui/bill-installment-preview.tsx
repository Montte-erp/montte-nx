import { ScrollArea } from "@packages/ui/components/scroll-area";
import { formatBRL, formatDate } from "./bills-columns";

interface InstallmentPreviewItem {
	index: number;
	dueDate: string;
	amount: string;
}

interface BillInstallmentPreviewProps {
	items: InstallmentPreviewItem[];
}

export function BillInstallmentPreview({ items }: BillInstallmentPreviewProps) {
	if (items.length === 0) return null;

	return (
		<div className="border rounded-md overflow-hidden">
			<div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground flex justify-between">
				<span>Parcela</span>
				<span>Vencimento</span>
				<span>Valor</span>
			</div>
			<ScrollArea className="max-h-[200px]">
				<div className="divide-y">
					{items.map((item) => (
						<div
							className="px-3 py-2 flex justify-between text-sm"
							key={`installment-${item.index}`}
						>
							<span className="text-muted-foreground w-12">{item.index}ª</span>
							<span>{formatDate(item.dueDate)}</span>
							<span className="font-medium tabular-nums">
								{formatBRL(item.amount)}
							</span>
						</div>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}
