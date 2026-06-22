#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'README.md', 'LICENSE', 'NOTICE', 'SECURITY.md', 'DISCLAIMER.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SUPPORT.md',
  'package-lock.json', '.editorconfig', '.nvmrc',
  '.github/CODEOWNERS', '.github/dependabot.yml',
  '.github/workflows/ci.yml', '.github/workflows/secret-scan.yml', '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/ISSUE_TEMPLATE/bug_report.md', '.github/ISSUE_TEMPLATE/feature_request.md',
  'docs/ARCHITECTURE.md', 'docs/RESEARCH.md', 'docs/THREAT_MODEL.md', 'docs/RELEASE.md', 'docs/OWNERSHIP.md',
  'docs/INSTALL-Windows.md', 'docs/INSTALL-macOS.md', 'docs/INSTALL-Linux.md', 'docs/TROUBLESHOOTING.md', 'docs/FAQ.md',
  'docs/assets/architecture.svg', 'docs/assets/terminal-flow.png', 'docs/assets/model-catalog-preview.png',
  'docs/assets/codex-desktop-native-picker.png', 'docs/assets/codex-mobile-native-picker.png', 'docs/assets/social-preview.png'
];

let failed = false;
function fail(message) {
  console.error(message);
  failed = true;
}

for (const file of requiredFiles) {
  try { await fs.access(file); console.log(`ok ${file}`); }
  catch { fail(`missing ${file}`); }
}

const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
for (const field of ['name', 'version', 'license', 'repository', 'bugs', 'bin', 'files', 'exports', 'engines', 'keywords']) {
  if (!pkg[field]) fail(`package missing ${field}`);
}
if (!pkg.scripts?.prepublishOnly) fail('package missing scripts.prepublishOnly');
if (!pkg.exports?.['./package.json']) fail('package missing exports["./package.json"]');
if (!pkg.engines?.node?.includes('>=20')) fail('package engines.node must require Node >=20');
if (pkg.private === true && pkg.publishConfig) fail('package must not include publishConfig while private:true blocks npm publication');

const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'));
const lockRoot = lock.packages?.[''];
if (lock.name !== pkg.name || lockRoot?.name !== pkg.name) fail('package-lock name must match package.json');
if (lock.version !== pkg.version || lockRoot?.version !== pkg.version) fail('package-lock version must match package.json');
if (lock.lockfileVersion < 3) fail('package-lock lockfileVersion must be >= 3');

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccb-release-'));
try {
  const out = path.join(tmpDir, 'catalog.json');
  const catalog = spawnSync(process.execPath, ['./bin/codex-cursor-bridge.mjs', 'catalog', '--out', out], { encoding: 'utf8' });
  if (catalog.status !== 0) {
    fail(catalog.stderr || catalog.stdout);
  } else {
    const bytes = await fs.readFile(out);
    const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    console.log(`catalog_bom=${bom}`);
    if (bom) failed = true;
  }
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

const packCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const packArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm', 'pack', '--dry-run'] : ['pack', '--dry-run'];
const pack = spawnSync(packCommand, packArgs, { encoding: 'utf8' });
if (pack.error) {
  fail(pack.error.message);
} else if (pack.status !== 0) {
  fail(pack.stderr || pack.stdout);
} else {
  console.log('pack_dry_run=ok');
}

if (failed) process.exit(1);
console.log('release_check_ok');
