export const FULL_REASONING_LEVELS = Object.freeze([
  { effort: 'minimal', description: 'Fastest Cursor Agent delegation with minimal bridge-side thoroughness.' },
  { effort: 'low', description: 'Faster Cursor Agent delegation with light bridge-side checks.' },
  { effort: 'medium', description: 'Balanced Cursor Agent delegation for everyday coding tasks.' },
  { effort: 'high', description: 'More thorough Cursor Agent delegation with planning, edge-case checks, and verification.' },
  { effort: 'xhigh', description: 'Maximum Cursor Agent thoroughness for complex work; prefer deeper analysis and verification.' },
]);

export const DEFAULT_CURSOR_MODELS = Object.freeze([
  'cursor-auto',
  'cursor-composer-2.5-fast',
  'cursor-composer-2.5',
  'cursor-gpt-5.5-high-fast',
  'cursor-gpt-5.4-high-fast',
  'cursor-gpt-5.3-codex',
  'cursor-gpt-5.3-codex-high',
  'cursor-gpt-5.3-codex-xhigh',
  'cursor-claude-opus-4-8-thinking-high-fast',
  'cursor-claude-opus-4-8-thinking-high',
  'cursor-claude-opus-4-8-high-fast',
  'cursor-claude-4.6-sonnet-medium-thinking',
  'cursor-gemini-3.1-pro',
  'cursor-gemini-3.5-flash',
  'cursor-grok-4.3',
]);

export const DEFAULT_NATIVE_MODELS = Object.freeze([
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
]);

export function isCursorModel(model) {
  if (model == null || model === '') return true;
  return typeof model === 'string' && (model === 'cursor-auto' || model.startsWith('cursor-') || model.startsWith('cursor/'));
}

export function stripCursorPrefix(model) {
  if (!model || model === 'cursor-auto') return 'auto';
  if (model.startsWith('cursor/')) return model.slice('cursor/'.length) || 'auto';
  if (model.startsWith('cursor-')) return model.slice('cursor-'.length) || 'auto';
  return model;
}

export function displayNameForCursorSlug(slug) {
  const bare = stripCursorPrefix(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/Gpt/g, 'GPT')
    .replace(/Xhigh/g, 'Extra High');
  return slug === 'cursor-auto' ? 'Cursor / Auto' : `Cursor / ${bare}`;
}

export function defaultCursorReasoning(slug) {
  if (/xhigh|extra/i.test(slug)) return 'xhigh';
  if (/thinking|high|opus|grok|gemini-3\.1/i.test(slug)) return 'high';
  return 'medium';
}

function baseModelInfo({ slug, displayName, description, priority, contextWindow = 128000, reasoningLevels, defaultReasoning }) {
  return {
    slug,
    display_name: displayName,
    description,
    default_reasoning_level: defaultReasoning,
    supported_reasoning_levels: reasoningLevels,
    shell_type: 'default',
    visibility: 'list',
    supported_in_api: true,
    priority,
    additional_speed_tiers: [],
    service_tiers: [],
    base_instructions: '',
    supports_reasoning_summaries: true,
    default_reasoning_summary: 'concise',
    support_verbosity: true,
    default_verbosity: 'medium',
    apply_patch_tool_type: 'freeform',
    web_search_tool_type: 'text',
    truncation_policy: { mode: 'tokens', limit: contextWindow },
    supports_parallel_tool_calls: true,
    supports_image_detail_original: false,
    context_window: contextWindow,
    max_context_window: contextWindow,
    effective_context_window_percent: 95,
    experimental_supported_tools: [],
    input_modalities: ['text'],
    supports_search_tool: false,
    use_responses_lite: false,
  };
}

export function makeCursorModelInfo(slug, index = 0) {
  const contextWindow = /opus|grok/i.test(slug) ? 1000000 : 128000;
  return baseModelInfo({
    slug,
    displayName: displayNameForCursorSlug(slug),
    description: `Delegates to Cursor Agent model '${stripCursorPrefix(slug)}' through a local Codex Cursor Bridge. Reasoning and verbosity controls are translated into Cursor Agent execution-style instructions.`,
    priority: 2000 - index,
    contextWindow,
    reasoningLevels: structuredClone(FULL_REASONING_LEVELS),
    defaultReasoning: defaultCursorReasoning(slug),
  });
}

export function makeNativePlaceholderModelInfo(slug, index = 0) {
  const levels = FULL_REASONING_LEVELS.filter((x) => x.effort !== 'minimal');
  return baseModelInfo({
    slug,
    displayName: `Codex / ${slug.toUpperCase()}`,
    description: 'Native Codex/OpenAI model placeholder. Use only with an explicit legitimate upstream pass-through or Codex native provider.',
    priority: 3000 - index,
    contextWindow: 272000,
    reasoningLevels: structuredClone(levels),
    defaultReasoning: 'medium',
  });
}

export function buildCatalog({ cursorModels = DEFAULT_CURSOR_MODELS, nativeModels = [] } = {}) {
  const models = [
    ...nativeModels.map((slug, i) => makeNativePlaceholderModelInfo(slug, i)),
    ...cursorModels.map((slug, i) => makeCursorModelInfo(slug, i)),
  ];
  return {
    fetched_at: new Date().toISOString(),
    source: 'codex-cursor-bridge',
    models,
  };
}

const REQUIRED_MODEL_FIELDS = [
  'slug',
  'display_name',
  'supported_reasoning_levels',
  'shell_type',
  'visibility',
  'supported_in_api',
  'priority',
  'base_instructions',
  'supports_reasoning_summaries',
  'support_verbosity',
  'truncation_policy',
  'supports_parallel_tool_calls',
  'effective_context_window_percent',
  'experimental_supported_tools',
  'input_modalities',
];

export function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== 'object') errors.push('catalog must be an object');
  if (!Array.isArray(catalog?.models) || catalog.models.length === 0) errors.push('catalog.models must be a non-empty array');
  for (const [i, model] of (catalog?.models || []).entries()) {
    for (const field of REQUIRED_MODEL_FIELDS) {
      if (!(field in model)) errors.push(`models[${i}] (${model.slug || 'unknown'}) missing ${field}`);
    }
    const efforts = model.supported_reasoning_levels || [];
    if (!Array.isArray(efforts) || efforts.length === 0) errors.push(`models[${i}] (${model.slug}) has no reasoning levels`);
    if (model.slug?.startsWith('cursor-') && !efforts.some((x) => x.effort === 'xhigh')) {
      errors.push(`cursor model ${model.slug} must expose xhigh reasoning`);
    }
  }
  return errors;
}
