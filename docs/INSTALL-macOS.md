# macOS Installation

> **Release note:** this project is AI-generated / AI-assisted and not yet battle-tested. The npm package is not published yet, so use the **from-source** commands below unless a maintainer has explicitly published `@codex-cursor-bridge/cli`. macOS is covered by CI and spawn tests, but a real Mac Cursor-Agent smoke test is still recommended before public npm release.

## Requirements

- macOS on Apple Silicon or Intel.
- Node.js 20+.
- Codex CLI or Codex Desktop with custom model-provider support.
- Cursor Agent installed and logged in.

## Install Node

Use your normal Node toolchain: Homebrew, nvm, fnm, Volta, or the official installer.

Homebrew example:

```bash
brew install node@20
node --version
npm --version
```

## Verify Cursor Agent

```bash
command -v agent || command -v cursor-agent
agent --version
```

If the command is not on PATH, set an absolute path. Adjust this example to your actual Cursor installation:

```bash
export CURSOR_AGENT_COMMAND="/Applications/Cursor.app/Contents/Resources/app/bin/agent"
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

Codex Desktop builds can use a different app-specific settings location. If Desktop does not pick up the CLI path, use the config path documented by your Codex Desktop build and copy only the `model_provider`, `model_catalog_json`, and `[model_providers.cursorbridge]` entries.

## LaunchAgent option

For a user-level background start, create `~/Library/LaunchAgents/com.codex-cursor-bridge.plist`. Use absolute paths because LaunchAgents run with a minimal environment:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.codex-cursor-bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>/absolute/path/to/node</string>
    <string>/absolute/path/to/codex-cursor-bridge/bin/codex-cursor-bridge.mjs</string>
    <string>serve</string>
    <string>--workspace</string>
    <string>/absolute/path/to/your-projects</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CODEX_CURSOR_BRIDGE_HOST</key>
    <string>127.0.0.1</string>
    <key>CURSOR_AGENT_COMMAND</key>
    <string>/absolute/path/to/agent</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
```

Keep the service user-local; do not expose the bridge beyond loopback.

## Gatekeeper note

The npm package is plain JavaScript. If you wrap it into a binary later, notarization/signing is a separate release task. Cursor Agent itself may prompt on first run; run `agent --version` once manually before putting the bridge behind a LaunchAgent.
