import { AiDevtoolsPanel } from "@tanstack/react-ai-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools";
import type {
   TanStackDevtoolsReactInit,
   TanStackDevtoolsReactPlugin,
} from "@tanstack/react-devtools";

export const devtoolsConfig: TanStackDevtoolsReactInit["config"] = {
   position: "bottom-right",
   openHotkey: ["Shift", "D"],
   hideUntilHover: true,
   requireUrlFlag: true,
};

export const devtoolsEventBusConfig: TanStackDevtoolsReactInit["eventBusConfig"] =
   {
      connectToServerBus: true,
      debug: false,
   };

export const devtoolsPlugins: TanStackDevtoolsReactPlugin[] = [
   { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
   { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
   { name: "TanStack Form", render: <FormDevtoolsPanel /> },
   { name: "TanStack AI", render: <AiDevtoolsPanel /> },
];
