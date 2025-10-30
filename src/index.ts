#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { registerTools } from "./tools/index.js";
import { DEFAULT_LOG_DIR } from "./constants.js";
import packageJson from "../package.json" with { type: "json" };

// Create MCP server instance
const server = new FastMCP({
  name: "mcp-server-error-helper",
  version: packageJson.version as `${number}.${number}.${number}`,
});

// Register all tools
registerTools(server);

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("MCP Error Helper starting...");
  console.log(`Claude MCP logs at: ${DEFAULT_LOG_DIR}`);

  server.start({ transportType: "stdio" });

  console.log("MCP Error Helper running via stdio");
  console.log("Available tools:");
  console.log(
    "  - mcp_log_get_recent_logs: Get recent error logs from an MCP server"
  );
  console.log(
    "  - mcp_log_get_error_details: Analyze errors and get suggested actions"
  );
  console.log(
    "  - mcp_log_list_servers: List all available MCP servers with logs"
  );
}

// Run the server
main().catch((error) => {
  console.error("Fatal server error:", error);
  process.exit(1);
});
