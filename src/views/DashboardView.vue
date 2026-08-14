<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  mdiInboxOutline,
  mdiTrophyOutline,
  mdiEye,
  mdiGavel,
  mdiCommentQuoteOutline,
} from '@mdi/js'
import { listContests } from '../api/contests'
import { listSubmissions } from '../api/submissions'
import { contestStatus } from '../utils/contestStatus'
import { useAuth } from '../composables/useAuth'
import ParameterScores from '../components/ParameterScores.vue'

const router = useRouter()
const { username, logged } = useAuth()

const loading = ref(true)
const error = ref('')

// Aggregated dashboard data (the new API has no single dashboard endpoint,
// so we build it from contests + our own submissions per contest).
const submissions = ref([]) // { ...submission, contest_id, contest_name }
const participated = ref([]) // contest objects the user submitted to
const juryContests = ref([]) // contests where the user is a jury member
const juryCount = computed(() => juryContests.value.length)

const totalScore = computed(() =>
  submissions.value.reduce((sum, s) => sum + (s.score || 0), 0),
)

// Per-contest score totals for the "Contest Scores" panel.
const contestScores = computed(() =>
  participated.value.map((contest) => ({
    id: contest.id,
    name: contest.name,
    score: submissions.value
      .filter((s) => s.contest_id === contest.id)
      .reduce((sum, s) => sum + (s.score || 0), 0),
  })),
)

// Newest submissions first for the "Recent Submissions" panel.
const recentSubmissions = computed(() =>
  [...submissions.value].sort(
    (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at),
  ),
)

const statusColor = (status) =>
  ({ accepted: 'success', rejected: 'error', pending: 'warning' })[status] ||
  'grey'

function formatDate(value) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

async function loadDashboard() {
  loading.value = true
  error.value = ''
  try {
    const contests = await listContests()
    juryContests.value = contests.filter((c) =>
      (c.jury_members || []).includes(username.value),
    )

    // Fetch our submissions for each visible contest in parallel.
    const perContest = await Promise.all(
      contests.map(async (contest) => {
        try {
          const subs = await listSubmissions(contest.id)
          const mine = subs.filter((s) => s.username === username.value)
          return { contest, mine }
        } catch {
          return { contest, mine: [] }
        }
      }),
    )

    const withSubs = perContest.filter((r) => r.mine.length > 0)
    participated.value = withSubs.map((r) => ({
      ...r.contest,
      submitted_at: r.mine[0].submitted_at,
    }))
    submissions.value = withSubs.flatMap((r) =>
      r.mine.map((s) => ({
        ...s,
        contest_id: r.contest.id,
        contest_name: r.contest.name,
      })),
    )
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function viewContest(id) {
  router.push(`/contests/${id}`)
}

// Load once auth resolves (submissions endpoints need a session).
watch(logged, (isLogged) => isLogged && loadDashboard(), { immediate: true })
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 font-weight-bold pb-3 mb-6 border-b-md">Dashboard</h1>

    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="error" type="error" variant="tonal">
      {{ error }}
    </v-alert>

    <template v-else>
      <!-- Stat cards -->
      <v-row class="mb-4">
        <v-col cols="12" sm="6" md="4">
          <v-card variant="outlined" class="text-center pa-4">
            <div class="text-caption text-uppercase text-medium-emphasis mb-2">
              Total Score
            </div>
            <div class="text-h3 font-weight-bold text-primary">
              {{ totalScore }}
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card variant="outlined" class="text-center pa-4">
            <div class="text-caption text-uppercase text-medium-emphasis mb-2">
              Participated Contests
            </div>
            <div class="text-h3 font-weight-bold text-success">
              {{ participated.length }}
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <v-card variant="outlined" class="text-center pa-4">
            <div class="text-caption text-uppercase text-medium-emphasis mb-2">
              Jury Member
            </div>
            <div class="text-h3 font-weight-bold text-warning">
              {{ juryCount }}
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Recent submissions + contest scores -->
      <v-row>
        <v-col cols="12" md="6">
          <h2 class="text-h6 font-weight-bold mb-3">Recent Submissions</h2>
          <v-card variant="outlined" min-height="140">
            <v-list v-if="recentSubmissions.length">
              <v-list-item v-for="s in recentSubmissions" :key="s.id">
                <v-list-item-title>
                  {{ s.article_metadata?.article_title || s.article_link }}
                </v-list-item-title>
                <v-list-item-subtitle>{{ s.contest_name }}</v-list-item-subtitle>
                <v-list-item-subtitle
                  v-if="s.review_comment"
                  class="mt-1 text-medium-emphasis"
                >
                  <v-icon :icon="mdiCommentQuoteOutline" size="x-small" />
                  {{ s.review_comment }}
                </v-list-item-subtitle>
                <ParameterScores :scores="s.parameter_scores" />
                <template #append>
                  <div class="text-right">
                    <v-chip :color="statusColor(s.status)" size="small" label>
                      {{ s.status }}
                    </v-chip>
                    <div
                      v-if="s.status !== 'pending'"
                      class="text-caption text-medium-emphasis mt-1"
                    >
                      {{ s.score }} pts
                    </div>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <p v-else class="text-medium-emphasis pa-4">No submissions yet.</p>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <h2 class="text-h6 font-weight-bold mb-3">Contest Scores</h2>
          <v-card variant="outlined" min-height="140">
            <v-list v-if="contestScores.length" lines="one">
              <v-list-item
                v-for="score in contestScores"
                :key="score.id"
                :title="score.name"
              >
                <template #append>
                  <v-chip color="primary" size="small" label>
                    {{ score.score }} points
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <p v-else class="text-medium-emphasis pa-4">No scores yet.</p>
          </v-card>
        </v-col>
      </v-row>

      <!-- Participated contests -->
      <h2 class="text-h6 font-weight-bold mt-6 mb-3">Participated Contests</h2>
      <v-card variant="outlined">
        <v-table v-if="participated.length" hover>
          <thead>
            <tr>
              <th>Contest Name</th>
              <th>Project</th>
              <th>Status</th>
              <th>Submitted On</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="contest in participated"
              :key="contest.id"
              style="cursor: pointer"
              @click="viewContest(contest.id)"
            >
              <td>
                <v-icon :icon="mdiTrophyOutline" size="small" color="primary" class="me-2" />
                <strong>{{ contest.name }}</strong>
              </td>
              <td>{{ contest.project_name || 'N/A' }}</td>
              <td>
                <v-chip
                  :color="contestStatus(contest).color"
                  size="small"
                  label
                >
                  {{ contestStatus(contest).label }}
                </v-chip>
              </td>
              <td>{{ formatDate(contest.submitted_at) }}</td>
              <td class="text-right">
                <v-btn
                  size="small"
                  variant="outlined"
                  color="primary"
                  :prepend-icon="mdiEye"
                  @click.stop="viewContest(contest.id)"
                >
                  View
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>

        <div v-else class="text-center py-12">
          <v-icon :icon="mdiInboxOutline" size="48" class="text-medium-emphasis mb-3" />
          <p class="text-medium-emphasis">
            You haven't participated in any contests yet.
          </p>
        </div>
      </v-card>

      <!-- Contests the user judges -->
      <template v-if="juryContests.length">
        <h2 class="text-h6 font-weight-bold mt-6 mb-3">Contests You Judge</h2>
        <v-card variant="outlined">
          <v-table hover>
            <thead>
              <tr>
                <th>Contest Name</th>
                <th>Project</th>
                <th>Status</th>
                <th>Submissions</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="contest in juryContests"
                :key="contest.id"
                style="cursor: pointer"
                @click="viewContest(contest.id)"
              >
                <td>
                  <v-icon
                    :icon="mdiGavel"
                    size="small"
                    color="primary"
                    class="me-2"
                  />
                  <strong>{{ contest.name }}</strong>
                </td>
                <td>{{ contest.project_name || 'N/A' }}</td>
                <td>
                  <v-chip
                    :color="contestStatus(contest).color"
                    size="small"
                    label
                  >
                    {{ contestStatus(contest).label }}
                  </v-chip>
                </td>
                <td>{{ contest.submission_count ?? 0 }}</td>
                <td class="text-right">
                  <v-btn
                    size="small"
                    variant="outlined"
                    color="primary"
                    :prepend-icon="mdiGavel"
                    @click.stop="viewContest(contest.id)"
                  >
                    Review
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </template>
    </template>
  </v-container>
</template>
