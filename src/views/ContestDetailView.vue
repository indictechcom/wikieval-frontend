<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  mdiArrowLeft,
  mdiTrophy,
  mdiInformationOutline,
  mdiChartLine,
  mdiFormatAlignLeft,
  mdiBookOpenVariant,
  mdiFileDocumentOutline,
  mdiLinkVariant,
  mdiFileOutline,
  mdiAccountGroup,
  mdiCalendarBlankOutline,
  mdiAccountTie,
  mdiGavel,
  mdiPlayCircleOutline,
  mdiPencil,
  mdiSend,
  mdiOpenInNew,
  mdiCommentQuoteOutline,
} from '@mdi/js'
import { getContest, startContest } from '../api/contests'
import { listSubmissions } from '../api/submissions'
import { contestStatus } from '../utils/contestStatus'
import { useAuth } from '../composables/useAuth'
import DetailSection from '../components/DetailSection.vue'
import ContestFormModal from '../components/ContestFormModal.vue'
import SubmitArticleModal from '../components/SubmitArticleModal.vue'
import ReviewSubmissionModal from '../components/ReviewSubmissionModal.vue'
import ParameterScores from '../components/ParameterScores.vue'

const route = useRoute()
const { username, logged } = useAuth()

const contest = ref(null)
const loading = ref(true)
const error = ref('')

// Start-contest flow.
const startDialog = ref(false)
const starting = ref(false)
const toast = ref({ show: false, text: '', color: 'success' })

// Edit flow.
const editOpen = ref(false)

// Submission flow.
const submitOpen = ref(false)
const submissions = ref([])
const submissionsLoading = ref(false)

// Jury review flow.
const reviewOpen = ref(false)
const reviewTarget = ref(null)

// Derived contest fields (submission constraints live under `rules`).
const rules = computed(() => {
  const r = contest.value?.rules
  return r && typeof r === 'object' ? r : {}
})
const organizers = computed(() => {
  const c = contest.value
  if (c?.organizers?.length) return c.organizers
  return c?.creator_username ? [c.creator_username] : []
})

// Only organizers manage the contest. They can start a draft (pending) contest,
// and can edit it — all fields while pending, only the organizer/jury lists once
// active.
const isOrganizer = computed(
  () => !!username.value && organizers.value.includes(username.value),
)
const canStart = computed(
  () => contest.value?.status === 'pending' && isOrganizer.value,
)
const canEdit = computed(() => isOrganizer.value)
// Only active contests accept submissions.
const canSubmit = computed(
  () => !!logged.value && contest.value?.status === 'active',
)

// Jury members review submissions.
const isJury = computed(
  () =>
    !!username.value &&
    (contest.value?.jury_members || []).includes(username.value),
)

const submissionStatusColor = (status) =>
  ({ accepted: 'success', rejected: 'error', pending: 'warning' })[status] ||
  'grey'

function openReview(submission) {
  reviewTarget.value = submission
  reviewOpen.value = true
}

function onReviewed(updated) {
  const i = submissions.value.findIndex((s) => s.id === updated.id)
  if (i !== -1) submissions.value[i] = updated
  toast.value = { show: true, text: 'Submission reviewed.', color: 'success' }
}
const submissionType = computed(
  () =>
    rules.value.allowed_submission_type ||
    contest.value?.allowed_submission_type ||
    'both',
)
const submissionTypeLabel = computed(
  () =>
    ({
      new: 'New Articles Only',
      expansion: 'Improved Articles Only',
      both: 'Both (New Articles + Improved Articles)',
    })[submissionType.value] || 'Both (New Articles + Improved Articles)',
)
const minRef = computed(
  () => rules.value.min_reference_count ?? contest.value?.min_reference_count ?? 0,
)
const minBytes = computed(() => rules.value.min_byte_count ?? 0)
const scoring = computed(() => {
  const sp = contest.value?.scoring_parameters
  return sp && sp.enabled ? sp : null
})
const rulesText = computed(() => {
  const r = contest.value?.rules
  if (typeof r === 'string') return r
  return r?.text || contest.value?.contest_rules || ''
})

// Draft (pending) / Active / Upcoming / Past.
const status = computed(() => contestStatus(contest.value))

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const date = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const time = d
    .toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    })
    .toLowerCase()
  return `${date} at ${time} UTC`
}

async function load(id) {
  loading.value = true
  error.value = ''
  try {
    contest.value = await getContest(id)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function start() {
  starting.value = true
  try {
    contest.value = await startContest(contest.value.id)
    startDialog.value = false
    toast.value = { show: true, text: 'Contest started.', color: 'success' }
  } catch (e) {
    toast.value = { show: true, text: e.message, color: 'error' }
  } finally {
    starting.value = false
  }
}

function onSaved(updated) {
  contest.value = updated
  toast.value = { show: true, text: 'Contest updated.', color: 'success' }
}

async function loadSubmissions(id) {
  submissionsLoading.value = true
  try {
    submissions.value = await listSubmissions(id)
  } catch {
    submissions.value = []
  } finally {
    submissionsLoading.value = false
  }
}

function onSubmitted() {
  toast.value = { show: true, text: 'Article submitted.', color: 'success' }
  if (contest.value) loadSubmissions(contest.value.id)
}

watch(() => route.params.id, (id) => load(id), { immediate: true })

// Submissions need a session; (re)load when the contest or auth state changes.
watch(
  [() => contest.value?.id, logged],
  ([id, isLogged]) => {
    if (id && isLogged) loadSubmissions(id)
    else submissions.value = []
  },
  { immediate: true },
)
</script>

<template>
  <v-container class="py-8" style="max-width: 1000px">
    <div class="d-flex justify-space-between align-center mb-6">
      <v-btn variant="outlined" :prepend-icon="mdiArrowLeft" to="/contests">
        Back to Contests
      </v-btn>
      <div class="d-flex ga-2">
        <v-btn
          v-if="canEdit"
          variant="outlined"
          :prepend-icon="mdiPencil"
          @click="editOpen = true"
        >
          Edit
        </v-btn>
        <v-btn
          v-if="canSubmit"
          color="primary"
          variant="flat"
          :prepend-icon="mdiSend"
          @click="submitOpen = true"
        >
          Submit Article
        </v-btn>
        <v-btn
          v-if="canStart"
          color="success"
          variant="flat"
          :prepend-icon="mdiPlayCircleOutline"
          @click="startDialog = true"
        >
          Start Contest
        </v-btn>
        <v-btn
          v-if="logged && contest && contest.status !== 'pending'"
          color="primary"
          variant="flat"
          :prepend-icon="mdiTrophy"
          :to="`/contests/${contest.id}/leaderboard`"
        >
          Leaderboard
        </v-btn>
      </div>
    </div>

    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="error" type="error" variant="tonal">
      {{ error }}
    </v-alert>

    <template v-else-if="contest">
      <!-- Title + meta -->
      <h1 class="text-h3 font-weight-bold mb-2">{{ contest.name }}</h1>
      <div class="d-flex align-center ga-3 pb-3 mb-6 border-b-md">
        <v-chip :color="status.color" size="small" label>
          {{ status.label }}
        </v-chip>
        <span class="text-medium-emphasis d-flex align-center ga-1">
          <v-icon :icon="mdiCalendarBlankOutline" size="x-small" />
          Created {{ formatDateTime(contest.created_at) }}
        </span>
      </div>

      <!-- Contest Details -->
      <DetailSection title="Contest Details" :icon="mdiInformationOutline">
        <p class="mb-2"><strong>Project:</strong> {{ contest.project_name }}</p>
        <p class="mb-2">
          <strong>Status:</strong>
          <v-chip :color="status.color" size="x-small" label class="ms-1">
            {{ status.label }}
          </v-chip>
        </p>
        <p v-if="contest.start_date" class="mb-2">
          <strong>Start Date:</strong> {{ formatDateTime(contest.start_date) }}
        </p>
        <p v-if="contest.end_date" class="mb-2">
          <strong>End Date:</strong> {{ formatDateTime(contest.end_date) }}
        </p>
        <p v-if="contest.outreach_dashboard_url" class="mb-2">
          <strong>Outreach Dashboard:</strong>
          <a
            :href="contest.outreach_dashboard_url"
            target="_blank"
            rel="noopener noreferrer"
            class="ms-1"
          >
            View course
            <v-icon :icon="mdiOpenInNew" size="x-small" />
          </a>
        </p>
        <p class="mb-2"><strong>Organizers:</strong></p>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="organizer in organizers"
            :key="organizer"
            color="primary"
            variant="flat"
            :prepend-icon="mdiAccountTie"
          >
            {{ organizer }}
          </v-chip>
        </div>
      </DetailSection>

      <!-- Description -->
      <DetailSection
        v-if="contest.description"
        title="Description"
        :icon="mdiFormatAlignLeft"
      >
        <p style="white-space: pre-wrap">{{ contest.description }}</p>
      </DetailSection>

      <!-- Scoring System + Submission Type, side by side -->
      <v-row class="mb-4">

        <v-col cols="12" md="6">
          <DetailSection title="Scoring System" :icon="mdiChartLine" fill-height>
            <!-- Multi-parameter scoring -->
            <template v-if="scoring">
              <div class="d-flex ga-6 mb-3">
                <div>
                  <span class="text-medium-emphasis">Max score:</span>
                  <strong class="text-primary ms-1">{{ scoring.max_score }}</strong>
                </div>
                <div>
                  <span class="text-medium-emphasis">Rejected:</span>
                  <strong class="text-primary ms-1">{{ scoring.min_score }}</strong>
                </div>
              </div>
              <div
                v-for="p in scoring.parameters"
                :key="p.name"
                class="mb-2"
              >
                <div class="d-flex justify-space-between align-center">
                  <span class="font-weight-medium">{{ p.name }}</span>
                  <v-chip color="primary" size="x-small" label>
                    {{ p.weight }}%
                  </v-chip>
                </div>
                <div v-if="p.description" class="text-caption text-medium-emphasis">
                  {{ p.description }}
                </div>
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                Each parameter scored 0–10; weighted average scaled to max score.
              </div>
            </template>

            <!-- Simple scoring -->
            <v-row v-else dense>
              <v-col cols="12" sm="6">
                <div
                  class="d-flex justify-space-between align-center pa-4 rounded border"
                >
                  <span>Accepted</span>
                  <span class="text-h6 font-weight-bold text-primary">
                    {{ contest.marks_setting_accepted ?? 0 }}
                  </span>
                </div>
              </v-col>
              <v-col cols="12" sm="6">
                <div
                  class="d-flex justify-space-between align-center pa-4 rounded border"
                >
                  <span>Rejected</span>
                  <span class="text-h6 font-weight-bold text-primary">
                    {{ contest.marks_setting_rejected ?? 0 }}
                  </span>
                </div>
              </v-col>
            </v-row>
          </DetailSection>
        </v-col>

        <v-col cols="12" md="6">
          <DetailSection
            title="Submission Type Allowed"
            :icon="mdiFileDocumentOutline"
            fill-height
          >
            <p class="font-weight-bold mb-3">{{ submissionTypeLabel }}</p>
            <p class="text-body-2 text-medium-emphasis font-italic mb-1">
              • <strong>New Articles</strong> = Completely new Wikipedia article
              created during the contest.
            </p>
            <p class="text-body-2 text-medium-emphasis font-italic">
              • <strong>Improved Articles</strong> = An existing article improved
              or expanded with substantial content.
            </p>
          </DetailSection>
        </v-col>
      </v-row>

      <!-- Contest Rules -->
      <DetailSection
        v-if="rulesText"
        title="Contest Rules"
        :icon="mdiBookOpenVariant"
      >
        <pre
          class="text-body-1"
          style="white-space: pre-wrap; font-family: inherit"
          >{{ rulesText }}</pre
        >
      </DetailSection>

      <!-- Minimum size + reference count, side by side -->
      <v-row v-if="minBytes > 0 || minRef > 0" class="mb-4">
        <v-col v-if="minBytes > 0" cols="12" md="6">
          <DetailSection
            title="Minimum Article Size"
            :icon="mdiFileOutline"
            fill-height
          >
            <p class="font-weight-bold mb-1">{{ minBytes }} bytes required</p>
            <p class="text-body-2 text-medium-emphasis d-flex align-center ga-1">
              <v-icon :icon="mdiInformationOutline" size="x-small" />
              Submitted articles must be at least {{ minBytes }} bytes in size.
            </p>
          </DetailSection>
        </v-col>

        <v-col v-if="minRef > 0" cols="12" md="6">
          <DetailSection
            title="Minimum Reference Count"
            :icon="mdiLinkVariant"
            fill-height
          >
            <p class="font-weight-bold mb-1">{{ minRef }} References required</p>
            <p class="text-body-2 text-medium-emphasis d-flex align-center ga-1">
              <v-icon :icon="mdiInformationOutline" size="x-small" />
              Submitted articles must have at least {{ minRef }} external
              references.
            </p>
          </DetailSection>
        </v-col>
      </v-row>

      <!-- Jury Members -->
      <DetailSection
        v-if="contest.jury_members?.length"
        title="Jury Members"
        :icon="mdiAccountGroup"
      >
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="jury in contest.jury_members"
            :key="jury"
            color="primary"
            variant="flat"
            :prepend-icon="mdiGavel"
          >
            {{ jury }}
          </v-chip>
        </div>
      </DetailSection>

      <!-- Submissions -->
      <DetailSection
        v-if="logged"
        title="Submissions"
        :icon="mdiFileDocumentOutline"
      >
        <div v-if="submissionsLoading" class="d-flex justify-center py-4">
          <v-progress-circular indeterminate color="primary" size="28" />
        </div>
        <p v-else-if="submissions.length === 0" class="text-medium-emphasis">
          No submissions yet.
        </p>
        <v-table v-else density="comfortable">
          <thead>
            <tr>
              <th>Article</th>
              <th>By</th>
              <th>Status</th>
              <th>Score</th>
              <th>Submitted</th>
              <th v-if="isJury" class="text-right">Review</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in submissions" :key="s.id">
              <td>
                <a
                  :href="s.article_metadata?.article_url || s.article_link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ s.article_metadata?.article_title || s.article_link }}
                </a>
                <div
                  v-if="s.review_comment"
                  class="text-caption text-medium-emphasis mt-1"
                >
                  <v-icon :icon="mdiCommentQuoteOutline" size="x-small" />
                  {{ s.review_comment }}
                </div>
                <ParameterScores :scores="s.parameter_scores" />
              </td>
              <td>{{ s.username }}</td>
              <td>
                <v-chip
                  :color="submissionStatusColor(s.status)"
                  size="small"
                  label
                >
                  {{ s.status }}
                </v-chip>
              </td>
              <td>{{ s.score }}</td>
              <td>{{ formatDateTime(s.submitted_at) }}</td>
              <td v-if="isJury" class="text-right">
                <v-btn
                  v-if="s.status === 'pending'"
                  size="small"
                  variant="tonal"
                  color="primary"
                  :prepend-icon="mdiGavel"
                  @click="openReview(s)"
                >
                  Review
                </v-btn>
                <span v-else class="text-medium-emphasis text-caption">
                  Reviewed
                </span>
              </td>
            </tr>
          </tbody>
        </v-table>
      </DetailSection>
    </template>

    <!-- Start confirmation -->
    <v-dialog v-model="startDialog" max-width="480">
      <v-card>
        <v-card-title class="text-h6">Start this contest?</v-card-title>
        <v-card-text>
          Starting the contest makes it active and <strong>locks its
          configuration</strong> — you won't be able to edit it afterwards.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="tonal" :disabled="starting" @click="startDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="success"
            variant="flat"
            :loading="starting"
            @click="start"
          >
            Start Contest
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ContestFormModal
      v-if="contest"
      v-model="editOpen"
      :contest="contest"
      @saved="onSaved"
    />

    <SubmitArticleModal
      v-if="contest"
      v-model="submitOpen"
      :contest-id="contest.id"
      @submitted="onSubmitted"
    />

    <ReviewSubmissionModal
      v-if="reviewTarget"
      v-model="reviewOpen"
      :submission="reviewTarget"
      :contest="contest"
      @reviewed="onReviewed"
    />

    <v-snackbar v-model="toast.show" :color="toast.color" timeout="4000">
      {{ toast.text }}
    </v-snackbar>
  </v-container>
</template>
