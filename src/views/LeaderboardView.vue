<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mdiArrowLeft, mdiTrophy, mdiOpenInNew, mdiChevronDown, mdiChevronUp } from '@mdi/js'
import { getContest, getLeaderboard } from '../api/contests'
import { listSubmissions } from '../api/submissions'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const { username } = useAuth()

const contest = ref(null)
const rows = ref([])
const loading = ref(true)
const error = ref('')

// Article titles behind each row. GET /submissions returns every submission to
// organizers, jury and superadmins, and only the viewer's own to anyone else,
// so grouping by user gives each viewer exactly what they may see.
const submissionsByUser = ref({})
const expanded = ref([]) // user_ids whose titles are open

function toggle(item) {
  const id = item.user_id
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((x) => x !== id)
    : [...expanded.value, id]
}
const isExpanded = (item) => expanded.value.includes(item.user_id)
const titlesFor = (item) => submissionsByUser.value[item.user_id] || null
// Titles exist for this row only if the viewer is allowed to see them.
const canSeeTitles = (item) => !!titlesFor(item) || item.username === username.value

const statusColor = (status) =>
  ({ accepted: 'success', rejected: 'error', pending: 'warning' })[status] || 'grey'

function decode(value) {
  if (!value) return ''
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}

// Sortable columns (click a header to sort). Defaults to alphabetical username.
const headers = [
  { title: 'Username', key: 'username', align: 'start' },
  { title: 'Submissions', key: 'total_submissions', align: 'center' },
  { title: 'Total Marks', key: 'total_marks', align: 'center' },
  { title: 'Reviewed', key: 'reviewed_count', align: 'center' },
  { title: 'Pending', key: 'pending_count', align: 'center' },
]

async function load(id) {
  loading.value = true
  error.value = ''
  expanded.value = []
  try {
    const [c, board, subs] = await Promise.all([
      getContest(id),
      getLeaderboard(id),
      listSubmissions(id).catch(() => []),
    ])
    contest.value = c
    rows.value = board
    const grouped = {}
    for (const s of subs) (grouped[s.user_id] ||= []).push(s)
    submissionsByUser.value = grouped
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, (id) => load(id), { immediate: true })
</script>

<template>
  <v-container class="py-8" style="max-width: 1000px">
    <div class="mb-6">
      <v-btn
        variant="outlined"
        :prepend-icon="mdiArrowLeft"
        :to="`/contests/${route.params.id}`"
      >
        Back to Contest
      </v-btn>
    </div>

    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="error" type="error" variant="tonal">
      {{ error }}
    </v-alert>

    <template v-else>
      <div class="d-flex align-center ga-3 mb-6">
        <v-icon :icon="mdiTrophy" size="large" color="primary" />
        <h1 class="text-h4 font-weight-bold">
          {{ contest?.name }} - Leaderboard
        </h1>
      </div>

      <v-alert
        v-if="rows.length === 0"
        type="info"
        variant="tonal"
      >
        No submissions have been made to this contest yet.
      </v-alert>

      <v-card v-else variant="outlined">
        <v-card-title class="text-body-1 font-weight-bold">
          {{ rows.length }}
          {{ rows.length === 1 ? 'Participant' : 'Participants' }}
        </v-card-title>
        <v-divider />
        <div class="px-4 pt-3 text-caption text-medium-emphasis">
          Click a participant to see the articles they submitted.
        </div>
        <v-data-table
          v-model:expanded="expanded"
          :headers="headers"
          :items="rows"
          item-value="user_id"
          :items-per-page="-1"
          :sort-by="[{ key: 'username', order: 'asc' }]"
          hide-default-footer
          density="comfortable"
          hover
          @click:row="(_, { item }) => toggle(item)"
        >
          <template #item.username="{ item }">
            <span class="d-inline-flex align-center ga-1 font-weight-medium text-primary" style="cursor: pointer">
              <v-icon :icon="isExpanded(item) ? mdiChevronUp : mdiChevronDown" size="small" />
              {{ item.username }}
            </span>
          </template>
          <template #item.total_submissions="{ item }">
            <span class="text-primary" style="cursor: pointer">{{ item.total_submissions }}</span>
          </template>

          <!-- Article titles for the participant -->
          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="pa-0 bg-surface-light">
                <div v-if="!canSeeTitles(item)" class="pa-4 text-caption text-medium-emphasis">
                  Article titles are visible to the contest's organizers and jury.
                </div>
                <div v-else-if="!titlesFor(item)?.length" class="pa-4 text-caption text-medium-emphasis">
                  No submissions.
                </div>
                <v-table v-else density="compact" class="bg-transparent">
                  <thead>
                    <tr>
                      <th class="ps-8">Article</th>
                      <th>Status</th>
                      <th class="text-center">Score</th>
                      <th>Reviewed by</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in titlesFor(item)" :key="s.id">
                      <td class="ps-8">
                        <a
                          :href="s.article_metadata?.article_url || s.article_link"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="d-inline-flex align-center ga-1"
                          @click.stop
                        >
                          {{ decode(s.article_metadata?.article_title || s.article_link) }}
                          <v-icon :icon="mdiOpenInNew" size="x-small" />
                        </a>
                      </td>
                      <td>
                        <v-chip :color="statusColor(s.status)" size="x-small" label>
                          {{ s.status }}
                        </v-chip>
                      </td>
                      <td class="text-center">{{ s.score }}</td>
                      <td class="text-medium-emphasis">
                        {{ (s.reviews || []).map((r) => r.reviewer_username).join(', ') || '—' }}
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </td>
            </tr>
          </template>
          <template #item.total_marks="{ item }">
            <span class="font-weight-bold text-primary">
              {{ item.total_marks }}
            </span>
          </template>
          <template #item.reviewed_count="{ item }">
            <v-chip color="success" size="small" label>
              {{ item.reviewed_count }}
            </v-chip>
          </template>
          <template #item.pending_count="{ item }">
            <v-chip color="warning" size="small" label>
              {{ item.pending_count }}
            </v-chip>
          </template>
        </v-data-table>
      </v-card>
    </template>
  </v-container>
</template>
