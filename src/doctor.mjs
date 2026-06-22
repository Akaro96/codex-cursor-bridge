import { spawn } from 'node:child_process';
import os from 'node:os';
import { agentCommandFromEnv, agentSpawnSpec } from './cursor-agent.mjs';
import { buildCatalog, validateCatalog } from './model-catalog.mjs';

function probeAgent(env = process.env, timeoutMs = 5000) {
  if (env.CODEX_CURSOR_BRIDGE_MOCK === '1') {
    return Promise.resolve({ status: 'mock', command: agentCommandFromEnv(env), detail: 'mock mode enabled' });
  }
  return new Promise((resolve) => {
    const spec = agentSpawnSpec(['--version'], env);
    const child = spawn(spec.command, spec.args, {
      env,
      windowsHide: true,
      shell: spec.shell,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ status: 'timeout', command: agentCommandFromEnv(env), detail: `no response after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
    child.stderr?.on('data', (chunk) => (stderr += chunk.toString()));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: 'missing', command: agentCommandFromEnv(env), detail: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const detail = (stdout || stderr || '').trim().split(/\r?\n/)[0] || `exit ${code}`;
      resolve({ status: code === 0 ? 'ok' : 'error', command: agentCommandFromEnv(env), detail });
    });
  });
}

export async function runDoctor({ env = process.env, strict = false } = {}) {
  const catalog = buildCatalog({ nativeModels: [] });
  const errors = validateCatalog(catalog);
  const agent = await probeAgent(env);
  const ok = errors.length === 0 && (!strict || agent.status === 'ok' || agent.status === 'mock');
  return {
    ok,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    os: `${os.type()} ${os.release()}`,
    catalogModels: catalog.models.length,
    catalogValid: errors.length === 0,
    catalogErrors: errors,
    agent,
  };
}

export function doctorLines(report) {
  const lines = [
    `node=${report.node}`,
    `platform=${report.platform}`,
    `arch=${report.arch}`,
    `os=${report.os}`,
    `catalog_models=${report.catalogModels}`,
    `catalog_valid=${report.catalogValid}`,
    `agent_command=${report.agent.command}`,
    `agent_probe=${report.agent.status}`,
    `agent_detail=${report.agent.detail}`,
  ];
  if (report.catalogErrors.length) lines.push(...report.catalogErrors.map((e) => `catalog_error=${e}`));
  return lines;
}
