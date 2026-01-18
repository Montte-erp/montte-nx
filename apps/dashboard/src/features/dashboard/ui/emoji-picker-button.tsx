import { Button } from "@packages/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@packages/ui/components/popover";
import { Smile } from "lucide-react";
import { useState } from "react";

type EmojiPickerButtonProps = {
	onSelect: (emoji: string) => void;
};

const EMOJI_CATEGORIES = {
	"Uso comum": [
		"😀",
		"😃",
		"😄",
		"😁",
		"😊",
		"🙂",
		"😉",
		"😍",
		"🥰",
		"😘",
		"😎",
		"🤩",
	],
	Gestos: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "👌", "🤙", "💪", "🙏", "👋"],
	Financeiro: [
		"💰",
		"💵",
		"💸",
		"💳",
		"🏦",
		"📈",
		"📉",
		"📊",
		"💹",
		"🪙",
		"💎",
		"🏧",
	],
	Objetos: [
		"📝",
		"📋",
		"📌",
		"📎",
		"🔗",
		"📁",
		"📂",
		"🗂️",
		"📅",
		"📆",
		"🗓️",
		"⏰",
	],
	Simbolos: [
		"✅",
		"❌",
		"⭐",
		"🔥",
		"💡",
		"⚠️",
		"🚀",
		"🎯",
		"🏆",
		"🎉",
		"✨",
		"💥",
	],
};

export function EmojiPickerButton({ onSelect }: EmojiPickerButtonProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleSelect = (emoji: string) => {
		onSelect(emoji);
		setIsOpen(false);
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" type="button">
					<Smile className="h-4 w-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-2" align="start">
				<div className="space-y-3">
					{Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
						<div key={category}>
							<span className="text-xs font-medium text-muted-foreground mb-1 block">
								{category}
							</span>
							<div className="grid grid-cols-6 gap-1">
								{emojis.map((emoji) => (
									<button
										key={emoji}
										type="button"
										onClick={() => handleSelect(emoji)}
										className="flex items-center justify-center size-8 rounded hover:bg-accent transition-colors text-lg"
									>
										{emoji}
									</button>
								))}
							</div>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
