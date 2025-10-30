import type { FastMCP } from "fastmcp";

import * as logService from "../services/logService.js";
import * as formatter from "../services/formatter.js";
import { z } from "zod";
import { ResponseFormat, DEFAULT_ERROR_LIMIT } from "../constants.js";

export function registerGetRecentErrorsTool(server: FastMCP): void {
  server.addTool({
    name: "get_recent_errors",
    description: DESCRIPTION,
    parameters: GetRecentErrorsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (args: unknown) => {
      try {
        const params = args as GetRecentErrorsInput;
        const errors = logService.getRecentErrors(
          params.server_name,
          params.limit,
          params.tool_name,
          params.hours
        );

        let result: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          result = formatter.formatErrorsAsMarkdown(errors, params.server_name);
        } else {
          result = formatter.formatErrorsAsJson(errors);
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
              text: `Error retrieving logs: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  });
}

/**
 * Schema for getting recent errors from a specific MCP server
 */
const GetRecentErrorsInputSchema = z
  .object({
    server_name: z
      .string()
      .min(1, "Server name must not be empty")
      .describe(
        "Name of the MCP server to query logs from (e.g., 'slack-mcp-server', 'github_mcp')"
      ),

    limit: z
      .number()
      .int()
      .min(1, "Limit must be at least 1")
      .max(100, "Limit cannot exceed 100")
      .default(DEFAULT_ERROR_LIMIT)
      .describe("Maximum number of error entries to return (default: 10)"),

    tool_name: z
      .string()
      .optional()
      .describe("Optional: Filter errors by specific tool name"),

    hours: z
      .number()
      .int()
      .min(1, "Hours must be at least 1")
      .max(168, "Hours cannot exceed 168 (7 days)")
      .optional()
      .describe("Optional: Only return errors from the last N hours"),

    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe(
        "Output format: 'markdown' for human-readable or 'json' for machine-readable"
      ),
  })
  .strict();

type GetRecentErrorsInput = z.infer<typeof GetRecentErrorsInputSchema>;

const DESCRIPTION = `Get Recent MCP Server Errors

⚠️ CALL THIS IMMEDIATELY when ANY MCP tool fails with vague/unclear error messages!

**TRIGGER CONDITIONS - Call this tool when you see:**
- "Error:", "Failed:", "Exception:", "Error occurred"
- "Permission denied", "Unauthorized", "Forbidden", "Access denied"
- "Rate limit", "Too many requests", "429"
- "Timeout", "Timed out", "Connection refused"
- "Not found", "404", "Invalid", "Malformed"
- "Network error", "ECONNREFUSED", "ETIMEDOUT"
- ANY vague error that doesn't explain the root cause
- BEFORE attempting to retry any failed operation

**WHY USE THIS:**
❌ Without logs: Blind retry -> fail -> retry -> fail -> retry (wastes 50-200+ tokens)
✅ With logs: Check logs once (10 tokens) -> see real error -> fix immediately

**TOKEN ECONOMICS:**
- Cost of checking logs: ~10-20 tokens
- Cost of 3-4 blind retries: 50-200 tokens
- ROI: 5-20x token savings per error

**WORKFLOW:**
1. MCP tool fails with unclear error
2. IMMEDIATELY call this tool with server_name
3. Read the detailed error logs
4. Identify root cause (permissions? rate limit? invalid input?)
5. Take correct action (don't retry blindly!)

Args:
  - server_name (string): Name of the MCP server (e.g., 'slack-mcp-server', 'github_mcp')
  - limit (number): Maximum number of errors to return, 1-100 (default: 10)
  - tool_name (string, optional): Filter by specific tool name
  - hours (number, optional): Only show errors from last N hours, 1-168
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For Markdown format: Human-readable error log with timestamps and messages
  For JSON format: Structured data with schema:
  {
    "total": number,              // Number of errors found
    "errors": [
      {
        "timestamp": string,      // ISO 8601 timestamp
        "level": string,          // Log level (ERROR)
        "server_name": string,    // MCP server name
        "tool_name": string,      // Tool that caused the error (optional)
        "message": string,        // Error message
        "error_code": string,     // Error code if available (optional)
        "stack_trace": string,    // Stack trace if available (optional)
        "request_id": string      // Request ID for tracing (optional)
      }
    ]
  }

Examples:
  - Slack tool failed -> IMMEDIATELY: { server_name: "slack-mcp-server", limit: 5 }
  - GitHub API error -> BEFORE RETRY: { server_name: "github_mcp", hours: 1 }
  - Repeated failures -> { server_name: "jira-mcp-server", tool_name: "create_issue" }

Error Handling:
  - Returns error if server_name not found. Use list_servers to see available servers.
  - Returns "No errors found" if the log database has no error entries matching the criteria.`;
