// MediaWiki API helpers (Meta-Wiki). These are public, anonymous, cross-origin
// requests, so they use plain fetch with origin=* (CORS) — NOT the app's axios
// client, which is credentialed and points at our own backend.
const META_API = 'https://meta.wikimedia.org/w/api.php'

// Search users by name prefix via list=allusers.
// MediaWiki uppercases the first letter of usernames, so we normalize the
// prefix to match (a lowercase "jay" would otherwise never hit "Jayprakash").
export async function searchUsers(prefix, limit = 10) {
  const normalized = prefix.charAt(0).toUpperCase() + prefix.slice(1)
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'allusers',
    formatversion: '2',
    auprefix: normalized,
    aulimit: String(limit),
    origin: '*',
  })
  const res = await fetch(`${META_API}?${params}`)
  if (!res.ok) throw new Error(`MediaWiki request failed (${res.status})`)
  const data = await res.json()
  return (data.query?.allusers || []).map((u) => u.name)
}
