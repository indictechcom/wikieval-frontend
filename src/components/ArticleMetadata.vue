<script setup>
import { computed } from 'vue'
import { mdiOpenInNew } from '@mdi/js'

const props = defineProps({
  metadata: { type: Object, default: () => ({}) },
})

const m = computed(() => props.metadata || {})
const num = (n) => (n ?? 0).toLocaleString('en-US')
const dateUTC = (v) =>
  v
    ? new Date(v).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : '—'
const totalRefs = computed(
  () => (m.value.ref_new_count || 0) + (m.value.ref_reused_count || 0),
)

// Permanent link to the exact evaluated revision on the source wiki.
const revisionUrl = computed(() => {
  const { article_url, revision_id } = m.value
  if (!article_url || !revision_id) return null
  try {
    return `${new URL(article_url).origin}/wiki/Special:PermanentLink/${revision_id}`
  } catch {
    return null
  }
})

const rows = computed(() => [
  { label: 'Byte count', value: num(m.value.byte_count) },
  {
    label: 'References',
    value: `${num(totalRefs.value)} (${num(m.value.ref_new_count)} new, ${num(m.value.ref_reused_count)} reused)`,
  },
  { label: 'Images', value: num(m.value.image_count) },
  { label: 'Creator', value: m.value.creator || '—' },
  { label: 'Created', value: dateUTC(m.value.created_at) },
  {
    label: 'Links',
    value: `${num(m.value.outgoing_links)} out · ${num(m.value.incoming_links)} in`,
  },
])
</script>

<template>
  <div>
    <div class="d-flex align-center ga-1 mb-2">
      <a
        v-if="m.article_url"
        :href="m.article_url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-h6"
      >
        {{ m.display_title || m.article_title }}
      </a>
      <span v-else class="text-h6">
        {{ m.display_title || m.article_title }}
      </span>
      <v-icon v-if="m.article_url" :icon="mdiOpenInNew" size="x-small" />
    </div>

    <v-table density="comfortable">
      <tbody>
        <tr>
          <td class="text-medium-emphasis" style="width: 40%">Revision</td>
          <td class="font-weight-medium">
            <a
              v-if="revisionUrl"
              :href="revisionUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ m.revision_id }}
            </a>
            <span v-else>{{ m.revision_id ?? '—' }}</span>
          </td>
        </tr>
        <tr v-for="row in rows" :key="row.label">
          <td class="text-medium-emphasis">{{ row.label }}</td>
          <td class="font-weight-medium">{{ row.value }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
