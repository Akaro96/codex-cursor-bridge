#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const roots = ['bin', 'src', 'scripts', 'test'];
const files = [];

async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && full.endsWith('.mjs')) files.push(full);
  }
}

for (const root of roots) {
  try { await walk(root); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}

for (const file of ['package.json', 'package-lock.json']) {
  try {
    JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    console.error(`json check failed: ${file}: ${error.message}`);
    process.exit(1);
  }
}

try {
  const toml = await fs.readFile('examples/codex-config.toml', 'utf8');
  for (const required of ['model_provider = "cursorbridge"', 'wire_api = "responses"', 'base_url = "http://127.0.0.1:48124/v1"']) {
    if (!toml.includes(required)) throw new Error(`missing ${required}`);
  }
} catch (error) {
  console.error(`example config check failed: ${error.message}`);
  process.exit(1);
}

console.log(`syntax_ok files=${files.length} json=2 examples=1`);
