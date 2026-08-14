import axios from 'axios'

// Shared axios instance. Import this everywhere instead of `axios` directly
// so base URL, credentials, and interceptors are configured in one place.
//
// baseURL points at the backend root (not `/api`) because the OAuth handshake
// routes (`/login`, `/logout`, `/oauth-callback`) live outside the `/api`
// namespace. Service modules include the full path (e.g. `/api/contests`).
//
// Auth is MediaWiki OAuth via a session cookie, so every request must be
// credentialed for the cookie to be sent (required under CORS).
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor — normalize the API's `{ "error": "..." }` shape into a
// thrown Error, while preserving the HTTP status for callers that branch on it.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const message =
      error.response?.data?.error || error.message || 'Request failed'
    const normalized = new Error(message)
    normalized.status = status
    normalized.response = error.response
    return Promise.reject(normalized)
  },
)

export default client
