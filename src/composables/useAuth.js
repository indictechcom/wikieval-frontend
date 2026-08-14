import { ref } from 'vue'
import { getCurrentUser } from '../api/auth'

// Shared, app-wide auth state. Populated by fetchUser() (calls GET /api/user),
// which App.vue runs once on mount. Module-level refs → a single source of truth.
const username = ref(null)
const logged = ref(false)
const isSuperadmin = ref(false)
const canCreateContest = ref(false)
const loading = ref(true)

async function fetchUser() {
  loading.value = true
  try {
    const data = await getCurrentUser()
    logged.value = Boolean(data.logged)
    username.value = data.username
    isSuperadmin.value = Boolean(data.is_superadmin)
    canCreateContest.value = Boolean(data.can_create_contest)
  } catch {
    logged.value = false
    username.value = null
    isSuperadmin.value = false
    canCreateContest.value = false
  } finally {
    loading.value = false
  }
}

export function useAuth() {
  return {
    username,
    logged,
    isSuperadmin,
    canCreateContest,
    loading,
    fetchUser,
  }
}
