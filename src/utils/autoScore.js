// Auto-scoring for multi-parameter scoring: a scoring parameter can carry an
// optional `auto` rule { metric, op, value }. When a submission's article
// metadata satisfies the condition, the jury review pre-fills the parameter's
// full points (binary). The metrics come from the stored article_metadata.

// Metrics a condition can test, and how to read each from article_metadata.
export const AUTO_METRICS = [
  { key: 'byte_count', label: 'Byte count', get: (m) => m?.byte_count },
  {
    key: 'words_added',
    label: 'Words added (by submitter)',
    get: (m) => m?.submitter_contribution?.words_net,
  },
  { key: 'word_count', label: 'Word count (article total)', get: (m) => m?.word_count },
  {
    key: 'reference_count',
    label: 'Reference count',
    get: (m) =>
      m == null
        ? null
        : (m.ref_new_count ?? 0) + (m.ref_reused_count ?? 0),
  },
  { key: 'image_count', label: 'Image count', get: (m) => m?.image_count },
  { key: 'outgoing_links', label: 'Outgoing links', get: (m) => m?.outgoing_links },
  { key: 'incoming_links', label: 'Incoming links', get: (m) => m?.incoming_links },
]

export const AUTO_OPERATORS = [
  { value: '>=', label: '≥ (at least)' },
  { value: '==', label: '= (exactly)' },
]

const _metric = (key) => AUTO_METRICS.find((x) => x.key === key)

export function metricLabel(key) {
  return _metric(key)?.label || key
}

// The metric's numeric value from metadata, or null if unavailable.
export function metricValue(metadata, key) {
  const v = _metric(key)?.get(metadata)
  return v == null ? null : Number(v)
}

// Evaluate an auto rule against article metadata.
// Returns true / false, or null when the rule is incomplete or the metric
// can't be read (so the caller can leave the parameter for manual scoring).
export function evaluateAuto(auto, metadata) {
  if (!auto || !auto.metric || !auto.op || auto.value == null || auto.value === '')
    return null
  const actual = metricValue(metadata, auto.metric)
  if (actual == null || Number.isNaN(actual)) return null
  const target = Number(auto.value)
  switch (auto.op) {
    case '>=':
      return actual >= target
    case '>':
      return actual > target
    case '<=':
      return actual <= target
    case '<':
      return actual < target
    case '==':
      return actual === target
    default:
      return null
  }
}

// Human-readable summary, e.g. "Image count ≥ 3".
export function autoSummary(auto) {
  if (!auto || !auto.metric) return ''
  const op = AUTO_OPERATORS.find((o) => o.value === auto.op)
  return `${metricLabel(auto.metric)} ${op ? op.label.split(' ')[0] : auto.op} ${auto.value}`
}
