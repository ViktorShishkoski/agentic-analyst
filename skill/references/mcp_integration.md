# Model Context Protocol (MCP) Integration Guide

The Model Context Protocol (MCP) is an open standard designed to enable AI agents to securely connect to external data sources, execution environments, and visual renderers.

## Architecture Overview

```
 ┌───────────────┐        MCP Request        ┌────────────────┐
 │               │ ────────────────────────> │                │
 │  Agentic      │                           │   MCP Server   │
 │  Analyst      │ <──────────────────────── │   (Provider)   │
 │               │        MCP Response       └────────────────┘
 └───────────────┘                                   │
                                                     ▼
                                            [External Resource]
                                            (DB, Sandbox, API)
```

In our architecture, the Node.js backend operates as a central client, dispatching requests to configured MCP servers to complete specialized data tasks.

## Supported MCP Servers

### 1. Data Ingestion MCPs
- **PostgreSQL MCP**: Connecting to production relational databases to run read-only queries.
- **SQLite MCP**: Querying lightweight embedded databases.
- **DuckDB MCP**: Running fast, analytical queries on local CSV/Parquet files.

### 2. Analytical Execution MCPs
- **Python / Pandas MCP**: A secure sandboxed python execution shell to run statistical queries, aggregates, and matrix operations.

### 3. Visualization Rendering MCPs
- **AntV MCP / Vega-Lite MCP**: Protocols returning structured JSON chart specifications (e.g. Vega specs) for visual rendering directly on the React frontend.

### 4. Development Workflow MCPs
- **Git / GitHub MCP**: Tracking code changes, committing assets, and reporting issues.
- **Brave Search MCP / Web Search MCP**: Performing external searches to pull real-time domain knowledge.

## How to Add a New MCP Server

To register a new MCP server, update the registry in `backend/mcp/registry.js` by defining:
1. **Name**: Unique server identifier.
2. **Transport**: Typically `stdio` (spawning a command) or `sse` (Server-Sent Events URL).
3. **Capabilities**: List of resources, prompts, or tools the server exposes.

Example config payload:
```json
{
  "name": "custom-sql-mcp",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres", "--conn", "postgresql://localhost:5432"]
}
```
