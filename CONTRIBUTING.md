# Contributing

Thank you for helping keep Codex Cursor Bridge stable, conservative, and safe to extend.

## Local setup

```bash
git clone https://github.com/Akaro96/codex-cursor-bridge.git
cd codex-cursor-bridge
npm ci
npm run test:ci
```


No real Cursor account is required for tests. CI uses mock mode by default.

## Pull request rules

- Keep the bridge local-first.
- Add tests for every protocol, catalog, subprocess, or security-boundary change.
- Do not add credential scraping, cookie reads, app-database reads, hosted proxy mode, subscription sharing, or silent native-model rerouting.
- Keep runtime dependencies at zero unless there is a strong reason and a security review.
- Document any change to Cursor Agent flags or workspace behavior in `docs/THREAT_MODEL.md`.

Bugs: use [`.github/ISSUE_TEMPLATE/bug_report.md`](.github/ISSUE_TEMPLATE/bug_report.md). Feature ideas: use [`.github/ISSUE_TEMPLATE/feature_request.md`](.github/ISSUE_TEMPLATE/feature_request.md).

## Commands before opening a PR

```bash
npm ci
npm run test:ci
npm run release:check
npm audit --omit=dev
```

## Adding Cursor model slugs

Update `DEFAULT_CURSOR_MODELS` in `src/model-catalog.mjs`, add or adjust tests in `test/catalog.test.mjs`, and regenerate a sample catalog locally. Do not add private model identifiers discovered from private logs.

## Security issues

Do not open public issues for vulnerabilities. See `SECURITY.md`.
