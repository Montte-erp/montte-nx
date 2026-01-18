import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@packages/ui/components/popover";
import { ImageIcon } from "lucide-react";
import { useState } from "react";

type TextCardImageUploadProps = {
	onInsert: (markdown: string) => void;
};

export function TextCardImageUpload({ onInsert }: TextCardImageUploadProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [url, setUrl] = useState("");
	const [altText, setAltText] = useState("");

	const handleInsert = () => {
		if (!url.trim()) return;

		const alt = altText.trim() || "image";
		const markdown = `![${alt}](${url.trim()})`;
		onInsert(markdown);

		setUrl("");
		setAltText("");
		setIsOpen(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleInsert();
		}
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" type="button">
					<ImageIcon className="h-4 w-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80" align="start">
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="image-url">URL da imagem</Label>
						<Input
							id="image-url"
							placeholder="https://exemplo.com/imagem.png"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							onKeyDown={handleKeyDown}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="image-alt">Texto alternativo (opcional)</Label>
						<Input
							id="image-alt"
							placeholder="Descricao da imagem"
							value={altText}
							onChange={(e) => setAltText(e.target.value)}
							onKeyDown={handleKeyDown}
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsOpen(false)}
						>
							Cancelar
						</Button>
						<Button size="sm" onClick={handleInsert} disabled={!url.trim()}>
							Inserir
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
