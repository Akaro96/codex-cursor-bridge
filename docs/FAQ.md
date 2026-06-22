# FAQ

## Is this a Cursor subscription bypass?

No. It uses your own local Cursor Agent installation and account. It does not extract, export, or share credentials.

## Does it expose my Cursor account?

No. The bridge never reads your keychain, cookies, browser storage, or token files. It just spawns your locally installed Cursor Agent.

## Why only `cursor-*` models?

Namespacing avoids collisions with Codex/OpenAI model names. Native `gpt-*` models should keep using Codex's native provider and auth path.

## Why does the config use `experimental_bearer_token = "local"`?

Some Codex custom-provider configs expect a token-shaped field. The bridge ignores Authorization headers and does not forward them.

## Does it stream?

Not yet. v0.1.0 returns a single final Responses payload after Cursor Agent completes. Streaming should be added only with explicit tests.

## Does it work on WSL?

It can if Codex, Node, the bridge, and Cursor Agent are reachable in the same environment. Mixed Windows/WSL setups need explicit paths and may be easier from native Windows with `agent.cmd`.

## Can I run it on a server for a team?

No. Hosted or multi-user proxy mode is outside the safety boundary.
