import type { FastMCP } from "fastmcp";

import { registerGetRecentErrorsTool } from "./getRecentErrors.js";
import { registerGetErrorDetailsTool } from "./getErrorDetails.js";
import { registerServerListTool } from "./getServerList.js";

export function registerTools(server: FastMCP): void {
  registerGetRecentErrorsTool(server);
  registerGetErrorDetailsTool(server);
  registerServerListTool(server);
}
