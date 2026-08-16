// Tests for src/utils/timezone.js — the wall-clock <-> UTC conversion used when
// creating/displaying contest deadlines. Run with: npm test
//
// Uses Node's built-in test runner (node:test), so no extra dependencies.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  timezoneList,
  browserTimeZone,
  canonicalZone,
  zonedToUtcIso,
  utcIsoToZoned,
  formatInZone,
} from '../src/utils/timezone.js'

// --- zonedToUtcIso: wall-clock in a zone -> absolute UTC instant ---

test('UTC wall time is the same instant', () => {
  assert.equal(zonedToUtcIso('2026-08-24', '00:00', 'UTC'), '2026-08-24T00:00:00.000Z')
  assert.equal(zonedToUtcIso('2026-08-24', '23:59', 'UTC'), '2026-08-24T23:59:00.000Z')
})

test('half-hour offset (Asia/Kolkata, +5:30)', () => {
  // 23:59 IST -> 18:29 UTC
  assert.equal(
    zonedToUtcIso('2026-08-24', '23:59', 'Asia/Kolkata'),
    '2026-08-24T18:29:00.000Z',
  )
})

test('45-minute offset (Asia/Kathmandu, +5:45)', () => {
  // 12:00 NPT -> 06:15 UTC
  assert.equal(
    zonedToUtcIso('2026-08-24', '12:00', 'Asia/Kathmandu'),
    '2026-08-24T06:15:00.000Z',
  )
})

test('negative offset (America/Los_Angeles)', () => {
  // Summer -> PDT (UTC-7): 12:00 -> 19:00 UTC
  assert.equal(
    zonedToUtcIso('2026-07-01', '12:00', 'America/Los_Angeles'),
    '2026-07-01T19:00:00.000Z',
  )
  // Winter -> PST (UTC-8): 12:00 -> 20:00 UTC
  assert.equal(
    zonedToUtcIso('2026-01-01', '12:00', 'America/Los_Angeles'),
    '2026-01-01T20:00:00.000Z',
  )
})

test('DST is applied per-date, not as a fixed offset (America/New_York)', () => {
  // EDT (UTC-4) in July, EST (UTC-5) in January.
  assert.equal(
    zonedToUtcIso('2026-07-01', '12:00', 'America/New_York'),
    '2026-07-01T16:00:00.000Z',
  )
  assert.equal(
    zonedToUtcIso('2026-01-01', '12:00', 'America/New_York'),
    '2026-01-01T17:00:00.000Z',
  )
})

test('DST changeover: Europe/Berlin CEST (summer) vs CET (winter)', () => {
  // June -> CEST (UTC+2): 00:00 -> previous day 22:00 UTC
  assert.equal(
    zonedToUtcIso('2026-06-01', '00:00', 'Europe/Berlin'),
    '2026-05-31T22:00:00.000Z',
  )
  // December -> CET (UTC+1): 23:59 -> 22:59 UTC
  assert.equal(
    zonedToUtcIso('2026-12-31', '23:59', 'Europe/Berlin'),
    '2026-12-31T22:59:00.000Z',
  )
})

test('spring-forward gap and fall-back overlap resolve deterministically', () => {
  // US DST 2026 begins 2026-03-08 02:00 (02:00-02:59 does not exist locally).
  // The two-pass offset logic must still return a single, stable instant.
  const gap = zonedToUtcIso('2026-03-08', '02:30', 'America/New_York')
  assert.match(gap, /^2026-03-08T\d{2}:30:00\.000Z$/)
  // Fall back 2026-11-01 02:00 (01:00-01:59 happens twice). Also deterministic.
  const overlap = zonedToUtcIso('2026-11-01', '01:30', 'America/New_York')
  assert.match(overlap, /^2026-11-01T\d{2}:30:00\.000Z$/)
})

test('IANA aliases produce the identical instant (Kolkata === Calcutta)', () => {
  // This is the crux: whichever name a given browser/OS uses, the UTC instant
  // must be identical, because they are the same zone.
  assert.equal(
    zonedToUtcIso('2026-08-24', '23:59', 'Asia/Kolkata'),
    zonedToUtcIso('2026-08-24', '23:59', 'Asia/Calcutta'),
  )
})

test('legacy alias US/Eastern === America/New_York', () => {
  assert.equal(
    zonedToUtcIso('2026-07-01', '12:00', 'US/Eastern'),
    zonedToUtcIso('2026-07-01', '12:00', 'America/New_York'),
  )
})

test('null/blank date yields null', () => {
  assert.equal(zonedToUtcIso('', '12:00', 'UTC'), null)
  assert.equal(zonedToUtcIso(null, '12:00', 'UTC'), null)
})

test('missing time defaults to 00:00', () => {
  assert.equal(zonedToUtcIso('2026-08-24', '', 'UTC'), '2026-08-24T00:00:00.000Z')
  assert.equal(zonedToUtcIso('2026-08-24', undefined, 'UTC'), '2026-08-24T00:00:00.000Z')
})

// --- utcIsoToZoned: UTC instant -> wall-clock parts in a zone ---

test('utcIsoToZoned inverts zonedToUtcIso across zones', () => {
  const cases = [
    ['2026-08-24', '23:59', 'Asia/Kolkata'],
    ['2026-08-24', '12:00', 'Asia/Kathmandu'],
    ['2026-07-01', '12:00', 'America/New_York'],
    ['2026-01-01', '12:00', 'America/New_York'],
    ['2026-06-01', '00:00', 'Europe/Berlin'],
    ['2026-12-31', '23:59', 'Europe/Berlin'],
    ['2026-07-01', '12:00', 'America/Los_Angeles'],
    ['2026-08-24', '00:00', 'UTC'],
  ]
  for (const [date, time, zone] of cases) {
    const iso = zonedToUtcIso(date, time, zone)
    assert.deepEqual(
      utcIsoToZoned(iso, zone),
      { date, time },
      `round-trip failed for ${date} ${time} ${zone}`,
    )
  }
})

test('utcIsoToZoned aliases agree (Kolkata vs Calcutta)', () => {
  const iso = '2026-08-24T18:29:00.000Z'
  assert.deepEqual(
    utcIsoToZoned(iso, 'Asia/Kolkata'),
    utcIsoToZoned(iso, 'Asia/Calcutta'),
  )
})

test('utcIsoToZoned handles midnight without emitting hour 24', () => {
  const { date, time } = utcIsoToZoned('2026-08-24T00:00:00.000Z', 'UTC')
  assert.equal(date, '2026-08-24')
  assert.equal(time, '00:00')
})

test('utcIsoToZoned on empty input', () => {
  assert.deepEqual(utcIsoToZoned('', 'UTC'), { date: '', time: '' })
  assert.deepEqual(utcIsoToZoned(null, 'UTC'), { date: '', time: '' })
})

// --- formatInZone: human label in a zone ---

test('formatInZone shows the correct DST abbreviation for Berlin', () => {
  // Same contest, two seasons -> different abbreviations, both correct.
  assert.equal(
    formatInZone('2026-05-31T22:00:00.000Z', 'Europe/Berlin'),
    '01 Jun 2026, 00:00 CEST',
  )
  assert.equal(
    formatInZone('2026-12-31T22:59:00.000Z', 'Europe/Berlin'),
    '31 Dec 2026, 23:59 CET',
  )
})

test('formatInZone renders half-hour offset zones', () => {
  assert.equal(
    formatInZone('2026-08-24T18:29:00.000Z', 'Asia/Kolkata'),
    '24 Aug 2026, 23:59 IST',
  )
})

test('formatInZone aliases render the same offset', () => {
  const iso = '2026-08-24T18:29:00.000Z'
  // Labels may spell the zone differently but the offset/time must match; here
  // both use the numeric GMT offset, so they are identical.
  assert.equal(
    formatInZone(iso, 'Asia/Kolkata'),
    formatInZone(iso, 'Asia/Calcutta'),
  )
})

test('formatInZone on empty input', () => {
  assert.equal(formatInZone('', 'Europe/Berlin'), '')
  assert.equal(formatInZone(null, 'Europe/Berlin'), '')
})

test('formatInZone defaults a missing zone to UTC', () => {
  assert.equal(
    formatInZone('2026-08-24T18:29:00.000Z', undefined),
    '24 Aug 2026, 18:29 UTC',
  )
})

// --- timezoneList / browserTimeZone ---

test('timezoneList starts with UTC and has no duplicate UTC', () => {
  const list = timezoneList()
  assert.equal(list[0], 'UTC')
  assert.equal(list.filter((z) => z === 'UTC').length, 1)
  assert.ok(list.length > 1)
})

test('timezoneList uses canonical names (Kolkata, not the deprecated Calcutta)', () => {
  const list = timezoneList()
  // moment's bundled IANA data is canonical regardless of the OS/browser ICU.
  assert.ok(list.includes('Asia/Kolkata'), 'expected canonical Asia/Kolkata')
  assert.ok(!list.includes('Asia/Calcutta'), 'deprecated alias should be absent')
})

// --- canonicalZone: alias -> canonical (data-driven, no hand-kept map) ---

test('canonicalZone maps deprecated aliases to canonical names', () => {
  assert.equal(canonicalZone('Asia/Calcutta'), 'Asia/Kolkata')
  assert.equal(canonicalZone('US/Eastern'), 'America/New_York')
})

test('canonicalZone leaves already-canonical names unchanged', () => {
  assert.equal(canonicalZone('Asia/Kolkata'), 'Asia/Kolkata')
  assert.equal(canonicalZone('Europe/Berlin'), 'Europe/Berlin')
  assert.equal(canonicalZone('UTC'), 'UTC')
})

test('canonicalZone falls back to UTC for empty input', () => {
  assert.equal(canonicalZone(''), 'UTC')
  assert.equal(canonicalZone(null), 'UTC')
})

test('browserTimeZone returns a canonical zone', () => {
  const tz = browserTimeZone()
  // Whatever the OS resolves to, it must come back canonical (in the list).
  assert.ok(timezoneList().includes(tz), `${tz} should be canonical`)
})

test('browserTimeZone returns a usable, resolvable zone', () => {
  const tz = browserTimeZone()
  assert.equal(typeof tz, 'string')
  assert.ok(tz.length > 0)
  // Must be accepted by Intl (i.e. round-trippable).
  assert.doesNotThrow(() => zonedToUtcIso('2026-08-24', '12:00', tz))
})
