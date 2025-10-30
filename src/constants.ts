/**
 * Configuration constants for the MCP Log Monitor Server
 */

import * as os from "os";
import * as path from "path";

// Character limit for responses to prevent overwhelming the LLM
export const CHARACTER_LIMIT = 25000;

// Claude Desktop's default MCP log directory based on platform
// These are the standard locations where Claude stores MCP server logs
function getDefaultClaudeLogDir(): string {
  const platform = process.platform;
  const homeDir = os.homedir();

  switch (platform) {
    case "darwin": // macOS
      return path.join(homeDir, "Library", "Logs", "Claude");

    case "win32": // Windows
      const appData =
        process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
      return path.join(appData, "Claude", "logs");

    default: // Linux and others
      return path.join(homeDir, ".config", "Claude", "logs");
  }
}

// Default MCP log database directory
// Points to Claude Desktop's standard log location
export const DEFAULT_LOG_DIR = getDefaultClaudeLogDir();

// Maximum number of errors to return by default
export const DEFAULT_ERROR_LIMIT = 10;

// Maximum number of log entries to scan
export const MAX_LOG_SCAN_LIMIT = 1000;

// Response format options
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}
