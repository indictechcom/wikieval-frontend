<script setup>
import { computed } from 'vue'
import { mdiWhiteBalanceSunny, mdiWeatherNight } from '@mdi/js'
import { useTheme } from '../composables/useTheme'

const { isDark, toggle } = useTheme()
const label = computed(() =>
  isDark.value ? 'Switch to light mode' : 'Switch to dark mode',
)
const icon = computed(() =>
  isDark.value ? mdiWhiteBalanceSunny : mdiWeatherNight,
)
</script>

<template>
  <v-btn
    :icon="icon"
    variant="outlined"
    size="x-small"
    :aria-label="label"
    :title="label"
    @click="toggle"
  />
</template>
