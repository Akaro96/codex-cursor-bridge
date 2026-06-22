#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { isLoopbackHost, listen, nonLoopbackBindWarning } from '../src/server.mjs';
import { buildCatalog, validateCatalog } from '../src/model-catalog.mjs';
import { doctorLines, runDoctor } from '../src/doctor.mjs';

function arg(name, fallback = null) {
  const ix = process.argv.indexOf(name);
  return ix >= 0 ? process.argv[ix + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printHelp() {
  console.log(`codex-cursor-bridge

Usage:
  codex-cursor-bridge serve [--host 127.0.0.1] [--port 48124] [--workspace PATH]
  codex-cursor-bridge catalog --out /absolute/path/to/catalog.json
  codex-cursor-bridge doctor [--strict]

Environment:
  CURSOR_AGENT_COMMAND   Cursor Agent command/path. Defaults to agent.
  CURSOR_AGENT_PATH      Deprecated legacy alias for CURSOR_AGENT_COMMAND.
  CODEX_CURSOR_BRIDGE_HOST / PORT (loopback by default)
  CURSOR_BRIDGE_WORKSPACE
  CODEX_CURSOR_BRIDGE_MOCK=1 for tests/CI only; do not use for real workflows.
`);
}

const command = process.argv[2] || 'serve';

try {
  if (hasFlag('--help') || hasFlag('-h')) {
    printHelp();
  } else if (hasFlag('--version') || hasFlag('-v')) {
    const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(pkg.version);
  } else if (command === 'serve') {
    const port = Number(arg('--port', process.env.CODEX_CURSOR_BRIDGE_PORT || 48124));
    const host = arg('--host', process.env.CODEX_CURSOR_BRIDGE_HOST || '127.0.0.1');
    const workspace = arg('--workspace', process.env.CURSOR_BRIDGE_WORKSPACE || process.cwd());
    if (!isLoopbackHost(host)) {
      console.warn(`warning: ${nonLoopbackBindWarning(host)}.`);
    }
    const { server, host: actualHost, port: actualPort } = await listen({ host, port, workspace, allowNonLoopback: true });
    console.log(`codex-cursor-bridge listening on http://${actualHost}:${actualPort}`);
    const shutdown = () => server.close(() => process.exit(0));
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } else if (command === 'catalog') {
    const out = arg('--out', path.resolve(process.cwd(), 'codex-cursor-model-catalog.json'));
    const catalog = buildCatalog({ nativeModels: [] });
    const errors = validateCatalog(catalog);
    if (errors.length) {
      console.error(errors.join('\n'));
      process.exit(1);
    }
    await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await fs.writeFile(out, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
    console.log(`wrote ${catalog.models.length} models to ${out}`);
  } else if (command === 'doctor') {
    const report = await runDoctor({ strict: hasFlag('--strict') });
    for (const line of doctorLines(report)) console.log(line);
    if (!report.ok) process.exit(1);
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(2);
  }
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}
