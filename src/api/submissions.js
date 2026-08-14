import client from './client'

// Submissions use a two-step, tamper-proof flow:
//   1. evaluate(link) → article_metadata + a signed `hash` (nothing stored yet)
//   2. submit(hash)   → confirms the submission using only the hash
// The contest must be `active` for both steps.

// POST /api/contests/<contestId>/submissions/evaluate — step 1.
// Processes the article link and returns { article_link, article_metadata, hash }.
export async function evaluateSubmission(contestId, articleLink) {
  const { data } = await client.post(
    `/api/contests/${contestId}/submissions/evaluate`,
    { article_link: articleLink },
  )
  return data
}

// POST /api/contests/<contestId>/submissions — step 2.
// Confirms the submission using the `hash` from evaluate. Returns the submission object.
export async function createSubmission(contestId, hash) {
  const { data } = await client.post(
    `/api/contests/${contestId}/submissions`,
    { hash },
  )
  return data
}

// GET /api/contests/<contestId>/submissions — list a contest's submissions,
// newest first (own only, unless creator/jury/superadmin). Returns an array.
export async function listSubmissions(contestId) {
  const { data } = await client.get(`/api/contests/${contestId}/submissions`)
  return data.submissions
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
