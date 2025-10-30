/**
 * Type definitions for MCP Log Monitor Server
 */

export interface LogEntry {
  timestamp: string;
  level: string;
  server_name: string;
  tool_name?: string;
  message: string;
  error_code?: string;
  stack_trace?: string;
  request_id?: string;
}

export interface ErrorSummary {
  server_name: string;
  tool_name?: string;
  error_count: number;
  first_occurrence: string;
  last_occurrence: string;
  error_message: string;
  suggested_action?: string;
}

export interface ServerInfo {
  server_name: string;
  log_file_path: string;
  last_modified: string;
  total_errors: number;
  recent_error_count: number;
}

export interface ErrorAnalysis {
  error: LogEntry;
  root_cause: string;
  suggested_actions: string[];
  related_errors: LogEntry[];
}
