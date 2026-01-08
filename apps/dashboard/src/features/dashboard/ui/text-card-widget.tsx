type TextCardConfig = {
	type: "text_card";
	content: string;
};

type TextCardWidgetProps = {
	config: TextCardConfig;
};

export function TextCardWidget({ config }: TextCardWidgetProps) {
	// Simple markdown-like rendering
	const renderContent = (content: string) => {
		const lines = content.split("\n");
		return lines.map((line, index) => {
			// Headers
			if (line.startsWith("# ")) {
				return (
					<h1 key={`line-${index + 1}`} className="text-2xl font-bold mb-2">
						{line.substring(2)}
					</h1>
				);
			}
			if (line.startsWith("## ")) {
				return (
					<h2 key={`line-${index + 1}`} className="text-xl font-semibold mb-2">
						{line.substring(3)}
					</h2>
				);
			}
			if (line.startsWith("### ")) {
				return (
					<h3 key={`line-${index + 1}`} className="text-lg font-medium mb-2">
						{line.substring(4)}
					</h3>
				);
			}
			// Empty line
			if (line.trim() === "") {
				return <br key={`line-${index + 1}`} />;
			}
			// Regular paragraph
			return (
				<p key={`line-${index + 1}`} className="text-sm text-muted-foreground mb-1">
					{line}
				</p>
			);
		});
	};

	return (
		<div className="prose prose-sm dark:prose-invert max-w-none h-full overflow-auto">
			{renderContent(config.content)}
		</div>
	);
}
