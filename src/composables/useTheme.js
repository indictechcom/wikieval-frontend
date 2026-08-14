import { computed } from 'vue'
import { useTheme as useVuetifyTheme } from 'vuetify'

// Thin wrapper over Vuetify's theme system: exposes isDark + a persisted toggle.
const STORAGE_KEY = 'theme'

export function useTheme() {
  const theme = useVuetifyTheme()
  const isDark = computed(() => theme.global.current.value.dark)

  function toggle() {
    const next = isDark.value ? 'light' : 'dark'
    theme.global.name.value = next
    localStorage.setItem(STORAGE_KEY, next)
  }

  return { isDark, toggle }
}
