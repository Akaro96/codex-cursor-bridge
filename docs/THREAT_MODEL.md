# Threat Model

## Summary

Codex Cursor Bridge is a local bridge between Codex's Responses-compatible provider interface and Cursor Agent CLI. The safest version of this project is narrow:

- It listens on loopback by default.
- It handles only `cursor-*` model slugs by default.
- It launches the user's local Cursor Agent installation.
- It never reads or stores credentials.

## Assets

| Asset | Why it matters |
|---|---|
| User's Cursor account/subscription | Must not be shared, exported, or abused. |
| Local filesystem/workspace | Cursor Agent may read/write files in the configured workspace. |
| Codex session content | User prompts and project context flow through the local bridge. |
| Model catalog | Controls which models Codex displays and how reasoning controls map. |
| Local host/network | The bridge should not be exposed as a LAN or internet service by accident. |

## Trust boundaries

```text
Codex client process
  -> HTTP on 127.0.0.1
     -> codex-cursor-bridge Node process
        -> temporary prompt file
           -> Cursor Agent subprocess
              -> Cursor's own authenticated runtime
```

The bridge trusts the local user to choose a workspace. It does **not** trust request payloads from Codex blindly; user text is fenced as untrusted content before it is passed to Cursor Agent.

## Attackers considered

| Attacker | Example | Mitigation |
|---|---|---|
| Malicious local process | POSTs huge body to bridge | Request body size guard. |
| Malicious prompt payload | Tries to override bridge instructions | Untrusted blocks and security tests. |
| Malicious contributor | Adds credential scraping | Security-boundary test + gitleaks workflow + review template. |
| Accidental network exposure | User binds `0.0.0.0` | Loopback default, CLI warning, and fail-closed library API unless `allowNonLoopback: true` is explicit. |
| Hung client connection | Codex cancels request | Abort signal kills Cursor Agent subprocess. |
| Temp-file leak | Prompt file remains under tmp | Temp directory cleanup in `finally`. |

## Cursor Agent flags

The bridge currently uses:

```text
-p --output-format stream-json --stream-partial-output --force --sandbox disabled --approve-mcps --trust --workspace <path>
```

This is intentionally explicit and covered by tests because it is powerful. The goal is to preserve Codex-harness behavior where the delegated agent can actually complete coding tasks. The consequence is clear: users must only point the bridge at workspaces they trust.

Future hardening may add profiles that remove `--approve-mcps`, enable sandboxing, or require per-request confirmation. Those changes must keep a testable security contract.

## Out of scope

- Hosted proxy mode.
- Account or subscription sharing.
- Extracting Cursor/OpenAI credentials.
- Reading browser cookies, app databases, or OS credential stores.
- Silent routing of native OpenAI/Codex model names to Cursor.
- Reverse engineering private provider APIs beyond invoking the user's installed Cursor Agent CLI.

## Environment-variable boundary

`CURSOR_AGENT_COMMAND` is the documented way to point at Cursor Agent. `CURSOR_AGENT_PATH` is accepted only as a legacy alias for compatibility and has the same trust boundary: it must point to a local command the user intentionally chose.

The bridge does not inspect, validate, or forward Authorization headers; `experimental_bearer_token = "local"` is only a Codex config placeholder.

The bridge builds a filtered environment before spawning Cursor Agent. Environment variable names that look like tokens, secrets, passwords, API keys, access keys, authorization headers, credentials, sessions, or private keys are not forwarded to the child process. Bridge-owned mock-mode variables are preserved for CI.

Cursor Agent diagnostics are sanitized before being returned through HTTP errors: local home/temp/workspace roots, temporary prompt directory names, Windows drive paths, and long stderr/stdout payloads are redacted or truncated. This is defense-in-depth for loopback callers; successful assistant output is still returned as the user-visible model response.

## Security regression tests

`test/security-boundaries.test.mjs` asserts:

- no credential-store scraping terms in source,
- no `readFileSync` credential-style shortcuts,
- no `shell: true`,
- loopback default bind.

CI also includes a gitleaks workflow for future PRs.
