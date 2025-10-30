/**
 * Service for reading and analyzing MCP server logs
 */

import * as fs from "fs";
import * as path from "path";
import { DEFAULT_LOG_DIR, MAX_LOG_SCAN_LIMIT } from "../constants.js";
import type { LogEntry, ServerInfo, ErrorAnalysis } from "../types.js";

/**
 * Get list of available MCP server log files
 */
export function getAvailableServers(): ServerInfo[] {
  const servers: ServerInfo[] = [];

  if (!fs.existsSync(DEFAULT_LOG_DIR)) {
    return servers;
  }

  const files = fs.readdirSync(DEFAULT_LOG_DIR);

  for (const file of files) {
    if (file.startsWith("mcp-server-") && file.endsWith(".log")) {
      const filePath = path.join(DEFAULT_LOG_DIR, file);
      const stats = fs.statSync(filePath);
      const serverName = file.replace(/\.(log|txt)$/, "").replace(/^.*-/, "");

      // Count errors in the file
      let totalErrors = 0;
      let recentErrors = 0;
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        for (const line of lines) {
          if (line.includes("ERROR") || line.includes("error")) {
            totalErrors++;

            // Try to parse timestamp for recent errors
            const match = line.match(
              /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/
            );
            if (match) {
              const timestamp = new Date(match[1]).getTime();
              if (timestamp > cutoffTime) {
                recentErrors++;
              }
            }
          }
        }
      } catch (error) {
        // If we can't read the file, just skip stats
      }

      servers.push({
        server_name: serverName,
        log_file_path: filePath,
        last_modified: stats.mtime.toISOString(),
        total_errors: totalErrors,
        recent_error_count: recentErrors,
      });
    }
  }

  return servers;
}

/**
 * Get recent error logs from a specific MCP server
 */
export function getRecentErrors(
  serverName: string,
  limit: number,
  toolName?: string,
  hours?: number
): LogEntry[] {
  const logPath = findLogPath(serverName);

  if (!logPath) {
    throw new Error(
      `Log file not found for server: ${serverName}. Available servers: ${getAvailableServers()
        .map((s) => s.server_name)
        .join(", ")}`
    );
  }

  return getErrorsFromTextLog(logPath, serverName, limit, toolName, hours);
}

/**
 * Get error details and analysis
 */
export function analyzeError(
  serverName: string,
  errorMessage: string,
  includeStackTrace: boolean
): ErrorAnalysis | null {
  const errors = getRecentErrors(serverName, MAX_LOG_SCAN_LIMIT);

  // Find the specific error
  const matchingError = errors.find((e) =>
    e.message.toLowerCase().includes(errorMessage.toLowerCase())
  );

  if (!matchingError) {
    return null;
  }

  // Find related errors (same error message)
  const relatedErrors = errors
    .filter(
      (e) =>
        e.message === matchingError.message &&
        e.timestamp !== matchingError.timestamp
    )
    .slice(0, 5);

  // Analyze the error and provide suggestions
  const analysis = generateErrorAnalysis(matchingError, relatedErrors);

  return {
    error: includeStackTrace
      ? matchingError
      : { ...matchingError, stack_trace: undefined },
    root_cause: analysis.rootCause,
    suggested_actions: analysis.suggestedActions,
    related_errors: includeStackTrace
      ? relatedErrors
      : relatedErrors.map((e) => ({ ...e, stack_trace: undefined })),
  };
}

/**
 * Find log file path for a given server name
 */
function findLogPath(serverName: string): string | null {
  const servers = getAvailableServers();
  const server = servers.find(
    (s) =>
      s.server_name === serverName ||
      s.server_name.replace(/-/g, "_") === serverName ||
      s.server_name.replace(/_/g, "-") === serverName
  );

  return server ? server.log_file_path : null;
}

/**
 * log format e.g: 2025-10-29T18:00:46.468Z [context7] [error] Server disconnected. For troubleshooting guidance, please visit our [debugging documentation](https://modelcontextprotocol.io/docs/tools/debugging) { metadata: { context: 'connection', stack: undefined } }
 */
function getErrorsFromTextLog(
  logPath: string,
  serverName: string, // 유지: 외부에서 넘겨주는 서버명(없으면 라인의 서버명 사용)
  limit: number,
  toolName?: string,
  hours?: number
): LogEntry[] {
  const content = fs.readFileSync(logPath, "utf-8");
  const lines = content.split("\n");

  const errors: LogEntry[] = [];
  const cutoffTime = hours ? Date.now() - hours * 60 * 60 * 1000 : 0;

  // 헤더: ISO 타임스탬프 + [server] + [level] + message
  const HEADER_RE =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const m = line.match(HEADER_RE);
    if (!m) continue;

    const [, ts, serverFromLine, level, firstMsgChunk] = m;
    if (!/error/i.test(level)) continue; // [error]만 수집

    // 시간 필터
    if (hours && new Date(ts).getTime() < cutoffTime) continue;

    // 메시지 전체 수집: 다음 에러 헤더(or 아무 헤더)가 나오기 전까지 누적
    let messageChunks: string[] = [firstMsgChunk];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (!next) {
        j++;
        continue;
      }
      // 다음 라인이 또 다른 로그 헤더면 종료
      if (HEADER_RE.test(next)) break;

      // 헤더가 아니면 동일 에러의 연속 라인으로 간주하여 누적
      messageChunks.push(next);
      j++;
    }

    const fullMessage = messageChunks.join("\n").trim();

    // toolName 필터(옵션): 메시지(또는 메타데이터 텍스트)에 포함되어야 함
    if (toolName && !fullMessage.toLowerCase().includes(toolName.toLowerCase())) {
      i = j - 1; // 스킵하되 인덱스 점프는 유지
      continue;
    }

    errors.push({
      timestamp: ts,
      level: "ERROR",
      server_name: serverName || serverFromLine, // 외부 인자 우선, 없으면 라인값
      tool_name: undefined, // 필요 시 fullMessage에서 패턴 추출 추가 가능
      message: fullMessage,
    });

    i = j - 1; // 다음 검사 시작 위치로 점프

    if (errors.length >= limit) break;
  }

  // 최신순 반환(파일이 오래→최근 순으로 기록되었다고 가정)
  return errors.reverse();
}

/**
 * Generate error analysis with root cause and suggestions
 */
function generateErrorAnalysis(
  error: LogEntry,
  relatedErrors: LogEntry[]
): { rootCause: string; suggestedActions: string[] } {
  const message = error.message.toLowerCase();
  let rootCause = "Unknown error occurred";
  const suggestedActions: string[] = [];

  // Pattern matching for common error types
  if (
    message.includes("permission") ||
    message.includes("unauthorized") ||
    message.includes("권한") ||
    message.includes("forbidden")
  ) {
    rootCause = "Permission or authorization error";
    suggestedActions.push(
      "Check if the required API credentials are properly configured"
    );
    suggestedActions.push(
      "Verify that the API key or token has the necessary permissions"
    );
    suggestedActions.push(
      "Ensure the user has access to the requested resource"
    );
    suggestedActions.push(
      "Review the API documentation for required OAuth scopes or permissions"
    );
  } else if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("429")
  ) {
    rootCause = "API rate limit exceeded";
    suggestedActions.push("Implement exponential backoff for API requests");
    suggestedActions.push("Reduce the frequency of API calls");
    suggestedActions.push("Consider caching responses to minimize API usage");
    suggestedActions.push(
      "Check if you can upgrade to a higher rate limit tier"
    );
  } else if (message.includes("timeout") || message.includes("timed out")) {
    rootCause = "Request timeout";
    suggestedActions.push(
      "Increase the timeout duration in the API configuration"
    );
    suggestedActions.push("Check network connectivity");
    suggestedActions.push("Verify that the target service is responsive");
    suggestedActions.push(
      "Consider breaking large requests into smaller chunks"
    );
  } else if (message.includes("not found") || message.includes("404")) {
    rootCause = "Resource not found";
    suggestedActions.push(
      "Verify that the resource ID or identifier is correct"
    );
    suggestedActions.push("Check if the resource has been deleted or moved");
    suggestedActions.push("Ensure you're using the correct API endpoint");
    suggestedActions.push(
      "Confirm the resource exists before attempting to access it"
    );
  } else if (
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("econnrefused")
  ) {
    rootCause = "Network connectivity issue";
    suggestedActions.push("Check your internet connection");
    suggestedActions.push(
      "Verify firewall settings are not blocking the connection"
    );
    suggestedActions.push("Try again after a short delay");
    suggestedActions.push("Ensure the target service is online and accessible");
  } else if (
    message.includes("invalid") ||
    message.includes("malformed") ||
    message.includes("validation")
  ) {
    rootCause = "Invalid input or malformed request";
    suggestedActions.push(
      "Validate input parameters before making the API call"
    );
    suggestedActions.push(
      "Check the API documentation for correct request format"
    );
    suggestedActions.push("Ensure all required fields are provided");
    suggestedActions.push("Verify data types match the API expectations");
  } else if (
    message.includes("authentication") ||
    message.includes("unauthenticated") ||
    message.includes("401")
  ) {
    rootCause = "Authentication failed";
    suggestedActions.push("Verify API credentials are correct and not expired");
    suggestedActions.push(
      "Check if the authentication token needs to be refreshed"
    );
    suggestedActions.push(
      "Ensure credentials are properly configured in environment variables"
    );
  } else if (
    message.includes("server error") ||
    message.includes("500") ||
    message.includes("503")
  ) {
    rootCause = "Server-side error";
    suggestedActions.push("The error is on the service provider's side");
    suggestedActions.push("Try again after a few minutes");
    suggestedActions.push("Check the service status page for known outages");
    suggestedActions.push("Contact the service provider if the issue persists");
  }

  // If this error occurred multiple times, add that to suggestions
  if (relatedErrors.length > 2) {
    suggestedActions.unshift(
      `⚠️ This error has occurred ${relatedErrors.length + 1} times. Consider implementing a permanent fix rather than retrying.`
    );
  } else if (relatedErrors.length === 0) {
    suggestedActions.push(
      "This is the first occurrence of this error - monitor for patterns"
    );
  }

  return { rootCause, suggestedActions };
}
