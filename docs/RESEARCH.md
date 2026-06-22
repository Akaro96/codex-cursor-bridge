# Research Notes

## Market question

Developers want to use the models available through their own Cursor subscription inside Codex's native harness. The useful open-source shape is not a generic proxy and not a token workaround. It is a local Codex provider that exposes Cursor Agent models through Codex's custom-provider and model-catalog mechanisms.

## Adjacent work

A scan of the ecosystem found several nearby categories:

| Category | Examples | Difference from this project |
|---|---|---|
| Cursor Agent to API proxies | Cursor CLI / Agent gateway projects | Usually expose a generic OpenAI-style API, not Codex's model catalog and Responses provider contract. |
| Multi-agent bridges | Claude/Codex/Cursor orchestration tools | Focus on routing tasks between tools rather than making Cursor models first-class Codex picker entries. |
| Subscription-backed local proxy apps | Desktop/local proxy products | Broader product surface; often less strict about the Codex-specific harness and security contract. |
| Inverse-direction bridges | Tools that route Cursor or other IDE traffic elsewhere | Useful reference points, but the direction is the opposite of Codex calling Cursor Agent. |

This repository intentionally avoids naming itself as the first or only bridge. The narrower claim is enough: Codex-native model-provider integration for Cursor Agent models is a distinct, useful wedge.

## Differentiation

Codex Cursor Bridge focuses on:

- Codex's native `[model_providers.*]` config.
- `wire_api = "responses"`.
- `model_catalog_json` entries that make Cursor models appear in the Codex picker.
- Reasoning-level metadata compatible with Codex UI expectations.
- Conservative security posture: local subprocess, no credential scraping, no hosted mode.

## Positioning

Recommended public phrasing:

> Local Codex provider for using your own Cursor Agent models inside Codex's native harness.

Avoid wording that implies bypassing billing, sharing subscriptions, extracting tokens, or running a public proxy.
