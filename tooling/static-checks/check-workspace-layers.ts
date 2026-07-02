#!/usr/bin/env bun

import { runWorkspaceLayerChecks } from "./src/workspace-layers";

if (runWorkspaceLayerChecks()) {
   process.exit(1);
}
