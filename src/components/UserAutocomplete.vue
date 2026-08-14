<script setup>
import { ref } from 'vue'
import { searchUsers } from '../api/mediawiki'

const model = defineModel({ type: Array, default: () => [] })

defineProps({
  label: { type: String, default: 'Users' },
  placeholder: { type: String, default: 'Type a username to search…' },
  hint: { type: String, default: '' },
})

const items = ref([])
const search = ref('')
const loading = ref(false)
let timer = null

// Debounced prefix search against the MediaWiki allusers API.
function onSearch(query) {
  clearTimeout(timer)
  if (!query || query.length < 2) {
    items.value = []
    return
  }
  timer = setTimeout(async () => {
    loading.value = true
    try {
      items.value = await searchUsers(query)
    } catch {
      items.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

// Clear the typed text (and stale results) once a user is picked.
function onSelect() {
  search.value = ''
  items.value = []
}
</script>

<template>
  <v-autocomplete
    v-model="model"
    v-model:search="search"
    :items="items"
    :label="label"
    :placeholder="placeholder"
    :hint="hint"
    :persistent-hint="!!hint"
    :loading="loading"
    variant="outlined"
    density="comfortable"
    multiple
    chips
    closable-chips
    no-filter
    hide-no-data
    @update:search="onSearch"
    @update:model-value="onSelect"
  />
</template>
