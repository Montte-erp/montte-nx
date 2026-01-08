import { DashboardTabBar } from "./dashboard-tab-bar";

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-10 flex h-12 shrink-0 items-center bg-sidebar text-sidebar-foreground transition-[width,height] ease-linear overflow-x-auto">
			<DashboardTabBar />
		</header>
	);
}
