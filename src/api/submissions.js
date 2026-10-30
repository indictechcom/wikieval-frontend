import client from './client'

// Submissions use a two-step, tamper-proof flow:
//   1. evaluate(link) → article_metadata + a signed `hash` (nothing stored yet)
//   2. submit(hash)   → confirms the submission using only the hash
// The contest must be `active` for both steps.

// POST /api/contests/<contestId>/submissions/evaluate — step 1.
// Processes the article link and returns { article_link, article_metadata, hash }.
// An article can be in a contest once, by one participant only: if someone else
// already submitted it this rejects (400). If the *current user* already
// submitted it, the response also carries `existing_submission` ({ id, status,
// score, already_reviewed, reviewed_by_username, reviewed_at, submitted_at })
// so the UI can offer to keep it or refresh its stats.
export async function evaluateSubmission(contestId, articleLink) {
  const { data } = await client.post(
    `/api/contests/${contestId}/submissions/evaluate`,
    { article_link: articleLink },
  )
  return data
}

// POST /api/contests/<contestId>/submissions — step 2.
// Confirms the submission using the `hash` from evaluate. Returns the submission object.
// Pass `update: true` when evaluate returned `existing_submission` and the user
// chose to refresh it: the existing row's stats are replaced and any jury
// review is removed (back to pending), instead of creating a duplicate.
export async function createSubmission(contestId, hash, { update = false } = {}) {
  const { data } = await client.post(
    `/api/contests/${contestId}/submissions`,
    update ? { hash, update: true } : { hash },
  )
  return data
}

// GET /api/contests/<contestId>/submissions — list a contest's submissions,
// newest first (own only, unless creator/jury/superadmin). Returns an array.
export async function listSubmissions(contestId) {
  const { data } = await client.get(`/api/contests/${contestId}/submissions`)
  return data.submissions
}

// POST /api/contests/<contestId>/submissions/import — superadmin restore of one
// exported row. Re-fetches the article's metadata and creates a pending
// submission for `username`. Called one row at a time (client shows progress).
export async function importSubmission(contestId, { articleLink, username }) {
  const { data } = await client.post(
    `/api/contests/${contestId}/submissions/import`,
    { article_link: articleLink, username },
  )
  return data
}

// POST /api/contests/<contestId>/submissions/add — organizer adds one submission
// on behalf of a participant who missed the window. Ignores the closed window
// (dates unchanged) but enforces the contest's eligibility rules. Returns the
// created submission.
export async function addSubmissionOnBehalf(contestId, { username, articleLink }) {
  const { data } = await client.post(
    `/api/contests/${contestId}/submissions/add`,
    { username, article_link: articleLink },
  )
  return data
}

// POST /api/submissions/<submissionId>/review — jury accept/reject.
// decision is 'accept' or 'reject'; score, review_comment, parameter_scores optional.
// Returns the updated submission object.
export async function reviewSubmission(submissionId, { decision, score, reviewComment, parameterScores } = {}) {
  const body = { decision }
  if (score !== undefined) body.score = score
  if (reviewComment !== undefined) body.review_comment = reviewComment
  if (parameterScores !== undefined) body.parameter_scores = parameterScores
  const { data } = await client.post(
    `/api/submissions/${submissionId}/review`,
    body,
  )
  return data
}
