import type { RouterOutput } from "@packages/api/client";
import { Combobox } from "@packages/ui/components/combobox";

type CostCenter = RouterOutput["costCenters"]["getAll"][0];

type CostCenterComboboxProps = {
	costCenters: CostCenter[];
	value: string;
	onValueChange: (value: string) => void;
	onCreate?: (name: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
};

export function CostCenterCombobox({
	costCenters,
	value,
	onValueChange,
	onCreate,
	placeholder = "Selecione um centro de custo",
	disabled,
	className,
}: CostCenterComboboxProps) {
	const options = [
		{ label: "Nenhum", value: "" },
		...costCenters.map((cc) => ({
			label: cc.code ? `${cc.name} (${cc.code})` : cc.name,
			value: cc.id,
		})),
	];

	return (
		<Combobox
			className={className}
			createLabel={onCreate ? "Criar centro de custo" : undefined}
			disabled={disabled}
			emptyMessage="Nenhum resultado encontrado"
			onCreate={onCreate}
			onValueChange={onValueChange}
			options={options}
			placeholder={placeholder}
			searchPlaceholder="Pesquisar"
			value={value}
		/>
	);
}
