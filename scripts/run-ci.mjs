#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const wrapNpmArgs = (args) => process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npm', ...args]
  : args;

const steps = [
  ['run', 'lint'],
  ['test'],
  ['run', 'smoke'],
  ['run', 'doctor'],
];

const env = {
  ...process.env,
  CODEX_CURSOR_BRIDGE_MOCK: process.env.CODEX_CURSOR_BRIDGE_MOCK || '1',
};

for (const args of steps) {
  const result = spawnSync(npmCommand, wrapNpmArgs(args), { stdio: 'inherit', env });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
