<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  mdiArrowLeft,
  mdiTrophy,
  mdiInformationOutline,
  mdiChartLine,
  mdiFormatAlignLeft,
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
  mdiDownload,
  mdiUpload,
  mdiImageMultiple,
  mdiAccountEdit,
  mdiAccountPlusOutline,
  mdiSitemapOutline,
  mdiLinkVariantPlus,
  mdiLinkVariantOff,
  mdiPlus,
} from '@mdi/js'
import {
  getContest,
  startContest,
  listChildren,
  listContests,
  updateContest,
} from '../api/contests'
import { listSubmissions } from '../api/submissions'
import { contestStatus } from '../utils/contestStatus'
import { formatInZone } from '../utils/timezone'
import { useAuth } from '../composables/useAuth'
import DetailSection from '../components/DetailSection.vue'
import ContestFormModal from '../components/ContestFormModal.vue'
import SubmitArticleModal from '../components/SubmitArticleModal.vue'
import ReviewSubmissionModal from '../components/ReviewSubmissionModal.vue'
import ParameterScores from '../components/ParameterScores.vue'
import AddSubmissionModal from '../components/AddSubmissionModal.vue'

const route = useRoute()
const { username, logged, isSuperadmin } = useAuth()

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

// Derived contest fields (submission constraints live under `eligibility_rules`).
const rules = computed(() => {
  const r = contest.value?.eligibility_rules
  return r && typeof r === 'object' ? r : {}
})
const organizers = computed(() => {
  const c = contest.value
  if (c?.organizers?.length) return c.organizers
  return c?.creator_username ? [c.creator_username] : []
})
// Who manages this contest: own organizers plus, for a child campaign, the
// parent group's organizers (the backend applies the same rule).
const managers = computed(() => {
  const c = contest.value
  return c?.effective_organizers?.length ? c.effective_organizers : organizers.value
})

// Only organizers manage the contest. They can start a draft (pending) contest,
// and can edit it — all fields while pending, only the organizer/jury lists once
// active. Group campaigns are active from creation and are never started.
const isOrganizer = computed(
  () => !!username.value && managers.value.includes(username.value),
)
const canStart = computed(
  () => contest.value?.status === 'pending' && !isGroup.value && isOrganizer.value,
)
const canEdit = computed(() => isOrganizer.value)
// Only contests that are active AND currently within their date window accept
// submissions. `status.key` is 'current' while the window is open; 'upcoming'
// before the start and 'past' once the end instant passes. The backend enforces
// this too (services/submission.py), so this just hides the button early.
const canSubmit = computed(
  () =>
    !!logged.value &&
    !isGroup.value &&
    contest.value?.status === 'active' &&
    status.value.key === 'current',
)

// --- Campaign hierarchy -------------------------------------------------
// A group campaign aggregates its child campaigns and takes no submissions.
const isGroup = computed(() => !!contest.value?.is_group)
const children = ref([])
const childrenLoading = ref(false)
const childCreateOpen = ref(false)

async function loadChildren(id) {
  childrenLoading.value = true
  try {
    children.value = await listChildren(id)
  } catch {
    children.value = []
  } finally {
    childrenLoading.value = false
  }
}
watch(
  [() => contest.value?.id, () => contest.value?.is_group, logged],
  ([id, group]) => {
    if (id && group) loadChildren(id)
    else children.value = []
  },
  { immediate: true },
)

const childTotals = computed(() =>
  children.value.reduce(
    (t, c) => ({
      submissions: t.submissions + (c.submission_count || 0),
      accepted: t.accepted + (c.accepted_count || 0),
      rejected: t.rejected + (c.rejected_count || 0),
      pending: t.pending + (c.pending_count || 0),
      participants: t.participants + (c.participant_count || 0),
    }),
    { submissions: 0, accepted: 0, rejected: 0, pending: 0, participants: 0 },
  ),
)
const childStatus = (c) => contestStatus(c)

function onChildCreated() {
  toast.value = { show: true, text: 'Child campaign created.', color: 'success' }
  loadChildren(contest.value.id)
  load(route.params.id)
}

// Attach an existing contest (one the user organizes, standalone) as a child.
const attachOpen = ref(false)
const attachCandidates = ref([])
const attachTarget = ref(null)
const attaching = ref(false)
async function openAttach() {
  attachTarget.value = null
  attachOpen.value = true
  try {
    const all = await listContests()
    attachCandidates.value = all.filter(
      (c) =>
        !c.is_group &&
        !c.parent_id &&
        (c.organizers || []).includes(username.value),
    )
  } catch {
    attachCandidates.value = []
  }
}
async function attach() {
  if (!attachTarget.value) return
  attaching.value = true
  try {
    await updateContest(attachTarget.value, { parent_id: contest.value.id })
    attachOpen.value = false
    toast.value = { show: true, text: 'Campaign attached.', color: 'success' }
    loadChildren(contest.value.id)
    load(route.params.id)
  } catch (e) {
    toast.value = { show: true, text: e.message, color: 'error' }
  } finally {
    attaching.value = false
  }
}
async function detach(child) {
  try {
    await updateContest(child.id, { parent_id: null })
    toast.value = { show: true, text: `${child.name} detached.`, color: 'success' }
    loadChildren(contest.value.id)
    load(route.params.id)
  } catch (e) {
    toast.value = { show: true, text: e.message, color: 'error' }
  }
}

// Jury members review submissions.
const isJury = computed(
  () =>
    !!username.value &&
    (contest.value?.jury_members || []).includes(username.value),
)

const submissionStatusColor = (status) =>
  ({ accepted: 'success', rejected: 'error', pending: 'warning' })[status] ||
  'grey'

// Multiple jury reviews per article (contest.reviews_required > 1).
const reviewsRequired = computed(() => contest.value?.reviews_required ?? 1)
const multiReview = computed(() => reviewsRequired.value > 1)
const myReview = (s) =>
  (s.reviews || []).find((r) => r.reviewer_username === username.value) || null
// Reviews that have a comment, for display under the article.
const reviewComments = (s) => (s.reviews || []).filter((r) => r.review_comment)

// Contest organizers (incl. creator) and superadmins can export the full
// submissions list as CSV. The backend already returns every submission to them.
const canExport = computed(
  () => (isOrganizer.value || isSuperadmin.value) && submissions.value.length > 0,
)

// Wrap a value for CSV: stringify, escape embedded quotes, and quote it. Guards
// against values starting with =, +, -, @ (spreadsheet formula injection).
function csvCell(value) {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

// Percent-decode a URL/title for readability (e.g. %E0%A8%AD -> ਭ). Falls back
// to the raw value if it isn't validly encoded.
function decode(value) {
  if (!value) return ''
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}

function exportCsv() {
  const headers = [
    'Article',
    'Article URL',
    'By',
    'Status',
    'Score',
    'Reviewed By',
    'Review Comment',
    'Reviews',
    'Submitted',
  ]
  const rows = submissions.value.map((s) => [
    decode(s.article_metadata?.article_title || s.article_link),
    decode(s.article_metadata?.article_url || s.article_link),
    s.username,
    s.status,
    s.score ?? '',
    s.reviewed_by_username || '',
    s.review_comment || '',
    (s.reviews || [])
      .map((r) => `${r.reviewer_username}: ${r.decision}${r.decision === 'accept' ? ` ${r.score}` : ''}`)
      .join('; '),
    s.submitted_at || '',
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')

  // Prepend a UTF-8 BOM so Excel renders non-Latin article titles correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const slug = (contest.value?.name || 'contest')
    .replace(/[^\wÀ-￿ -]/g, '')
    .trim()
    .replace(/\s+/g, '_')
  const link = document.createElement('a')
  link.href = url
  link.download = `${slug || 'contest'}_submissions.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Superadmin-only CSV import — handled on a dedicated page (/contests/:id/import).
const canImport = computed(() => isSuperadmin.value)

// Organizers can add a single missed submission on behalf of a participant.
const addOpen = ref(false)
const canAddSubmission = computed(() => isOrganizer.value)
async function onSubmissionAdded() {
  await loadSubmissions(route.params.id)
  toast.value = { show: true, text: 'Submission added.', color: 'success' }
}

function openReview(submission) {
  reviewTarget.value = submission
  reviewOpen.value = true
}

function onReviewed(updated) {
  const i = submissions.value.findIndex((s) => s.id === updated.id)
  if (i !== -1) submissions.value[i] = updated
  toast.value = { show: true, text: 'Submission reviewed.', color: 'success' }
}
// Always shown; defaults to "both" when the rule isn't set (the backend default).
const submissionType = computed(() => rules.value.allowed_submission_type || 'both')
const submissionTypeLabel = computed(
  () =>
    ({
      new: 'New Articles Only',
      expansion: 'Expansions Only',
      both: 'Both (New + Expansions)',
    })[submissionType.value] || 'Both (New + Expansions)',
)
const minRef = computed(() => rules.value.min_reference_count ?? 0)
const minBytes = computed(() => rules.value.min_byte_count ?? 0)
const minWords = computed(() => rules.value.min_word_count ?? 0)
const minImages = computed(() => rules.value.min_image_count ?? 0)
const authorOnly = computed(() => !!rules.value.author_only)
const scoring = computed(() => {
  const sp = contest.value?.scoring_parameters
  return sp && sp.enabled ? sp : null
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

// Contest window dates are shown in the contest's own timezone, with a label
// (e.g. '24 Aug 2026, 23:59 IST').
function formatWindow(value) {
  return formatInZone(value, contest.value?.timezone)
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

// The user refreshed an article they had already submitted: stats replaced and
// any jury review removed (back to pending).
function onUpdated() {
  toast.value = {
    show: true,
    text: 'Submission stats updated. Any previous jury review was removed; it is pending review again.',
    color: 'success',
  }
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
          v-if="logged && contest && contest.status !== 'pending' && !isGroup"
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
        <v-chip
          v-if="isGroup"
          size="small"
          color="primary"
          variant="tonal"
          label
          :prepend-icon="mdiSitemapOutline"
        >
          Group campaign
        </v-chip>
        <v-chip
          v-else-if="contest.parent_id"
          size="small"
          variant="tonal"
          label
          :prepend-icon="mdiSitemapOutline"
          :to="`/contests/${contest.parent_id}`"
        >
          Part of {{ contest.parent_name }}
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
          <strong>Start Date:</strong> {{ formatWindow(contest.start_date) }}
        </p>
        <p v-if="contest.end_date" class="mb-2">
          <strong>End Date:</strong> {{ formatWindow(contest.end_date) }}
        </p>
        <p v-if="contest.project_link" class="mb-2">
          <strong>Project Link:</strong>
          <a
            :href="contest.project_link"
            target="_blank"
            rel="noopener noreferrer"
            class="ms-1"
          >
            View project
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

      <!-- On a group campaign the scoring, eligibility and jury below are only
           the defaults copied into each new child campaign. -->
      <v-alert
        v-if="isGroup"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
        :icon="mdiSitemapOutline"
      >
        <strong>Defaults for child campaigns.</strong> The scoring, submission
        type, eligibility rules and jury below do not apply to this group
        campaign itself; they are pre-filled into each child campaign created
        under it and can be changed there.
      </v-alert>

      <!-- Scoring System + Submission Type, side by side -->
      <v-row class="mb-4">

        <v-col cols="12" md="6">
          <DetailSection
            :title="isGroup ? 'Default Scoring System' : 'Scoring System'"
            :icon="mdiChartLine"
            fill-height
          >
            <div class="mb-3">
              <span class="text-medium-emphasis">Jury reviews per article:</span>
              <strong class="text-primary ms-1">{{ reviewsRequired }}</strong>
              <span v-if="multiReview" class="text-caption text-medium-emphasis ms-1">
                (majority decides; score is the average of agreeing reviews)
              </span>
            </div>

            <!-- Multi-parameter scoring -->
            <template v-if="scoring">
              <div class="mb-3">
                <span class="text-medium-emphasis">Max score:</span>
                <strong class="text-primary ms-1">{{ scoring.max_score }}</strong>
              </div>
              <div
                v-for="p in scoring.parameters"
                :key="p.name"
                class="mb-2"
              >
                <div class="d-flex justify-space-between align-center">
                  <span class="font-weight-medium">{{ p.name }}</span>
                  <v-chip color="primary" size="x-small" label>
                    {{ p.points }} pts
                  </v-chip>
                </div>
                <div v-if="p.description" class="text-caption text-medium-emphasis">
                  {{ p.description }}
                </div>
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                A jury awards up to each parameter's points; the final score is
                their sum (max {{ scoring.max_score }}).
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
            :title="isGroup ? 'Default Submission Type' : 'Submission Type Allowed'"
            :icon="mdiFileDocumentOutline"
            fill-height
          >
            <p class="font-weight-bold mb-3">{{ submissionTypeLabel }}</p>
            <p class="text-body-2 text-medium-emphasis font-italic mb-1">
              • <strong>New</strong> = A Wikipedia article created during the
              contest.
            </p>
            <p class="text-body-2 text-medium-emphasis font-italic">
              • <strong>Expansion</strong> = An existing article improved or
              expanded with substantial content.
            </p>
          </DetailSection>
        </v-col>
      </v-row>

      <!-- Eligibility rules -->
      <v-row
        v-if="minBytes > 0 || minRef > 0 || minWords > 0 || minImages > 0 || authorOnly"
        class="mb-4"
      >
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

        <v-col v-if="minWords > 0" cols="12" md="6">
          <DetailSection
            title="Minimum Word Count"
            :icon="mdiFormatAlignLeft"
            fill-height
          >
            <p class="font-weight-bold mb-1">{{ minWords }} words required</p>
            <p class="text-body-2 text-medium-emphasis d-flex align-center ga-1">
              <v-icon :icon="mdiInformationOutline" size="x-small" />
              Submitted articles must have at least {{ minWords }} words of
              readable prose.
            </p>
          </DetailSection>
        </v-col>

        <v-col v-if="minImages > 0" cols="12" md="6">
          <DetailSection
            title="Minimum Image Count"
            :icon="mdiImageMultiple"
            fill-height
          >
            <p class="font-weight-bold mb-1">{{ minImages }} images required</p>
            <p class="text-body-2 text-medium-emphasis d-flex align-center ga-1">
              <v-icon :icon="mdiInformationOutline" size="x-small" />
              Submitted articles must embed at least {{ minImages }} images.
            </p>
          </DetailSection>
        </v-col>

        <v-col v-if="authorOnly" cols="12" md="6">
          <DetailSection
            title="Author Only"
            :icon="mdiAccountEdit"
            fill-height
          >
            <p class="font-weight-bold mb-1">Creator submissions only</p>
            <p class="text-body-2 text-medium-emphasis d-flex align-center ga-1">
              <v-icon :icon="mdiInformationOutline" size="x-small" />
              Only the article's creator may submit it to this contest.
            </p>
          </DetailSection>
        </v-col>
      </v-row>

      <!-- Jury Members -->
      <DetailSection
        v-if="contest.jury_members?.length"
        :title="isGroup ? 'Default Jury Members' : 'Jury Members'"
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

      <!-- Child campaigns (group campaigns only) -->
      <DetailSection
        v-if="isGroup"
        title="Child Campaigns"
        :icon="mdiSitemapOutline"
      >
        <template v-if="isOrganizer" #actions>
          <v-btn
            variant="text"
            color="white"
            size="small"
            :prepend-icon="mdiPlus"
            @click="childCreateOpen = true"
          >
            New Child Campaign
          </v-btn>
          <v-btn
            variant="text"
            color="white"
            size="small"
            :prepend-icon="mdiLinkVariantPlus"
            @click="openAttach"
          >
            Attach Existing
          </v-btn>
        </template>

        <p class="text-medium-emphasis mb-4">
          This is a group campaign: articles are submitted to its child
          campaigns, and their progress is summarised here. The rules, scoring
          and jury shown above are the defaults for new child campaigns.
        </p>

        <div v-if="childrenLoading" class="d-flex justify-center py-4">
          <v-progress-circular indeterminate color="primary" size="24" />
        </div>
        <p v-else-if="children.length === 0" class="text-medium-emphasis">
          No child campaigns yet.
        </p>
        <v-table v-else density="comfortable">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Project</th>
              <th>Status</th>
              <th class="text-center">Participants</th>
              <th class="text-center">Submissions</th>
              <th class="text-center">Accepted</th>
              <th class="text-center">Rejected</th>
              <th class="text-center">Pending</th>
              <th v-if="isOrganizer" class="text-right"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in children" :key="c.id">
              <td>
                <router-link :to="`/contests/${c.id}`" class="font-weight-medium">
                  {{ c.name }}
                </router-link>
              </td>
              <td>{{ c.project_name }}</td>
              <td>
                <v-chip :color="childStatus(c).color" size="x-small" label>
                  {{ childStatus(c).label }}
                </v-chip>
              </td>
              <td class="text-center">{{ c.participant_count }}</td>
              <td class="text-center">{{ c.submission_count }}</td>
              <td class="text-center text-success">{{ c.accepted_count }}</td>
              <td class="text-center text-error">{{ c.rejected_count }}</td>
              <td class="text-center text-warning">{{ c.pending_count }}</td>
              <td v-if="isOrganizer" class="text-right">
                <v-btn
                  variant="text"
                  size="small"
                  :icon="mdiLinkVariantOff"
                  title="Detach from this group campaign"
                  @click="detach(c)"
                />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="font-weight-bold">
              <td colspan="3">Total ({{ children.length }} {{ children.length === 1 ? 'campaign' : 'campaigns' }})</td>
              <td class="text-center">{{ childTotals.participants }}</td>
              <td class="text-center">{{ childTotals.submissions }}</td>
              <td class="text-center text-success">{{ childTotals.accepted }}</td>
              <td class="text-center text-error">{{ childTotals.rejected }}</td>
              <td class="text-center text-warning">{{ childTotals.pending }}</td>
              <td v-if="isOrganizer"></td>
            </tr>
          </tfoot>
        </v-table>
      </DetailSection>

      <!-- Submissions -->
      <DetailSection
        v-if="logged && !isGroup"
        title="Submissions"
        :icon="mdiFileDocumentOutline"
      >
        <template v-if="canExport || canImport || canAddSubmission" #actions>
          <v-btn
            v-if="canAddSubmission"
            variant="text"
            color="white"
            size="small"
            density="comfortable"
            icon
            @click="addOpen = true"
          >
            <v-icon :icon="mdiAccountPlusOutline" size="18" />
            <v-tooltip activator="parent" location="bottom">
              Add a missed submission on behalf of a participant
            </v-tooltip>
          </v-btn>
          <v-btn
            v-if="canImport"
            variant="text"
            color="white"
            size="small"
            density="comfortable"
            icon
            :to="`/contests/${contest.id}/import`"
          >
            <v-icon :icon="mdiUpload" size="18" />
            <v-tooltip activator="parent" location="bottom">
              Import submissions from CSV
            </v-tooltip>
          </v-btn>
          <v-btn
            v-if="canExport"
            variant="text"
            color="white"
            size="small"
            density="comfortable"
            icon
            @click="exportCsv"
          >
            <v-icon :icon="mdiDownload" size="18" />
            <v-tooltip activator="parent" location="bottom">
              Export submissions as CSV
            </v-tooltip>
          </v-btn>
        </template>

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
                  v-for="r in reviewComments(s)"
                  :key="r.reviewer_id"
                  class="text-caption text-medium-emphasis mt-1"
                >
                  <v-icon :icon="mdiCommentQuoteOutline" size="x-small" />
                  <template v-if="multiReview">{{ r.reviewer_username }}:</template>
                  {{ r.review_comment }}
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
                <div
                  v-if="multiReview"
                  class="text-caption text-medium-emphasis mt-1"
                >
                  {{ s.review_count }}/{{ s.reviews_required }} reviews
                </div>
              </td>
              <td>{{ s.score }}</td>
              <td>{{ formatDateTime(s.submitted_at) }}</td>
              <td v-if="isJury" class="text-right">
                <v-btn
                  v-if="myReview(s)"
                  size="small"
                  variant="text"
                  color="primary"
                  :prepend-icon="mdiPencil"
                  @click="openReview(s)"
                >
                  Edit
                </v-btn>
                <v-btn
                  v-else-if="!s.already_reviewed"
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

    <ContestFormModal
      v-if="isGroup"
      v-model="childCreateOpen"
      :parent="contest"
      @saved="onChildCreated"
    />

    <v-dialog v-model="attachOpen" max-width="520">
      <v-card>
        <v-card-title class="font-weight-bold">Attach an existing campaign</v-card-title>
        <v-card-text>
          <p class="text-medium-emphasis mb-4">
            Standalone contests you organize can be attached as child campaigns
            of {{ contest?.name }}. Their settings and submissions are unchanged.
          </p>
          <v-select
            v-model="attachTarget"
            :items="attachCandidates"
            item-title="name"
            item-value="id"
            label="Contest"
            variant="outlined"
            density="comfortable"
            :no-data-text="'No standalone contests you organize'"
          />
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="tonal" @click="attachOpen = false">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="attaching"
            :disabled="!attachTarget"
            @click="attach"
          >
            Attach
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <SubmitArticleModal
      v-if="contest"
      v-model="submitOpen"
      :contest-id="contest.id"
      @submitted="onSubmitted"
      @updated="onUpdated"
    />

    <ReviewSubmissionModal
      v-if="reviewTarget"
      v-model="reviewOpen"
      :submission="reviewTarget"
      :contest="contest"
      @reviewed="onReviewed"
    />

    <AddSubmissionModal
      v-if="canAddSubmission && contest"
      v-model="addOpen"
      :contest-id="contest.id"
      @added="onSubmissionAdded"
    />

    <v-snackbar v-model="toast.show" :color="toast.color" timeout="4000">
      {{ toast.text }}
    </v-snackbar>
  </v-container>
</template>
