import client from './client'

// The OAuth handshake routes are full-page redirects, not XHR endpoints, so we
// expose their absolute URLs for use as `window.location` targets / links.
const base = client.defaults.baseURL || ''

export const loginUrl = `${base}/login`
export const logoutUrl = `${base}/logout`

// Redirect the browser to start the MediaWiki OAuth handshake.
export function login() {
  window.location.assign(loginUrl)
}

// Redirect the browser to clear the session token.
export function logout() {
  window.location.assign(logoutUrl)
}

// GET /api/user — current auth state: { logged, username }. Does not require login.
export async function getCurrentUser() {
  const { data } = await client.get('/api/user')
  return data
}
