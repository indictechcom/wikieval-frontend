import {
  mdiCircle,
  mdiClockOutline,
  mdiCheckCircle,
  mdiPencilOutline,
} from '@mdi/js'

// The date window used to classify a contest as Current / Upcoming / Past.
// A group campaign's own dates are informational; once it has children it is
// judged by them (earliest child start → latest child end, open-ended if any
// child is), so a group stays "current" while any child is still running.
export function contestWindow(contest) {
  if (!contest) return { start: null, end: null }
  const useChildren = contest.is_group && contest.child_count > 0
  const startIso = useChildren ? contest.children_start_date : contest.start_date
  const endIso = useChildren ? contest.children_end_date : contest.end_date
  return {
    start: startIso ? new Date(startIso) : null,
    end: endIso ? new Date(endIso) : null,
  }
}

// Display status for a contest.
// A `pending` contest hasn't been started/locked yet → it's a Draft, regardless
// of its dates. Only once it's `active` do we classify it by the date range.
export function contestStatus(contest) {
  if (!contest || contest.status === 'pending') {
    return { key: 'draft', label: 'Draft', color: 'blue-grey', icon: mdiPencilOutline }
  }
  const now = new Date()
  const { start, end } = contestWindow(contest)
  if (start && start > now) {
    return { key: 'upcoming', label: 'Upcoming', color: 'warning', icon: mdiClockOutline }
  }
  if (end && end < now) {
    return { key: 'past', label: 'Past', color: 'grey', icon: mdiCheckCircle }
  }
  return { key: 'current', label: 'Active', color: 'success', icon: mdiCircle }
}
