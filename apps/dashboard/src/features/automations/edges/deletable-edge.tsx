import {
	BaseEdge,
	EdgeLabelRenderer,
	type EdgeProps,
	getBezierPath,
	useReactFlow,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useState } from "react";

export function DeletableEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	style = {},
	markerEnd,
}: EdgeProps) {
	const { setEdges } = useReactFlow();
	const [isHovered, setIsHovered] = useState(false);

	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	const handleDelete = (event: React.MouseEvent) => {
		event.stopPropagation();
		setEdges((edges) => edges.filter((edge) => edge.id !== id));
	};

	return (
		<>
			<path
				className="react-flow__edge-interaction"
				d={edgePath}
				fill="none"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				stroke="transparent"
				strokeWidth={20}
			/>
			<BaseEdge
				id={id}
				markerEnd={markerEnd}
				path={edgePath}
				style={{
					...style,
					stroke: isHovered ? "hsl(var(--destructive))" : style.stroke,
					strokeWidth: isHovered ? 3 : style.strokeWidth,
				}}
			/>
			<EdgeLabelRenderer>
				{/* Delete button */}
				<div
					className="nodrag nopan pointer-events-auto absolute"
					onMouseEnter={() => setIsHovered(true)}
					onMouseLeave={() => setIsHovered(false)}
					style={{
						transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
					}}
				>
					<button
						className={`
							flex size-5 items-center justify-center rounded-full
							bg-destructive text-destructive-foreground shadow-md
							transition-all duration-200 hover:scale-110
							${isHovered ? "opacity-100 scale-100" : "opacity-0 scale-75"}
						`}
						onClick={handleDelete}
						title="Remover conexão (ou pressione Delete/Backspace)"
						type="button"
					>
						<X className="size-3" />
					</button>
				</div>
			</EdgeLabelRenderer>
		</>
	);
}
