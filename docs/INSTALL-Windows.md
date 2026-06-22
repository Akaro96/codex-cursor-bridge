# Windows Installation

> **Release note:** this project is AI-generated / AI-assisted and not yet battle-tested. The npm package is not published yet, so use the **from-source** commands below unless a maintainer has explicitly published `@codex-cursor-bridge/cli`.

## Requirements

- Windows 10/11 x64 or arm64.
- Node.js 20+ from https://nodejs.org/.
- Codex Desktop or Codex CLI with custom model-provider support.
- Cursor Agent installed and logged in in the same Windows user session.

## Verify Cursor Agent

PowerShell:

```powershell
where.exe agent
agent --version
```

If Cursor Agent is only available through a full path, set an absolute path. Adjust this example to your actual Cursor installation:

```powershell
$env:CURSOR_AGENT_COMMAND = "C:\\Path\\To\\agent.cmd"
```

Helpful discovery commands:

```powershell
where.exe agent
Get-Command agent -ErrorAction SilentlyContinue
Get-Command cursor-agent -ErrorAction SilentlyContinue
```

`.cmd`, `.ps1`, and `.exe` commands are supported. The bridge uses explicit `cmd.exe /d /s /c` or `powershell.exe -NoProfile -ExecutionPolicy Bypass -File` wrappers and never uses Node's implicit `shell: true` path.

## Run from source now

Clone the public source repository, then run the local binary:

```powershell
git clone https://github.com/Akaro96/codex-cursor-bridge.git
cd codex-cursor-bridge
npm ci
node .\bin\codex-cursor-bridge.mjs doctor
node .\bin\codex-cursor-bridge.mjs serve --workspace "C:\\Path\\To\\Your\\Project"
node .\bin\codex-cursor-bridge.mjs catalog --out "$env:USERPROFILE\\.codex\\codex-cursor-model-catalog.json"
```


Expected healthy `doctor` output includes:

```text
catalog_valid=true
agent_probe=ok
```

In CI/mock mode, `agent_probe=mock` is also healthy.

## Planned npm command after publication

After `@codex-cursor-bridge/cli` is actually published, the equivalent commands will be:

```powershell
npx @codex-cursor-bridge/cli doctor
npx @codex-cursor-bridge/cli serve --workspace "C:\\Path\\To\\Your\\Project"
npx @codex-cursor-bridge/cli catalog --out "$env:USERPROFILE\\.codex\\codex-cursor-model-catalog.json"
```

If npm says the package is not found, it has not been published yet. Use the from-source commands.

## Codex configuration

Merge the snippet from `examples/codex-config.toml` into your existing Codex config. **Do not overwrite an existing config file.** Use the exact absolute path you passed to `catalog --out`.

For Codex CLI on Windows, the common path is:

```text
%USERPROFILE%\.codex\config.toml
```

Codex Desktop builds can use a different app-specific settings location. If Desktop does not pick up the CLI path, use the config path documented by your Codex Desktop build and copy only the `model_provider`, `model_catalog_json`, and `[model_providers.cursorbridge]` entries.

## Optional logon startup

Use Windows Task Scheduler if you want the bridge to start after login. Keep it in the interactive user session; do not run Cursor Desktop/AppX in Session 0.

From a from-source checkout:

```powershell
$Repo = "C:\\Path\\To\\codex-cursor-bridge"
$Workspace = "C:\\Path\\To\\Your\\Projects"
$Node = (Get-Command node).Source
$Action = New-ScheduledTaskAction -Execute $Node -Argument "`"$Repo\\bin\\codex-cursor-bridge.mjs`" serve --workspace `"$Workspace`"" -WorkingDirectory $Repo
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask -TaskName "CodexCursorBridge" -Action $Action -Trigger $Trigger -Settings $Settings -Description "Start local Codex Cursor Bridge"
```

## Firewall

No firewall rule is needed for the default `127.0.0.1` bind. If you intentionally bind another host, Windows Defender Firewall may prompt. Public/LAN binding is not recommended.
