// Tests for src/utils/autoScore.js — auto-scoring of multi-parameter scoring.
// A scoring parameter may carry an `auto` rule { metric, op, value }; when a
// submission's article metadata satisfies it, the jury review pre-fills the
// parameter's full points. Run with: npm test
//
// Uses Node's built-in test runner (node:test), no extra dependencies.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  AUTO_METRICS,
  AUTO_OPERATORS,
  metricValue,
  metricLabel,
  evaluateAuto,
  autoSummary,
} from '../src/utils/autoScore.js'

// Representative article metadata (as stored on a submission).
const META = {
  byte_count: 5000,
  word_count: 850,
  ref_new_count: 3,
  ref_reused_count: 2, // total references = 5
  image_count: 4,
  outgoing_links: 120,
  incoming_links: 300,
}

// --- catalog shape ---------------------------------------------------------- #

test('metrics catalog covers the stored stats', () => {
  const keys = AUTO_METRICS.map((m) => m.key)
  assert.deepEqual(keys, [
    'byte_count',
    'words_added',
    'word_count',
    'reference_count',
    'image_count',
    'outgoing_links',
    'incoming_links',
  ])
})

test('words_added reads the submitter contribution delta (net)', () => {
  const meta = { submitter_contribution: { words_added: 620, words_net: 600 } }
  assert.equal(metricValue(meta, 'words_added'), 600) // net authored words
  // rule: submitter added >= 200 words -> met
  assert.equal(evaluateAuto({ metric: 'words_added', op: '>=', value: 200 }, meta), true)
  assert.equal(evaluateAuto({ metric: 'words_added', op: '>=', value: 700 }, meta), false)
})

test('words_added is not measurable when the delta is absent', () => {
  // Older submissions / failed delta -> no submitter_contribution -> null (manual).
  assert.equal(metricValue({}, 'words_added'), null)
  assert.equal(metricValue({ submitter_contribution: null }, 'words_added'), null)
  assert.equal(
    evaluateAuto({ metric: 'words_added', op: '>=', value: 200 }, {}),
    null,
  )
})

test('operators are only >= and == (the ones that make sense)', () => {
  assert.deepEqual(
    AUTO_OPERATORS.map((o) => o.value),
    ['>=', '=='],
  )
})

// --- metricValue ------------------------------------------------------------ #

test('metricValue reads direct fields', () => {
  assert.equal(metricValue(META, 'byte_count'), 5000)
  assert.equal(metricValue(META, 'word_count'), 850)
  assert.equal(metricValue(META, 'image_count'), 4)
  assert.equal(metricValue(META, 'outgoing_links'), 120)
  assert.equal(metricValue(META, 'incoming_links'), 300)
})

test('reference_count sums new + reused', () => {
  assert.equal(metricValue(META, 'reference_count'), 5)
  assert.equal(metricValue({ ref_new_count: 7 }, 'reference_count'), 7) // reused missing -> 0
  assert.equal(metricValue({ ref_reused_count: 4 }, 'reference_count'), 4)
  assert.equal(metricValue({}, 'reference_count'), 0) // both missing -> 0, not null
})

test('metricValue returns null for a missing metric', () => {
  assert.equal(metricValue({}, 'image_count'), null)
  assert.equal(metricValue({ image_count: null }, 'image_count'), null)
  assert.equal(metricValue(null, 'byte_count'), null)
})

test('metricValue coerces numeric strings', () => {
  assert.equal(metricValue({ image_count: '4' }, 'image_count'), 4)
})

test('metricLabel maps keys to labels, falls back to the key', () => {
  assert.equal(metricLabel('image_count'), 'Image count')
  assert.equal(metricLabel('reference_count'), 'Reference count')
  assert.equal(metricLabel('unknown_metric'), 'unknown_metric')
})

// --- evaluateAuto: the core condition logic --------------------------------- #

test('>= is satisfied at and above the threshold', () => {
  assert.equal(evaluateAuto({ metric: 'image_count', op: '>=', value: 3 }, META), true)
  assert.equal(evaluateAuto({ metric: 'image_count', op: '>=', value: 4 }, META), true) // boundary
  assert.equal(evaluateAuto({ metric: 'image_count', op: '>=', value: 5 }, META), false)
})

test('== is exact-match only', () => {
  assert.equal(evaluateAuto({ metric: 'image_count', op: '==', value: 4 }, META), true)
  assert.equal(evaluateAuto({ metric: 'image_count', op: '==', value: 3 }, META), false)
})

test('works on the summed reference_count metric', () => {
  assert.equal(evaluateAuto({ metric: 'reference_count', op: '>=', value: 5 }, META), true)
  assert.equal(evaluateAuto({ metric: 'reference_count', op: '>=', value: 6 }, META), false)
})

test('the user example: Has Images, image_count >= 3', () => {
  const rule = { metric: 'image_count', op: '>=', value: 3 }
  assert.equal(evaluateAuto(rule, { image_count: 4 }), true) // -> award full points
  assert.equal(evaluateAuto(rule, { image_count: 1 }), false) // -> award 0
})

// --- evaluateAuto: incomplete / unmeasurable => null (leave for manual) ------ #

test('null when the rule is incomplete', () => {
  assert.equal(evaluateAuto(null, META), null)
  assert.equal(evaluateAuto({}, META), null)
  assert.equal(evaluateAuto({ metric: 'image_count' }, META), null) // no op/value
  assert.equal(evaluateAuto({ metric: 'image_count', op: '>=' }, META), null) // no value
  assert.equal(evaluateAuto({ op: '>=', value: 3 }, META), null) // no metric
})

test('value === 0 is a valid threshold, not "incomplete"', () => {
  // A distinct null-vs-false check: 0 must be treated as a real threshold.
  assert.equal(evaluateAuto({ metric: 'image_count', op: '>=', value: 0 }, META), true)
  assert.equal(
    evaluateAuto({ metric: 'image_count', op: '>=', value: 0 }, { image_count: 0 }),
    true,
  )
})

test('empty-string value is treated as incomplete', () => {
  assert.equal(evaluateAuto({ metric: 'image_count', op: '>=', value: '' }, META), null)
})

test('null when the metric cannot be read from metadata', () => {
  assert.equal(evaluateAuto({ metric: 'image_count', op: '>=', value: 3 }, {}), null)
  assert.equal(
    evaluateAuto({ metric: 'word_count', op: '>=', value: 300 }, { word_count: null }),
    null,
  )
})

test('unknown operator returns null (does not crash)', () => {
  assert.equal(evaluateAuto({ metric: 'image_count', op: '<>', value: 3 }, META), null)
})

// --- autoSummary ------------------------------------------------------------ #

test('autoSummary is human-readable', () => {
  assert.equal(autoSummary({ metric: 'image_count', op: '>=', value: 3 }), 'Image count ≥ 3')
  assert.equal(
    autoSummary({ metric: 'word_count', op: '==', value: 500 }),
    'Word count (article total) = 500',
  )
  assert.equal(
    autoSummary({ metric: 'words_added', op: '>=', value: 200 }),
    'Words added (by submitter) ≥ 200',
  )
  assert.equal(autoSummary(null), '')
  assert.equal(autoSummary({}), '')
})

// --- pre-fill semantics (mirrors ReviewSubmissionModal) --------------------- #
// The review modal awards full points only when evaluateAuto === true; false or
// null leave the parameter at 0 for the jury to score manually.

function prefill(param, metadata) {
  const matched = param.auto ? evaluateAuto(param.auto, metadata) : null
  return matched === true ? param.points : 0
}

test('pre-fill awards full points only on a true match', () => {
  const hasImages = { name: 'Has Images', points: 2, auto: { metric: 'image_count', op: '>=', value: 3 } }
  assert.equal(prefill(hasImages, { image_count: 4 }), 2) // met -> full
  assert.equal(prefill(hasImages, { image_count: 1 }), 0) // not met -> 0
  assert.equal(prefill(hasImages, {}), 0) // unmeasurable -> 0 (manual)

  const manual = { name: 'Quality', points: 5 } // no auto rule
  assert.equal(prefill(manual, { image_count: 4 }), 0) // always 0 -> manual
})

// --- full review scenario: mixed auto/manual params ------------------------- #

test('full multi-parameter pre-fill and total', () => {
  const params = [
    { name: 'Length', points: 3, auto: { metric: 'word_count', op: '>=', value: 500 } }, // met (850)
    { name: 'Images', points: 2, auto: { metric: 'image_count', op: '>=', value: 5 } }, // NOT met (4)
    { name: 'Sourced', points: 2, auto: { metric: 'reference_count', op: '>=', value: 5 } }, // met (5, boundary)
    { name: 'Depth', points: 1, auto: { metric: 'incoming_links', op: '>=', value: 999 } }, // not met
    { name: 'Quality', points: 5 }, // manual
    { name: 'Neutrality', points: 2, auto: { metric: 'word_count', op: '>=', value: 999999 } }, // unmeasurable? no -> not met
  ]
  const scores = Object.fromEntries(params.map((p) => [p.name, prefill(p, META)]))
  assert.deepEqual(scores, {
    Length: 3, // auto met
    Images: 0, // auto not met
    Sourced: 2, // auto met (boundary =)
    Depth: 0,
    Quality: 0, // manual -> jury scores
    Neutrality: 0,
  })
  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  assert.equal(total, 5) // 3 + 2 auto-awarded; rest manual
})

// --- form serialization contract (mirrors ContestFormModal.buildPayload) ---- #
// Only a COMPLETE auto rule is persisted; incomplete ones are dropped so a
// parameter with a half-configured rule is treated as plain manual.

function serializeParam(p) {
  return {
    name: (p.name || '').trim(),
    points: Number(p.points) || 0,
    description: (p.description || '').trim(),
    ...(p.auto && p.auto.metric && p.auto.op && p.auto.value !== '' && p.auto.value != null
      ? { auto: { metric: p.auto.metric, op: p.auto.op, value: Number(p.auto.value) || 0 } }
      : {}),
  }
}

test('complete auto rule is persisted with a numeric value', () => {
  const out = serializeParam({
    name: '  Has Images ', points: '2', description: '',
    auto: { metric: 'image_count', op: '>=', value: '3' }, // value from a text input (string)
  })
  assert.deepEqual(out, {
    name: 'Has Images', points: 2, description: '',
    auto: { metric: 'image_count', op: '>=', value: 3 }, // coerced to number
  })
})

test('incomplete auto rule is dropped (param stays manual)', () => {
  const noValue = serializeParam({ name: 'X', points: 1, auto: { metric: 'image_count', op: '>=', value: '' } })
  const noMetric = serializeParam({ name: 'Y', points: 1, auto: { op: '>=', value: 3 } })
  const nullAuto = serializeParam({ name: 'Z', points: 1, auto: null })
  assert.ok(!('auto' in noValue))
  assert.ok(!('auto' in noMetric))
  assert.ok(!('auto' in nullAuto))
})

test('auto value of 0 is persisted (a real threshold)', () => {
  const out = serializeParam({ name: 'X', points: 1, auto: { metric: 'image_count', op: '>=', value: 0 } })
  assert.deepEqual(out.auto, { metric: 'image_count', op: '>=', value: 0 })
})
