# Troubleshooting

> **Release note:** this project is AI-generated / AI-assisted and not yet battle-tested. The npm package is not published yet; if `npx @codex-cursor-bridge/cli ...` returns 404, clone the repository and run `node ./bin/codex-cursor-bridge.mjs ...` from source.

## `npx` says package not found

The planned package name is `@codex-cursor-bridge/cli`, but the package is not published yet. Public GitHub source installation is the supported path for now.

Use from source instead:

```bash
git clone https://github.com/Akaro96/codex-cursor-bridge.git
cd codex-cursor-bridge
npm ci
node ./bin/codex-cursor-bridge.mjs doctor
```


## `doctor` says `agent_probe=missing`

Cursor Agent is not on PATH for the process running the bridge. Set `CURSOR_AGENT_COMMAND`; `CURSOR_AGENT_PATH` is accepted as a legacy alias, but the preferred variable is `CURSOR_AGENT_COMMAND`.

```bash
export CURSOR_AGENT_COMMAND=/absolute/path/to/agent
```

Windows PowerShell:

```powershell
$env:CURSOR_AGENT_COMMAND = "C:\\Path\\To\\agent.cmd"
```

Expected healthy output includes `catalog_valid=true` and `agent_probe=ok`. In CI/mock mode, `agent_probe=mock` is also healthy.

## Codex does not show Cursor models

- Confirm your Codex version/build supports custom `model_providers` and `model_catalog_json`.
- Confirm `model_catalog_json` is an absolute path.
- Confirm the catalog exists and is UTF-8 JSON without BOM.
- Confirm you copied the exact path you passed to `catalog --out`.
- Restart Codex after changing config.
- Re-run the catalog command for the same path:

```bash
node ./bin/codex-cursor-bridge.mjs catalog --out <same-absolute-path>
```

## `EADDRINUSE`

Another process is already listening on the port. Start on another port:

```bash
node ./bin/codex-cursor-bridge.mjs serve --port 48125
```

Then update Codex `base_url` to the same port.

## Request hangs

Cursor Agent may be performing work. The bridge default timeout is 300 seconds. If Codex cancels the request, the bridge aborts and kills the Cursor Agent subprocess.

## Native `gpt-*` models return unsupported

This is intentional. The public bridge handles `cursor-*` models only by default. Native Codex/OpenAI models should use Codex's own provider/auth path, not a Cursor fallback.

## Reverting or removing the bridge

1. Stop the bridge process, systemd unit, LaunchAgent, or Scheduled Task.
2. Remove or comment out these entries from your Codex config:
   - `model_provider = "cursorbridge"`
   - `model_catalog_json = "..."`
   - the whole `[model_providers.cursorbridge]` block
3. Set your Codex `model` and `model_provider` back to your normal native provider.
4. Delete the generated `codex-cursor-model-catalog.json` file if you no longer need it.
5. Restart Codex.

Do not delete unrelated Codex config, sessions, auth files, or chat history.

## Streaming

The bridge currently returns non-streaming Responses payloads. Cursor Agent may stream internally, but Codex receives the final assistant message.
