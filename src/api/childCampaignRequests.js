import client from './client'

// Child-campaign requests: a local organizer asks, from a group campaign's
// page, for a child campaign under it; the group's organizers review it.

// GET /api/contests/<id>/child-requests — requests for a group campaign.
// Returns { requests, can_review }: every request (can_review: true) for the
// group's organizers / superadmins, only the caller's own otherwise.
export async function listChildRequests(contestId) {
  const { data } = await client.get(`/api/contests/${contestId}/child-requests`)
  return data
}

// POST /api/contests/<id>/child-requests — ask for a child campaign.
// payload: { name, organizers, jury_members }. Returns the request object.
export async function createChildRequest(contestId, payload) {
  const { data } = await client.post(
    `/api/contests/${contestId}/child-requests`,
    payload,
  )
  return data
}

// POST /api/contests/<id>/child-requests/<rid>/review — group organizer's
// decision. decision is 'approve' (optionally with edited `organizers` /
// `jury_members`) or 'reject' (with `rejection_reason`). Returns the updated
// request object; on approve its contest_id is the new child campaign.
export async function reviewChildRequest(contestId, requestId, decision, extra = {}) {
  const body = { decision, ...extra }
  const { data } = await client.post(
    `/api/contests/${contestId}/child-requests/${requestId}/review`,
    body,
  )
  return data
}
