import client from './client'

// Contests: created by a user with contest-creation rights. Starts `pending`
// (editable), then the creator starts it → `active` (locked).

// GET /api/contests — list contests, newest first (visibility depends on auth).
// Returns an array of contest objects.
export async function listContests() {
  const { data } = await client.get('/api/contests')
  return data.contests
}

// GET /api/contests/<id> — fetch a single contest (public). Returns a contest object.
export async function getContest(id) {
  const { data } = await client.get(`/api/contests/${id}`)
  return data
}

// GET /api/contests/<id>/leaderboard — per-participant aggregates (alphabetical).
// Requires login. Returns an array of participant rows.
export async function getLeaderboard(id) {
  const { data } = await client.get(`/api/contests/${id}/leaderboard`)
  return data.leaderboard
}

// POST /api/contests — create a contest (requires `can_create_contest`).
// `payload` requires name, project_name, start_date; other fields optional.
// Returns the created contest object (status `pending`).
export async function createContest(payload) {
  const { data } = await client.post('/api/contests', payload)
  return data
}

// PUT /api/contests/<id> — edit a contest (creator only, while `pending`).
// Send any subset of contest fields. Returns the updated contest object.
export async function updateContest(id, payload) {
  const { data } = await client.put(`/api/contests/${id}`, payload)
  return data
}

// POST /api/contests/<id>/start — start a contest (creator only):
// `pending` → `active`, locking edits. Returns the updated contest object.
export async function startContest(id) {
  const { data } = await client.post(`/api/contests/${id}/start`)
  return data
}
