/**
 * Formatting utilities for log monitor responses
 */

import type { LogEntry, ServerInfo, ErrorAnalysis } from "../types.js";
import { CHARACTER_LIMIT } from "../constants.js";

/**
 * Format log entries as Markdown
 */
export function formatErrorsAsMarkdown(
  errors: LogEntry[],
  serverName: string
): string {
  if (errors.length === 0) {
    return `# No Errors Found\n\nNo error logs found for server: **${serverName}**`;
  }

  const lines: string[] = [
    `# Error Logs: ${serverName}`,
    "",
    `Found **${errors.length}** error(s)`,
    "",
  ];

  for (let i = 0; i < errors.length; i++) {
    const error = errors[i];
    lines.push(`## Error ${i + 1}`);
    lines.push(`- **Time**: ${error.timestamp}`);
    if (error.tool_name) {
      lines.push(`- **Tool**: \`${error.tool_name}\``);
    }
    if (error.error_code) {
      lines.push(`- **Error Code**: ${error.error_code}`);
    }
    lines.push(`- **Message**: ${error.message}`);
    if (error.stack_trace) {
      lines.push("- **Stack Trace**:");
      lines.push("```");
      lines.push(error.stack_trace);
      lines.push("```");
    }
    lines.push("");
  }

  return truncateIfNeeded(lines.join("\n"), errors.length);
}

/**
 * Format log entries as JSON
 */
export function formatErrorsAsJson(errors: LogEntry[]): string {
  const response = {
    total: errors.length,
    errors: errors.map((error) => ({
      timestamp: error.timestamp,
      level: error.level,
      server_name: error.server_name,
      ...(error.tool_name ? { tool_name: error.tool_name } : {}),
      message: error.message,
      ...(error.error_code ? { error_code: error.error_code } : {}),
      ...(error.stack_trace ? { stack_trace: error.stack_trace } : {}),
      ...(error.request_id ? { request_id: error.request_id } : {}),
    })),
  };

  const jsonString = JSON.stringify(response, null, 2);
  return truncateIfNeeded(jsonString, errors.length);
}

/**
 * Format server list as Markdown
 */
export function formatServersAsMarkdown(
  servers: ServerInfo[],
  includeStats: boolean
): string {
  if (servers.length === 0) {
    return "# No MCP Servers Found\n\nNo MCP server log files found in the configured directory.";
  }

  const lines: string[] = [
    "# Available MCP Servers",
    "",
    `Found **${servers.length}** server(s) with log files`,
    "",
  ];

  for (const server of servers) {
    lines.push(`## ${server.server_name}`);
    lines.push(`- **Log Path**: \`${server.log_file_path}\``);
    lines.push(`- **Last Modified**: ${server.last_modified}`);

    if (includeStats) {
      lines.push(`- **Total Errors**: ${server.total_errors}`);
      lines.push(`- **Recent Errors (24h)**: ${server.recent_error_count}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format server list as JSON
 */
export function formatServersAsJson(
  servers: ServerInfo[],
  includeStats: boolean
): string {
  const response = {
    total: servers.length,
    servers: servers.map((server) => ({
      server_name: server.server_name,
      log_file_path: server.log_file_path,
      last_modified: server.last_modified,
      ...(includeStats
        ? {
            total_errors: server.total_errors,
            recent_error_count: server.recent_error_count,
          }
        : {}),
    })),
  };

  return JSON.stringify(response, null, 2);
}

/**
 * Format error analysis as Markdown
 */
export function formatAnalysisAsMarkdown(analysis: ErrorAnalysis): string {
  const lines: string[] = [
    "# Error Analysis",
    "",
    "## Root Cause",
    analysis.root_cause,
    "",
    "## Original Error",
    `- **Time**: ${analysis.error.timestamp}`,
    `- **Server**: ${analysis.error.server_name}`,
  ];

  if (analysis.error.tool_name) {
    lines.push(`- **Tool**: \`${analysis.error.tool_name}\``);
  }

  lines.push(`- **Message**: ${analysis.error.message}`);

  if (analysis.error.stack_trace) {
    lines.push("");
    lines.push("**Stack Trace**:");
    lines.push("```");
    lines.push(analysis.error.stack_trace);
    lines.push("```");
  }

  lines.push("");
  lines.push("## Suggested Actions");

  for (let i = 0; i < analysis.suggested_actions.length; i++) {
    lines.push(`${i + 1}. ${analysis.suggested_actions[i]}`);
  }

  if (analysis.related_errors.length > 0) {
    lines.push("");
    lines.push(`## Related Errors (${analysis.related_errors.length})`);
    lines.push("");

    for (const relatedError of analysis.related_errors) {
      lines.push(
        `- **${relatedError.timestamp}**: ${relatedError.message.substring(0, 100)}${relatedError.message.length > 100 ? "..." : ""}`
      );
    }
  }

  return truncateIfNeeded(lines.join("\n"), 1 + analysis.related_errors.length);
}

/**
 * Format error analysis as JSON
 */
export function formatAnalysisAsJson(analysis: ErrorAnalysis): string {
  const response = {
    root_cause: analysis.root_cause,
    error: {
      timestamp: analysis.error.timestamp,
      server_name: analysis.error.server_name,
      ...(analysis.error.tool_name
        ? { tool_name: analysis.error.tool_name }
        : {}),
      message: analysis.error.message,
      ...(analysis.error.stack_trace
        ? { stack_trace: analysis.error.stack_trace }
        : {}),
    },
    suggested_actions: analysis.suggested_actions,
    related_errors: analysis.related_errors.map((e) => ({
      timestamp: e.timestamp,
      message: e.message,
      ...(e.stack_trace ? { stack_trace: e.stack_trace } : {}),
    })),
  };

  return JSON.stringify(response, null, 2);
}

/**
 * Truncate content if it exceeds CHARACTER_LIMIT
 */
function truncateIfNeeded(content: string, itemCount: number): string {
  if (content.length <= CHARACTER_LIMIT) {
    return content;
  }

  const truncatedLength = CHARACTER_LIMIT - 500; // Leave room for truncation message
  const truncated = content.substring(0, truncatedLength);

  return `${truncated}\n\n---\n\n**⚠️ Response Truncated**\n\nThe full response exceeded ${CHARACTER_LIMIT} characters. Showing first ${truncatedLength} characters of ${itemCount} item(s).\n\nTo see more:\n- Use filters to narrow results (e.g., specify tool_name or hours)\n- Reduce the limit parameter\n- Query for specific errors using mcp_log_get_error_details`;
}
