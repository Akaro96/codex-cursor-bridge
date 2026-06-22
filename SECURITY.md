# Security Policy

Codex Cursor Bridge is intentionally local-first. Its core safety promise is simple: route a user's own local Codex requests to their own local Cursor Agent without extracting, exporting, printing, persisting, or sharing credentials.

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Security fixes during public review |

## Hard rules

The project must not:

1. Read browser stores, keychains, app databases, cookies, API-key files, or credential caches.
2. Print, persist, export, or forward Cursor/OpenAI tokens or Authorization headers.
3. Bind to a non-loopback interface by default.
4. Operate as a hosted proxy for third parties.
5. Market itself as subscription sharing, quota resale, or paywall bypass.
6. Silently route native OpenAI/Codex model names through Cursor.

## Reporting a vulnerability

Use GitHub private security advisories:

```text
https://github.com/Akaro96/codex-cursor-bridge/security/advisories/new
```

If the repository is transferred to a GitHub organization later, update this URL in the same change as the repository metadata.

Do not file public issues containing credentials, logs with tokens, private project paths, or exploit details.

## Threat model

Read [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) for trust boundaries, assets, attackers, and mitigation mapping.

## Subprocess flags

The bridge delegates work to Cursor Agent with explicit local-agent flags including `--force`, `--sandbox disabled`, `--approve-mcps`, and `--trust`. These are documented and tested because they are powerful. Use only trusted local workspaces.
