import http from 'node:http';
import { buildCursorPrompt } from './prompt.mjs';
import { makeError, makeResponse } from './responses.mjs';
import { buildCatalog, isCursorModel } from './model-catalog.mjs';
import { runCursorAgent } from './cursor-agent.mjs';

export class BridgeHttpError extends Error {
  constructor(message, status = 500, type = 'bridge_error') {
    super(message);
    this.name = 'BridgeHttpError';
    this.status = status;
    this.type = type;
  }
}

async function readJson(req, { maxBodyBytes = 5 * 1024 * 1024 } = {}) {
  let raw = '';
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) throw new BridgeHttpError(`Request body exceeds ${maxBodyBytes} bytes`, 413, 'request_too_large');
    raw += chunk;
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new BridgeHttpError(`Invalid JSON request body: ${error.message}`, 400, 'invalid_json');
  }
}

function sendJson(res, status, body) {
  if (res.writableEnded) return;
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
}

function modelListPayload(catalog) {
  return { object: 'list', data: catalog.models.map((m) => ({ id: m.slug, object: 'model', created: 0, owned_by: 'codex-cursor-bridge' })) };
}

function normalizeHost(host) {
  return String(host ?? '').trim().replace(/^\[(.*)\]$/, '$1').toLowerCase();
}

function isIpv4Loopback(host) {
  const parts = host.split('.');
  if (parts.length !== 4 || parts[0] !== '127') return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

export function isLoopbackHost(host) {
  const normalized = normalizeHost(host);
  if (new Set(['localhost', '::1', '0:0:0:0:0:0:0:1']).has(normalized)) return true;
  if (isIpv4Loopback(normalized)) return true;
  if (normalized.startsWith('::ffff:') && isIpv4Loopback(normalized.slice('::ffff:'.length))) return true;
  return false;
}

export function nonLoopbackBindWarning(host) {
  return `binding to non-loopback host '${host}' may expose the bridge to other local-network machines`;
}

export function nonLoopbackBindError(host) {
  return `Refusing to bind to non-loopback host '${host}' without explicit allowNonLoopback: true. ${nonLoopbackBindWarning(host)}.`;
}

function requestAbortSignal(req, res) {
  const controller = new AbortController();
  let responseFinished = false;
  res.on('finish', () => {
    responseFinished = true;
  });
  res.on('close', () => {
    if (!responseFinished) controller.abort();
  });
  req.on('aborted', () => controller.abort());
  return controller.signal;
}

export function createBridgeServer(config = {}) {
  const catalog = config.catalog || buildCatalog({ nativeModels: config.includeNativePlaceholders ? undefined : [] });
  const workspace = config.workspace || process.cwd();
  const timeoutMs = config.timeoutMs ?? 300000;
  const maxBodyBytes = config.maxBodyBytes ?? 5 * 1024 * 1024;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          bridge: 'codex-cursor-bridge',
          cursorModels: catalog.models.filter((m) => m.slug.startsWith('cursor-')).length,
          nativePassThrough: false,
        });
        return;
      }
      if (req.method === 'GET' && (url.pathname === '/v1/models' || url.pathname === '/models')) {
        sendJson(res, 200, modelListPayload(catalog));
        return;
      }
      if (req.method === 'POST' && (url.pathname === '/v1/responses' || url.pathname === '/responses')) {
        const signal = requestAbortSignal(req, res);
        const body = await readJson(req, { maxBodyBytes });
        const model = body.model || 'cursor-auto';
        if (!isCursorModel(model)) {
          sendJson(res, 501, makeError(`Native model '${model}' is not handled by default. Configure Codex native provider separately or enable an explicit legitimate upstream pass-through.`, 'unsupported_model', 501));
          return;
        }
        const prompt = buildCursorPrompt(body, { maxPromptChars: config.maxPromptChars || 60000 });
        const text = await runCursorAgent({ prompt, model, workspace, env: { ...process.env, ...(config.env || {}) }, timeoutMs, signal });
        if (!signal.aborted) sendJson(res, 200, makeResponse({ model, text, requestBody: body }));
        return;
      }
      sendJson(res, 404, makeError(`Not found: ${req.method} ${url.pathname}`, 'not_found', 404));
    } catch (error) {
      const status = error instanceof BridgeHttpError ? error.status : 500;
      const type = error instanceof BridgeHttpError ? error.type : 'bridge_error';
      sendJson(res, status, makeError(error?.message || String(error), type, status));
    }
  });
  return server;
}

export async function listen(config = {}) {
  const host = config.host ?? process.env.CODEX_CURSOR_BRIDGE_HOST ?? '127.0.0.1';
  const port = Number(config.port ?? process.env.CODEX_CURSOR_BRIDGE_PORT ?? 48124);
  if (!isLoopbackHost(host) && config.allowNonLoopback !== true) {
    throw new BridgeHttpError(nonLoopbackBindError(host), 400, 'non_loopback_bind');
  }
  const server = createBridgeServer(config);
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
  const address = server.address();
  const actualHost = typeof address === 'object' && address?.address ? address.address : host;
  const actualPort = typeof address === 'object' && address?.port ? address.port : port;
  return { server, host: actualHost, port: actualPort };
}
