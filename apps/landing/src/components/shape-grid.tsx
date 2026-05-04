import { useEffect, useRef } from "react";

import "./shape-grid.css";

type ShapeGridDirection = "diagonal" | "down" | "left" | "right" | "up";
type ShapeGridShape = "circle" | "hexagon" | "square" | "triangle";

type ShapeGridProps = {
   borderColor?: string;
   className?: string;
   direction?: ShapeGridDirection;
   hoverFillColor?: string;
   hoverTrailAmount?: number;
   shape?: ShapeGridShape;
   speed?: number;
   squareSize?: number;
};

type GridCell = {
   x: number;
   y: number;
};

export function ShapeGrid({
   borderColor = "rgba(255,255,255,0.18)",
   className = "",
   direction = "diagonal",
   hoverFillColor = "rgba(255,255,255,0.12)",
   hoverTrailAmount = 4,
   shape = "circle",
   speed = 0.35,
   squareSize = 28,
}: ShapeGridProps) {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const requestRef = useRef<number | null>(null);
   const numSquaresX = useRef(0);
   const numSquaresY = useRef(0);
   const gridOffset = useRef({ x: 0, y: 0 });
   const hoveredSquare = useRef<GridCell | null>(null);
   const trailCells = useRef<GridCell[]>([]);
   const cellOpacities = useRef(new Map<string, number>());

   useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const isHex = shape === "hexagon";
      const isTri = shape === "triangle";
      const hexHoriz = squareSize * 1.5;
      const hexVert = squareSize * Math.sqrt(3);

      const resizeCanvas = () => {
         canvas.width = canvas.offsetWidth;
         canvas.height = canvas.offsetHeight;
         numSquaresX.current = Math.ceil(canvas.width / squareSize) + 1;
         numSquaresY.current = Math.ceil(canvas.height / squareSize) + 1;
      };

      const drawHex = (cx: number, cy: number, size: number) => {
         ctx.beginPath();
         for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const vx = cx + size * Math.cos(angle);
            const vy = cy + size * Math.sin(angle);
            if (i === 0) {
               ctx.moveTo(vx, vy);
               continue;
            }
            ctx.lineTo(vx, vy);
         }
         ctx.closePath();
      };

      const drawCircle = (cx: number, cy: number, size: number) => {
         ctx.beginPath();
         ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
         ctx.closePath();
      };

      const drawTriangle = (
         cx: number,
         cy: number,
         size: number,
         flip: boolean,
      ) => {
         ctx.beginPath();
         if (flip) {
            ctx.moveTo(cx, cy + size / 2);
            ctx.lineTo(cx + size / 2, cy - size / 2);
            ctx.lineTo(cx - size / 2, cy - size / 2);
         } else {
            ctx.moveTo(cx, cy - size / 2);
            ctx.lineTo(cx + size / 2, cy + size / 2);
            ctx.lineTo(cx - size / 2, cy + size / 2);
         }
         ctx.closePath();
      };

      const updateCellOpacities = () => {
         const targets = new Map<string, number>();

         if (hoveredSquare.current) {
            targets.set(
               `${hoveredSquare.current.x},${hoveredSquare.current.y}`,
               1,
            );
         }

         if (hoverTrailAmount > 0) {
            for (let i = 0; i < trailCells.current.length; i++) {
               const trailCell = trailCells.current[i];
               const key = `${trailCell.x},${trailCell.y}`;
               if (!targets.has(key)) {
                  targets.set(
                     key,
                     (trailCells.current.length - i) /
                        (trailCells.current.length + 1),
                  );
               }
            }
         }

         for (const key of targets.keys()) {
            if (!cellOpacities.current.has(key)) {
               cellOpacities.current.set(key, 0);
            }
         }

         for (const [key, opacity] of cellOpacities.current) {
            const target = targets.get(key) ?? 0;
            const next = opacity + (target - opacity) * 0.15;
            if (next < 0.005) {
               cellOpacities.current.delete(key);
               continue;
            }
            cellOpacities.current.set(key, next);
         }
      };

      const drawGrid = () => {
         ctx.clearRect(0, 0, canvas.width, canvas.height);

         if (isHex) {
            const colShift = Math.floor(gridOffset.current.x / hexHoriz);
            const offsetX =
               ((gridOffset.current.x % hexHoriz) + hexHoriz) % hexHoriz;
            const offsetY =
               ((gridOffset.current.y % hexVert) + hexVert) % hexVert;
            const cols = Math.ceil(canvas.width / hexHoriz) + 3;
            const rows = Math.ceil(canvas.height / hexVert) + 3;

            for (let col = -2; col < cols; col++) {
               for (let row = -2; row < rows; row++) {
                  const cx = col * hexHoriz + offsetX;
                  const cy =
                     row * hexVert +
                     ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0) +
                     offsetY;
                  const cellKey = `${col},${row}`;
                  const alpha = cellOpacities.current.get(cellKey);

                  if (alpha) {
                     ctx.globalAlpha = alpha;
                     drawHex(cx, cy, squareSize);
                     ctx.fillStyle = hoverFillColor;
                     ctx.fill();
                     ctx.globalAlpha = 1;
                  }

                  drawHex(cx, cy, squareSize);
                  ctx.strokeStyle = borderColor;
                  ctx.stroke();
               }
            }
            return;
         }

         if (isTri) {
            const halfW = squareSize / 2;
            const colShift = Math.floor(gridOffset.current.x / halfW);
            const rowShift = Math.floor(gridOffset.current.y / squareSize);
            const offsetX = ((gridOffset.current.x % halfW) + halfW) % halfW;
            const offsetY =
               ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
            const cols = Math.ceil(canvas.width / halfW) + 4;
            const rows = Math.ceil(canvas.height / squareSize) + 4;

            for (let col = -2; col < cols; col++) {
               for (let row = -2; row < rows; row++) {
                  const cx = col * halfW + offsetX;
                  const cy = row * squareSize + squareSize / 2 + offsetY;
                  const flip =
                     (((col + colShift + row + rowShift) % 2) + 2) % 2 !== 0;
                  const cellKey = `${col},${row}`;
                  const alpha = cellOpacities.current.get(cellKey);

                  if (alpha) {
                     ctx.globalAlpha = alpha;
                     drawTriangle(cx, cy, squareSize, flip);
                     ctx.fillStyle = hoverFillColor;
                     ctx.fill();
                     ctx.globalAlpha = 1;
                  }

                  drawTriangle(cx, cy, squareSize, flip);
                  ctx.strokeStyle = borderColor;
                  ctx.stroke();
               }
            }
            return;
         }

         const offsetX =
            ((gridOffset.current.x % squareSize) + squareSize) % squareSize;
         const offsetY =
            ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
         const cols = Math.ceil(canvas.width / squareSize) + 3;
         const rows = Math.ceil(canvas.height / squareSize) + 3;

         for (let col = -2; col < cols; col++) {
            for (let row = -2; row < rows; row++) {
               const cellKey = `${col},${row}`;
               const alpha = cellOpacities.current.get(cellKey);

               if (shape === "circle") {
                  const cx = col * squareSize + squareSize / 2 + offsetX;
                  const cy = row * squareSize + squareSize / 2 + offsetY;

                  if (alpha) {
                     ctx.globalAlpha = alpha;
                     drawCircle(cx, cy, squareSize);
                     ctx.fillStyle = hoverFillColor;
                     ctx.fill();
                     ctx.globalAlpha = 1;
                  }

                  drawCircle(cx, cy, squareSize);
                  ctx.strokeStyle = borderColor;
                  ctx.stroke();
                  continue;
               }

               const sx = col * squareSize + offsetX;
               const sy = row * squareSize + offsetY;

               if (alpha) {
                  ctx.globalAlpha = alpha;
                  ctx.fillStyle = hoverFillColor;
                  ctx.fillRect(sx, sy, squareSize, squareSize);
                  ctx.globalAlpha = 1;
               }

               ctx.strokeStyle = borderColor;
               ctx.strokeRect(sx, sy, squareSize, squareSize);
            }
         }
      };

      const updateAnimation = () => {
         const effectiveSpeed = Math.max(speed, 0.1);
         const wrapX = isHex ? hexHoriz * 2 : squareSize;
         const wrapY = isHex ? hexVert : isTri ? squareSize * 2 : squareSize;

         if (direction === "right") {
            gridOffset.current.x =
               (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX;
         }

         if (direction === "left") {
            gridOffset.current.x =
               (gridOffset.current.x + effectiveSpeed + wrapX) % wrapX;
         }

         if (direction === "up") {
            gridOffset.current.y =
               (gridOffset.current.y + effectiveSpeed + wrapY) % wrapY;
         }

         if (direction === "down") {
            gridOffset.current.y =
               (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY;
         }

         if (direction === "diagonal") {
            gridOffset.current.x =
               (gridOffset.current.x - effectiveSpeed + wrapX) % wrapX;
            gridOffset.current.y =
               (gridOffset.current.y - effectiveSpeed + wrapY) % wrapY;
         }

         updateCellOpacities();
         drawGrid();
         requestRef.current = requestAnimationFrame(updateAnimation);
      };

      const addTrailCell = () => {
         if (!hoveredSquare.current || hoverTrailAmount <= 0) return;

         trailCells.current.unshift({
            x: hoveredSquare.current.x,
            y: hoveredSquare.current.y,
         });

         if (trailCells.current.length > hoverTrailAmount) {
            trailCells.current.length = hoverTrailAmount;
         }
      };

      const setHoveredCell = (cell: GridCell) => {
         if (
            hoveredSquare.current &&
            hoveredSquare.current.x === cell.x &&
            hoveredSquare.current.y === cell.y
         ) {
            return;
         }

         addTrailCell();
         hoveredSquare.current = cell;
      };

      const handleMouseMove = (event: MouseEvent) => {
         const rect = canvas.getBoundingClientRect();
         const mouseX = event.clientX - rect.left;
         const mouseY = event.clientY - rect.top;

         if (isHex) {
            const colShift = Math.floor(gridOffset.current.x / hexHoriz);
            const offsetX =
               ((gridOffset.current.x % hexHoriz) + hexHoriz) % hexHoriz;
            const offsetY =
               ((gridOffset.current.y % hexVert) + hexVert) % hexVert;
            const adjustedX = mouseX - offsetX;
            const adjustedY = mouseY - offsetY;
            const col = Math.round(adjustedX / hexHoriz);
            const rowOffset = (col + colShift) % 2 !== 0 ? hexVert / 2 : 0;
            const row = Math.round((adjustedY - rowOffset) / hexVert);

            setHoveredCell({ x: col, y: row });
            return;
         }

         if (isTri) {
            const halfW = squareSize / 2;
            const offsetX = ((gridOffset.current.x % halfW) + halfW) % halfW;
            const offsetY =
               ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
            const adjustedX = mouseX - offsetX;
            const adjustedY = mouseY - offsetY;
            const col = Math.round(adjustedX / halfW);
            const row = Math.floor(adjustedY / squareSize);

            setHoveredCell({ x: col, y: row });
            return;
         }

         const offsetX =
            ((gridOffset.current.x % squareSize) + squareSize) % squareSize;
         const offsetY =
            ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
         const adjustedX = mouseX - offsetX;
         const adjustedY = mouseY - offsetY;

         if (shape === "circle") {
            setHoveredCell({
               x: Math.round(adjustedX / squareSize),
               y: Math.round(adjustedY / squareSize),
            });
            return;
         }

         setHoveredCell({
            x: Math.floor(adjustedX / squareSize),
            y: Math.floor(adjustedY / squareSize),
         });
      };

      const handleMouseLeave = () => {
         addTrailCell();
         hoveredSquare.current = null;
      };

      window.addEventListener("resize", resizeCanvas);
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseleave", handleMouseLeave);
      resizeCanvas();
      requestRef.current = requestAnimationFrame(updateAnimation);

      return () => {
         window.removeEventListener("resize", resizeCanvas);
         canvas.removeEventListener("mousemove", handleMouseMove);
         canvas.removeEventListener("mouseleave", handleMouseLeave);

         if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
         }
      };
   }, [
      borderColor,
      direction,
      hoverFillColor,
      hoverTrailAmount,
      shape,
      speed,
      squareSize,
   ]);

   return (
      <canvas ref={canvasRef} className={`shapegrid-canvas ${className}`} />
   );
}

export function ShapeGridAside() {
   return (
      <aside
         className="relative hidden flex-1 overflow-hidden bg-accent lg:block"
         aria-hidden="true"
      >
         <ShapeGrid
            borderColor="rgba(35, 82, 67, 0.34)"
            className="opacity-80"
            hoverFillColor="rgba(35, 82, 67, 0.16)"
            shape="square"
            squareSize={32}
         />
      </aside>
   );
}
