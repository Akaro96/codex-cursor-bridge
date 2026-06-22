# Release Checklist

This is the maintainer checklist for future public releases, npm publication, owner transfers, and release tags. The GitHub source repository can be public while npm publication remains intentionally disabled.

## Pre-flight

- [ ] Confirm whether the repo stays under `Akaro96` or transfers to a neutral GitHub organization. See `docs/OWNERSHIP.md`.
- [ ] Keep the AI-generated / AI-assisted / limited-real-world-testing disclosure in the README until the project has broader independent use.

- [ ] Confirm final GitHub owner/org and update `package.json`, README links, and SECURITY advisory URL if needed.
- [ ] Confirm copyright holder in `LICENSE`, `NOTICE`, and `package.json#author`.
- [ ] Confirm no private paths, hostnames, screenshots, logs, tokens, cookies, or API keys are present.
- [ ] Run `git status --short` and review every untracked file.
- [ ] Confirm scoped npm package availability: `npm view @codex-cursor-bridge/cli` should return 404 before first publish, confirm that the npm scope is owned by the maintainer/org that will publish it, and keep the disclaimer that the name is unofficial.

## Verification

```bash
npm ci
npm run test:ci
npm run release:check
npm audit --omit=dev
npm pack --dry-run
```

Node 20 is the minimum supported runtime. CI covers Node 20, 22, and 24.

## OS smoke checks

- [ ] Windows: Node 20+, `agent.cmd`/`agent.ps1` path, `npm run test:ci`, `npm run release:check`, real Cursor Agent one-shot.
- [ ] macOS: Node 20+, `agent` on PATH or `CURSOR_AGENT_COMMAND`, `npm run test:ci`, `npm run release:check`, real Cursor Agent one-shot.
- [ ] Linux: Node 20+, `agent` on PATH or `CURSOR_AGENT_COMMAND`, `npm run test:ci`, `npm run release:check`.

If macOS hardware is not available, say so directly and rely only on the `macos-latest` CI result plus the `darwin` spawn tests.

## GitHub setup

- [ ] Create the repository as private first.
- [ ] Confirm default branch is `main`.
- [ ] Ensure Actions are enabled and green.
- [ ] Enable Dependabot alerts.
- [ ] Enable private vulnerability reporting.
- [ ] Confirm `SUPPORT.md` still points users to public Issues for usage questions and private advisories for security issues.
- [ ] Protect `main` with CI required when the project has regular external contributors.
- [ ] Add topics: `codex`, `cursor`, `cursor-agent`, `openai-responses`, `model-provider`, `local-first`, `nodejs`.
- [ ] Set description: `Local Codex provider for using your own Cursor Agent models inside Codex's native harness`.
- [ ] Upload `docs/assets/social-preview.png` via GitHub Settings → General → Social preview. Committing the file alone does not set the preview image.
- [ ] Create `v0.1.0` tag only after CI passes.

## npm setup

- [ ] Confirm the npm scope/package owner before publishing. The unscoped `codex-cursor-bridge` name is already taken on npm; this repository uses the planned neutral scoped package `@codex-cursor-bridge/cli`. Create/claim that npm scope before publishing, or choose a different final scope and update docs/package metadata first.
- [ ] Keep `package.json#private` set to `true` and omit `publishConfig` while npm is unpublished. Remove `private:true` and add any final `publishConfig` only in the same intentional publishing change.
- [ ] Run `npm publish --dry-run` after removing `private: true` for the actual publish candidate.
- [ ] Publish only after repo URL and npm owner are final.

## Announcement guardrails

Do say:

> Local Codex provider for using your own Cursor Agent models inside Codex's native harness.

Do not say:

- "free models"
- "bypass subscription limits"
- "share Cursor subscription"
- "hosted proxy"
- "steal/use Cursor tokens"
