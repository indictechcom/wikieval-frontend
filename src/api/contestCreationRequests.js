import client from './client'

// Contest-creation rights: a user requests rights; a superadmin reviews.

// GET /api/contest-creation-request — the logged-in user's own rights status.
// Returns { can_create_contest, request } (request is null if never submitted).
export async function getMyRequest() {
  const { data } = await client.get('/api/contest-creation-request')
  return data
}

// POST /api/contest-creation-request — submit a request for creation rights.
// Returns the created request object.
export async function createRequest(reason) {
  const { data } = await client.post('/api/contest-creation-request', { reason })
  return data
}

// GET /api/contest-creation-requests — superadmin review queue (all requests,
// newest first). Returns an array of request objects.
export async function listRequests() {
  const { data } = await client.get('/api/contest-creation-requests')
  return data.requests
}

// POST /api/contest-creation-request/<id>/review — superadmin decision.
// decision is 'approve' or 'reject'; rejectionReason is required when rejecting.
// Returns the updated request object.
export async function reviewRequest(id, decision, rejectionReason) {
  const body = { decision }
  if (decision === 'reject') {
    body.rejection_reason = rejectionReason
  }
  const { data } = await client.post(
    `/api/contest-creation-request/${id}/review`,
    body,
  )
  return data
}
