// Wall-clock (in an IANA zone) <-> absolute UTC instant, backed by
// moment-timezone. It bundles the IANA database, so zone names are canonical
// (e.g. Asia/Kolkata, not the OS's deprecated Asia/Calcutta) and DST is correct
// for any date — no hand-rolled offset math or alias maps.

import moment from 'moment-timezone'

// Canonical zones from moment's country data (excludes deprecated aliases like
// Asia/Calcutta), plus UTC. This is what the picker offers.
const CANONICAL = (() => {
  const set = new Set()
  for (const country of moment.tz.countries())
    for (const zone of moment.tz.zonesForCountry(country)) set.add(zone)
  set.delete('UTC')
  return ['UTC', ...[...set].sort()] // UTC first, rest alphabetical
})()

// Signature of a zone's DST history, used to map a deprecated alias to its
// canonical zone (they share an identical signature) without a manual list.
const signature = (name) => {
  const z = moment.tz.zone(name)
  return z ? `${z.offsets.join(',')}|${z.untils.join(',')}` : ''
}
const CANONICAL_BY_SIG = new Map(CANONICAL.map((z) => [signature(z), z]))

// Resolve any IANA name (incl. aliases like Asia/Calcutta) to its canonical form.
export function canonicalZone(name) {
  if (!name) return 'UTC'
  return CANONICAL.includes(name)
    ? name
    : CANONICAL_BY_SIG.get(signature(name)) || name
}

// The canonical IANA zone list for the picker.
export function timezoneList() {
  return CANONICAL
}

// The viewer's own zone (canonicalized), used as the create-contest default.
export function browserTimeZone() {
  return canonicalZone(moment.tz.guess() || 'UTC')
}

// 'YYYY-MM-DD' + 'HH:mm' (or 'HH:mm:ss') interpreted in `timeZone` → UTC ISO.
export function zonedToUtcIso(dateStr, timeStr, timeZone) {
  if (!dateStr) return null
  return moment.tz(`${dateStr} ${timeStr || '00:00'}`, timeZone).toISOString()
}

// UTC ISO → { date: 'YYYY-MM-DD', time: 'HH:mm' } wall-clock in `timeZone`.
export function utcIsoToZoned(iso, timeZone) {
  if (!iso) return { date: '', time: '' }
  const m = moment.utc(iso).tz(timeZone)
  return { date: m.format('YYYY-MM-DD'), time: m.format('HH:mm') }
}

// Human label for a UTC instant in `timeZone`, e.g. '24 Aug 2026, 23:59 IST'.
export function formatInZone(iso, timeZone) {
  if (!iso) return ''
  return moment.utc(iso).tz(timeZone || 'UTC').format('DD MMM YYYY, HH:mm z')
}
