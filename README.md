# MCP Error Relay

MCP server which provides other MCP server's error log to LLMs enabling them to handle errors more intelligently

Let's stop burning tokens on your LLMs' blind retries. Give them hints for error from MCP server log.

## The Problem

Many MCP servers don’t provide ideal error response. When an MCP tool fails, and if the MCP server gives LLMs bad or empty error response, LLMs just keep retrying same broken call. Same vague error. Each retry burning through your token budget like it's going out of style.

LLMs receive error response from MCP server, but can't see MCP server's error log.
for example, MCP tool fails because of the permission issue, but if the MCP doesn’t return a proper error response, LLMs keep calling tools. but in the MCP server log, you can find error message with permission.

this MCP server relay MCP error log to LLMs when it comes to improper error responses.

## With `mcp-error-relay`

MCP Error Relay is a lightweight MCP server which provides MCP server error log to LLMs enabling them to handle errors more intelligently.

**Before:**

```
Tool call failed
→ Retry with slightly different params
→ Failed again
→ Retry with even more different params
→ Failed again
→ Give up and ask user
```

**After:**

```
Tool call failed
→ Check logs: "missing_scope: chat:write"
→ Tell user: "You need to add chat:write permission"
```

## Quick Start

```bash
# Clone and build
yarn install
yarn build
yarn start
```

`claude_desktop_config.json`

```json
{
  "mcpServers": {
    "error-helper": {
      "command": "npx",
      "args": ["-y", "mcp-error-relay@dev"]
    }
  }
}
```
