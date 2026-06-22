import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, displayNameForCursorSlug, isCursorModel, validateCatalog } from '../src/model-catalog.mjs';

test('generated catalog validates and exposes full Cursor reasoning levels', () => {
  const catalog = buildCatalog();
  assert.deepEqual(validateCatalog(catalog), []);
  const cursor = catalog.models.find((m) => m.slug === 'cursor-gpt-5.5-high-fast');
  assert.ok(cursor);
  assert.deepEqual(cursor.supported_reasoning_levels.map((x) => x.effort), ['minimal', 'low', 'medium', 'high', 'xhigh']);
  assert.equal(cursor.default_reasoning_level, 'high');
});


test('model helper validation is explicit and display names avoid no-op transformations', () => {
  assert.equal(isCursorModel(undefined), true);
  assert.equal(isCursorModel(''), true);
  assert.equal(isCursorModel('cursor/gpt-5.5-high-fast'), true);
  assert.equal(isCursorModel(123), false);
  assert.equal(isCursorModel('gpt-5.5'), false);
  assert.equal(displayNameForCursorSlug('cursor-gpt-5.3-codex-xhigh'), 'Cursor / GPT 5.3 Codex Extra High');
});
