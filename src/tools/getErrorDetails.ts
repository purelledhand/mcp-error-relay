import type { FastMCP } from "fastmcp";

import { ResponseFormat } from "../constants.js";
import * as logService from "../services/logService.js";
import * as formatter from "../services/formatter.js";
import { z } from "zod";

export function registerGetErrorDetailsTool(server: FastMCP): void {
  server.addTool({
    name: "get_error_details",
    description: DESCRIPTION,
    parameters: InputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (args: unknown) => {
      try {
        const params = args as GetErrorDetailsInput;
        const analysis = logService.analyzeError(
          params.server_name,
          params.error_message,
          params.include_stack_trace
        );

        if (!analysis) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No error found matching "${params.error_message}" in ${params.server_name} logs. Try using get_recent_errors first to see available errors.`,
              },
            ],
          };
        }

        let result: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          result = formatter.formatAnalysisAsMarkdown(analysis);
        } else {
          result = formatter.formatAnalysisAsJson(analysis);
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
              text: `Error analyzing error details: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  });
}

/**
 * Schema for getting detailed error analysis
 */
const InputSchema = z
  .object({
    server_name: z
      .string()
      .min(1, "Server name must not be empty")
      .describe("Name of the MCP server where the error occurred"),

    error_message: z
      .string()
      .min(1, "Error message must not be empty")
      .describe("The error message or pattern to search for"),

    include_stack_trace: z
      .boolean()
      .default(false)
      .describe(
        "Whether to include full stack traces in the response (default: false)"
      ),

    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe(
        "Output format: 'markdown' for human-readable or 'json' for machine-readable"
      ),
  })
  .strict();

type GetErrorDetailsInput = z.infer<typeof InputSchema>;

const DESCRIPTION = `get detailed error analysis

Use this AFTER getting recent errors when you need actionable solutions and root cause analysis.

**WHEN TO USE:**
- You got error logs but need to understand WHY it happened
- You need specific steps to fix the problem
- The same error occurred multiple times (pattern analysis)
- You need stack traces for deeper debugging

**WHAT THIS TOOL DOES:**
✅ Identifies ROOT CAUSE (not just symptoms)
✅ Provides ACTIONABLE steps to fix the issue
✅ Finds RELATED errors to spot patterns
✅ Analyzes if error is recurring (warns against pointless retries)

**WORKFLOW:**
1. Get recent errors using get_recent_errors
2. Copy the error message you want to analyze
3. Call THIS tool with that error message
4. Get: Root cause + Specific fix actions + Pattern warnings

**BUILT-IN ERROR PATTERN RECOGNITION:**
- Permission/Auth errors -> Suggests checking credentials, scopes, permissions
- Rate limit errors -> Suggests backoff strategies, caching, tier upgrades
- Timeout errors -> Suggests increasing timeout, chunking requests
- Not found errors -> Suggests verifying IDs, checking deletions
- Network errors -> Suggests connectivity checks, firewall settings
- Invalid input errors -> Suggests validation, format checking
- Server errors (5xx) -> Identifies as provider-side, suggests waiting

**EXAMPLE USE CASE:**
Error: "Failed to send message"
→ Get recent errors: shows "missing_scope: chat:write"
→ Analyze error: ROOT CAUSE = "Permission error"
                 ACTIONS = ["Add chat:write OAuth scope", "Regenerate token"]
→ Fix immediately instead of retrying 4+ times!

Args:
  - server_name (string): Name of the MCP server where error occurred
  - error_message (string): The error message or pattern to search for
  - include_stack_trace (boolean): Include full stack traces (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For Markdown format: Human-readable analysis with root cause and action steps
  For JSON format: Structured data with schema:
  {
    "root_cause": string,           // Identified root cause of the error
    "error": {                      // The original error details
      "timestamp": string,
      "server_name": string,
      "tool_name": string,
      "message": string,
      "stack_trace": string         // Only if include_stack_trace is true
    },
    "suggested_actions": string[],  // List of actionable steps to resolve
    "related_errors": [             // Similar errors for pattern analysis
      {
        "timestamp": string,
        "message": string
      }
    ]
  }

Examples:
  - Permission error -> { server_name: "slack-mcp-server", error_message: "permission denied" }
  - Rate limit debugging -> { server_name: "github_mcp", error_message: "rate limit", include_stack_trace: true }
  - Recurring error -> { server_name: "jira-mcp-server", error_message: "timeout" }

Error Handling:
  - Returns error if server_name not found
  - Returns "Error not found" if no matching error in logs
  - Provides best-effort analysis even for unknown error patterns`;
