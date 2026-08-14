import {
  mdiCircle,
  mdiClockOutline,
  mdiCheckCircle,
  mdiPencilOutline,
} from '@mdi/js'

// Display status for a contest.
// A `pending` contest hasn't been started/locked yet → it's a Draft, regardless
// of its dates. Only once it's `active` do we classify it by the date range.
export function contestStatus(contest) {
  if (!contest || contest.status === 'pending') {
    return { key: 'draft', label: 'Draft', color: 'blue-grey', icon: mdiPencilOutline }
  }
  const now = new Date()
  const start = contest.start_date ? new Date(contest.start_date) : null
  const end = contest.end_date ? new Date(contest.end_date) : null
  if (start && start > now) {
    return { key: 'upcoming', label: 'Upcoming', color: 'warning', icon: mdiClockOutline }
  }
  if (end && end < now) {
    return { key: 'past', label: 'Past', color: 'grey', icon: mdiCheckCircle }
  }
  return { key: 'current', label: 'Active', color: 'success', icon: mdiCircle }
}
