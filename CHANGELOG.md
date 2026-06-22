# Changelog

## 0.1.0 - 2026-06-22

Initial public source release.

### Added

- Local Responses-compatible provider for Codex custom model providers.
- Cursor Agent delegation for `cursor-*` model slugs.
- Model catalog generation for Codex's picker.
- Reasoning-effort mapping for `minimal`, `low`, `medium`, `high`, and `xhigh`.
- Windows, macOS, and Linux spawn handling.
- Mock mode for CI without Cursor credentials.
- Security-boundary tests for loopback default, no credential-store reads, no `shell: true`, and native-model refusal.
- Cursor Agent command validation for environment-provided command paths.
- Cursor Agent subprocess environment filtering and sanitized diagnostics.
- Explicit AI-generated / AI-assisted release-candidate and no-warranty disclosures.
- Support and release-readiness documentation for public OSS review.
- Release check for required files, BOM-free catalog output, and npm pack dry run.
