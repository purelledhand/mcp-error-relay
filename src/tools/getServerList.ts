import type { FastMCP } from "fastmcp";

import { ResponseFormat } from "../constants.js";
import * as logService from "../services/logService.js";
import * as formatter from "../services/formatter.js";
import { z } from "zod";

export function registerServerListTool(server: FastMCP): void {
  server.addTool({
    name: "get_server_list",
    description: DESCRIPTION,
    parameters: ListServersInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (args: unknown) => {
      try {
        const params = args as ListServersInput;
        const servers = logService.getAvailableServers();

        let result: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          result = formatter.formatServersAsMarkdown(
            servers,
            params.include_stats
          );
        } else {
          result = formatter.formatServersAsJson(servers, params.include_stats);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: result,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error listing servers: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  });
}

export const ListServersInputSchema = z
  .object({
    include_stats: z
      .boolean()
      .default(true)
      .describe(
        "Whether to include error statistics for each server (default: true)"
      ),

    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe(
        "Output format: 'markdown' for human-readable or 'json' for machine-readable"
      ),
  })
  .strict();

export type ListServersInput = z.infer<typeof ListServersInputSchema>;

const DESCRIPTION = `List Available MCP Servers

Use this tool FIRST if you don't know which MCP server name to use for error checking.

**WHEN TO USE:**
- A tool failed but you don't know the exact server_name
- You want to see which servers have recent errors
- You're not sure if logs exist for a particular server
- You need to identify which servers are most problematic

**WHAT THIS TOOL SHOWS:**
✅ All available MCP server names (needed for other tools)
✅ Total error counts per server
✅ Recent errors in last 24 hours
✅ When logs were last updated
✅ Full log file paths

**WORKFLOW:**
1. Tool fails, but you're unsure of the server_name
2. Call THIS tool to list all available servers
3. Find the server with recent errors or matching your failed tool
4. Use that server_name to call get_recent_errors

**USE CASES:**
- Error says "slack tool failed" -> List servers -> Find "slack-mcp-server" -> Check its logs
- Multiple tools failing -> List servers -> See which has most errors (24h column) -> Investigate that one first
- New to the system -> List servers -> Understand available MCP infrastructure

**TIP:** Look at the "recent_error_count" (last 24h) to identify servers currently having problems!

Args:
  - include_stats (boolean): Include error statistics for each server (default: true)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For Markdown format: Human-readable list with server names and stats
  For JSON format: Structured data with schema:
  {
    "total": number,              // Number of servers found
    "servers": [
      {
        "server_name": string,    // Name of the MCP server
        "log_file_path": string,  // Full path to log file
        "last_modified": string,  // ISO 8601 timestamp of last update
        "total_errors": number,   // Total error count (if include_stats=true)
        "recent_error_count": number  // Errors in last 24h (if include_stats=true)
      }
    ]
  }

Examples:
  - Don't know server name -> {}
  - Quick server list -> { include_stats: false }
  - Find problematic server -> {} (then check recent_error_count)

Error Handling:
  - Returns empty list if no log files found in configured directory
  - Gracefully handles log files with different formats`;
