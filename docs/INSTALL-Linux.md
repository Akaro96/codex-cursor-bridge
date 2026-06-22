# Linux Installation

> **Release note:** this project is AI-generated / AI-assisted and not yet battle-tested. The npm package is not published yet, so use the **from-source** commands below unless a maintainer has explicitly published `@codex-cursor-bridge/cli`.

## Requirements

- Linux x64 or arm64.
- Node.js 20+.
- Codex CLI with custom model-provider support.
- Cursor Agent installed and logged in for the same user.

## Install Node

Use your normal Node toolchain. Examples:

```bash
node --version
npm --version
```

If Node is missing, install Node 20+ with your preferred manager, for example `nvm`, `fnm`, Volta, or your distribution's package manager. Avoid running npm as root unless your environment explicitly requires it.

## Verify Cursor Agent

```bash
command -v agent || command -v cursor-agent
agent --version
```

If the command is elsewhere, or if `agent` resolves to an unrelated Linux tool, set the explicit Cursor Agent path:

```bash
export CURSOR_AGENT_COMMAND=/absolute/path/to/agent
```

## Run from source now

Clone the public source repository, then run the local binary:

```bash
git clone https://github.com/Akaro96/codex-cursor-bridge.git
cd codex-cursor-bridge
npm ci
node ./bin/codex-cursor-bridge.mjs doctor
node ./bin/codex-cursor-bridge.mjs serve --workspace "$HOME/path/to/your-project"
node ./bin/codex-cursor-bridge.mjs catalog --out "$HOME/.codex/codex-cursor-model-catalog.json"
```


Expected healthy `doctor` output includes:

```text
catalog_valid=true
agent_probe=ok
```

In CI/mock mode, `agent_probe=mock` is also healthy.

## Planned npm command after publication

After `@codex-cursor-bridge/cli` is actually published, the equivalent commands will be:

```bash
npx @codex-cursor-bridge/cli doctor
npx @codex-cursor-bridge/cli serve --workspace "$HOME/path/to/your-project"
npx @codex-cursor-bridge/cli catalog --out "$HOME/.codex/codex-cursor-model-catalog.json"
```

If npm says the package is not found, it has not been published yet. Use the from-source commands.

## Codex configuration

Merge the snippet from `examples/codex-config.toml` into your existing `~/.codex/config.toml`. **Do not overwrite an existing config file.** Use the exact absolute path you passed to `catalog --out`.

If your Codex build uses another config location, copy only the `model_provider`, `model_catalog_json`, and `[model_providers.cursorbridge]` entries into that file.

## systemd user service

Create `~/.config/systemd/user/codex-cursor-bridge.service`. Adjust `WorkingDirectory`, `ExecStart`, `PATH`, and `CURSOR_AGENT_COMMAND` to your machine:

```ini
[Unit]
Description=Codex Cursor Bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/path/to/codex-cursor-bridge
ExecStart=/usr/bin/env node %h/path/to/codex-cursor-bridge/bin/codex-cursor-bridge.mjs serve --workspace %h/path/to/your-projects
Restart=on-failure
RestartSec=5
Environment=CODEX_CURSOR_BRIDGE_HOST=127.0.0.1
Environment=CODEX_CURSOR_BRIDGE_PORT=48124
Environment=CURSOR_AGENT_COMMAND=/absolute/path/to/agent
Environment=PATH=%h/.nvm/versions/node/current/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
```

Enable it:

```bash
systemctl --user daemon-reload
systemctl --user enable --now codex-cursor-bridge.service
systemctl --user status codex-cursor-bridge.service
```

Do not run it as root unless your workspace and Cursor Agent setup explicitly require that.
