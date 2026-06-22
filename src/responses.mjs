import crypto from 'node:crypto';
import { requestedReasoningEffort, requestedVerbosity } from './prompt.mjs';

function estimateTokens(value) {
  let text;
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value ?? '');
    } catch {
      text = String(value?.toString?.() ?? '');
    }
  }
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

export function makeResponse({ model, text, requestBody = null, status = 'completed' }) {
  const now = Math.floor(Date.now() / 1000);
  const effort = requestedReasoningEffort(requestBody);
  const summary = typeof requestBody?.reasoning?.summary === 'string' ? requestBody.reasoning.summary : null;
  const verbosity = requestedVerbosity(requestBody) || 'medium';
  const inputTokens = estimateTokens(requestBody?.input ?? requestBody ?? '');
  const outputTokens = estimateTokens(text || '');
  return {
    id: `resp_cursor_${crypto.randomUUID().replaceAll('-', '')}`,
    object: 'response',
    created_at: now,
    status,
    background: false,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    max_tool_calls: null,
    model,
    output: [
      {
        id: `msg_cursor_${crypto.randomUUID().replaceAll('-', '')}`,
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', annotations: [], logprobs: [], text: String(text || '') }],
      },
    ],
    parallel_tool_calls: true,
    previous_response_id: null,
    prompt_cache_key: requestBody?.prompt_cache_key || null,
    reasoning: { effort, summary },
    safety_identifier: null,
    service_tier: 'default',
    store: false,
    temperature: null,
    text: { format: { type: 'text' }, verbosity },
    tool_choice: 'auto',
    tools: [],
    top_logprobs: 0,
    top_p: null,
    truncation: 'disabled',
    usage: {
      input_tokens: inputTokens,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: outputTokens,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: inputTokens + outputTokens,
    },
    user: null,
    metadata: {},
  };
}

export function makeError(message, type = 'bridge_error', status = null) {
  const error = { message, type };
  if (status !== null && status !== undefined) error.status = status;
  return { error };
}

export function extractOutputText(response) {
  const texts = [];
  for (const item of response?.output || []) {
    for (const part of item?.content || []) {
      if (typeof part.text === 'string') texts.push(part.text);
    }
  }
  return texts.join('');
}
