<script setup>
import { computed } from 'vue'
import { mdiOpenInNew, mdiCheckCircle, mdiCloseCircle } from '@mdi/js'

const props = defineProps({
  metadata: { type: Object, default: () => ({}) },
  // Contest `rules` echoed by /evaluate (or the contest's own rules), used to
  // show each stat against its requirement. Optional.
  rules: { type: Object, default: () => ({}) },
})

const m = computed(() => props.metadata || {})
const r = computed(() => props.rules || {})
const num = (n) => (n ?? 0).toLocaleString('en-US')

// Build a requirement check for a stat: null when no minimum is set, otherwise
// { min, meets } so the row can render a pass/fail chip.
const req = (min, value) =>
  min > 0 ? { min, meets: (value ?? 0) >= min } : null
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
  {
    label: 'Byte count',
    value: num(m.value.byte_count),
    req: req(r.value.min_byte_count, m.value.byte_count),
  },
  {
    label: 'Word count',
    value: num(m.value.word_count),
    req: req(r.value.min_word_count, m.value.word_count),
  },
  {
    label: 'References',
    value: `${num(totalRefs.value)} (${num(m.value.ref_new_count)} new, ${num(m.value.ref_reused_count)} reused)`,
    req: req(r.value.min_reference_count, totalRefs.value),
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
          <td class="font-weight-medium">
            <span class="d-inline-flex align-center ga-2">
              {{ row.value }}
              <v-chip
                v-if="row.req"
                :color="row.req.meets ? 'success' : 'error'"
                size="x-small"
                variant="tonal"
                :prepend-icon="row.req.meets ? mdiCheckCircle : mdiCloseCircle"
              >
                min {{ num(row.req.min) }}
              </v-chip>
            </span>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
