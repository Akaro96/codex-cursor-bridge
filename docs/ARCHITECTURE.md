# Architecture

## Components

```text
Codex client
  -> HTTP Responses API call
     -> codex-cursor-bridge
        -> prompt builder
        -> temporary task file
        -> Cursor Agent subprocess
        -> final Responses-compatible JSON
```

## Provider contract

Codex is configured with:

```toml
[model_providers.cursorbridge]
base_url = "http://127.0.0.1:48124/v1"
wire_api = "responses"
requires_openai_auth = false
```

The bridge implements:

- `GET /health`
- `GET /v1/models`
- `POST /v1/responses`

## Model catalog

`src/model-catalog.mjs` generates Cursor namespaced slugs:

```text
cursor-auto
cursor-gpt-5.5-high-fast
cursor-gpt-5.3-codex-xhigh
cursor-claude-opus-4-8-thinking-high
...
```

All Cursor models expose:

```text
minimal, low, medium, high, xhigh
```

The bridge maps these values into Cursor Agent execution-style instructions. `xhigh` is a bridge-side instruction, not an OpenAI API parameter. The bridge does not reveal private chain-of-thought.

## Request handling

1. Read JSON with a size limit.
2. Reject non-Cursor model names by default.
3. Build a fenced, untrusted prompt for Cursor Agent.
4. Write the prompt into a temporary directory.
5. Spawn Cursor Agent with explicit argv, no `shell: true`.
6. Parse Cursor Agent stream-json output and prefer the final assistant message.
7. Delete the temporary directory.
8. Return a Responses-compatible payload.

## Cross-platform spawning

| Platform | Behavior |
|---|---|
| Linux/macOS | Spawn `agent` or `CURSOR_AGENT_COMMAND` directly with argv array. |
| Windows `.cmd`/`.bat` | Spawn `cmd.exe /d /s /c <command> ...args`. |
| Windows `.ps1` | Spawn `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <script> ...args`. |
| Windows `.exe` | Spawn executable directly. |

## Environment variables

| Variable | Purpose |
|---|---|
| `CURSOR_AGENT_COMMAND` | Preferred Cursor Agent command or absolute path. |
| `CURSOR_AGENT_PATH` | Deprecated legacy alias for `CURSOR_AGENT_COMMAND`; kept for compatibility. |
| `CODEX_CURSOR_BRIDGE_HOST` / `CODEX_CURSOR_BRIDGE_PORT` | Override bridge bind address. Loopback is the default; programmatic non-loopback binds require explicit `allowNonLoopback: true`. |
| `CURSOR_BRIDGE_WORKSPACE` | Default workspace passed to Cursor Agent. |
| `CODEX_CURSOR_BRIDGE_MOCK` | Test/CI mode that avoids launching Cursor Agent. Do not set it in real workflows. |

## Non-goals for v0.1

- Hosted mode.
- Native `gpt-*` pass-through.
- Streaming Responses/SSE.
- Browser/keychain/app-database credential discovery.
