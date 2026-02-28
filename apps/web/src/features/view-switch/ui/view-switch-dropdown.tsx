import { Button } from "@packages/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Check } from "lucide-react";
import type { ViewConfig } from "../hooks/use-view-switch";

interface ViewSwitchDropdownProps<T extends string> {
  views: ViewConfig<T>[];
  currentView: T;
  onViewChange: (id: T) => void;
}

export function ViewSwitchDropdown<T extends string>({
  views,
  currentView,
  onViewChange,
}: ViewSwitchDropdownProps<T>) {
  const active = views.find((v) => v.id === currentView) ?? views[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="outline" type="button">
          {active.icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Visualização</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.map((view) => (
          <DropdownMenuItem
            className="flex items-center justify-between gap-4"
            key={view.id}
            onClick={() => onViewChange(view.id)}
          >
            <span className="flex items-center gap-2">
              {view.icon}
              {view.label}
            </span>
            {currentView === view.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
