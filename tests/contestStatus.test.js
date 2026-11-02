// Tests for src/utils/contestStatus.js — Draft/Upcoming/Active/Past
// classification and the window used for group campaigns. Run with: npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { contestStatus, contestWindow } from '../src/utils/contestStatus.js'

const DAY = 24 * 60 * 60 * 1000
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString()

test('pending contest is a Draft regardless of dates', () => {
  assert.equal(contestStatus({ status: 'pending', start_date: iso(-10), end_date: iso(-5) }).key, 'draft')
  assert.equal(contestStatus(null).key, 'draft')
})

test('active contest is classified by its own window', () => {
  assert.equal(contestStatus({ status: 'active', start_date: iso(1) }).key, 'upcoming')
  assert.equal(contestStatus({ status: 'active', start_date: iso(-5), end_date: iso(-1) }).key, 'past')
  assert.equal(contestStatus({ status: 'active', start_date: iso(-5), end_date: iso(5) }).key, 'current')
  assert.equal(contestStatus({ status: 'active', start_date: iso(-5) }).key, 'current') // open-ended
})

test('contestWindow uses own dates for standalone contests and childless groups', () => {
  const own = { start_date: iso(-2), end_date: iso(2) }
  assert.equal(contestWindow(own).start.toISOString(), own.start_date)
  assert.equal(contestWindow(own).end.toISOString(), own.end_date)

  const emptyGroup = { is_group: true, child_count: 0, ...own,
    children_start_date: null, children_end_date: null }
  assert.equal(contestWindow(emptyGroup).start.toISOString(), own.start_date)
})

test('a group with children is judged by its children, not its own dates', () => {
  // Own dates are long past; children run in the future → Upcoming.
  const group = {
    status: 'active', is_group: true, child_count: 2,
    start_date: iso(-100), end_date: iso(-90),
    children_start_date: iso(3), children_end_date: iso(30),
  }
  assert.equal(contestStatus(group).key, 'upcoming')

  // A running child keeps the group current.
  group.children_start_date = iso(-3)
  assert.equal(contestStatus(group).key, 'current')

  // An open-ended child (null end) keeps the group current indefinitely.
  group.children_end_date = null
  assert.equal(contestStatus(group).key, 'current')
  assert.equal(contestWindow(group).end, null)

  // All children finished → Past.
  group.children_end_date = iso(-1)
  assert.equal(contestStatus(group).key, 'past')
})
