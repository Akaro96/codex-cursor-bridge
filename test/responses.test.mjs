import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOutputText, makeError, makeResponse } from '../src/responses.mjs';

test('response echoes validated reasoning and verbosity metadata', () => {
  const response = makeResponse({
    model: 'cursor-auto',
    text: 'OK',
    requestBody: { reasoning: { effort: 'xhigh', summary: 'concise' }, text: { verbosity: 'high' } },
  });
  assert.equal(response.model, 'cursor-auto');
  assert.equal(response.reasoning.effort, 'xhigh');
  assert.equal(response.reasoning.summary, 'concise');
  assert.equal(response.text.verbosity, 'high');
  assert.equal(extractOutputText(response), 'OK');
});

test('response rejects unknown reasoning and verbosity values instead of echoing them', () => {
  const response = makeResponse({
    model: 'cursor-auto',
    text: '',
    requestBody: { reasoning: { effort: 'prompt-injected' }, text: { verbosity: 'debug' } },
  });
  assert.equal(response.reasoning.effort, null);
  assert.equal(response.text.verbosity, 'medium');
  assert.equal(response.usage.output_tokens, 1);
  assert.equal(response.usage.total_tokens >= 1, true);
});

test('response handles unusual local caller values without throwing', () => {
  const circular = [];
  circular.push(circular);
  assert.doesNotThrow(() => makeResponse({ model: 'cursor-auto', text: 'OK', requestBody: { input: circular } }));
  assert.doesNotThrow(() => makeResponse({ model: 'cursor-auto', text: 'OK', requestBody: { input: 1n } }));
});

test('makeError returns OpenAI-style error shape with status metadata', () => {
  assert.deepEqual(makeError('bad', 'invalid_request_error', 400), {
    error: { message: 'bad', type: 'invalid_request_error', status: 400 },
  });
});

test('extractOutputText handles null and multiple message content parts', () => {
  assert.equal(extractOutputText(null), '');
  assert.equal(extractOutputText({ output: [
    { content: [{ text: 'A' }, { text: 'B' }] },
    { content: [{ text: 'C' }] },
  ] }), 'ABC');
});
