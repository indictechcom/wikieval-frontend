<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { mdiAccountPlus, mdiClockOutline, mdiPlus } from '@mdi/js'
import { listContests } from '../api/contests'
import { getMyRequest } from '../api/contestCreationRequests'
import { useAuth } from '../composables/useAuth'
import RequestRightsModal from '../components/RequestRightsModal.vue'
import ContestFormModal from '../components/ContestFormModal.vue'
import ContestCard from '../components/ContestCard.vue'

const { logged, canCreateContest, isSuperadmin } = useAuth()

const contests = ref([])
const loading = ref(true)
const error = ref('')
const tab = ref('current')

// Rights come from GET /api/user (canCreateContest); the request status (for
// the "pending" chip) comes from GET /api/contest-creation-request.
const requestStatus = ref(null) // null | 'pending' | 'approved' | 'rejected'
const rejectionReason = ref('')
const modalOpen = ref(false)
const createOpen = ref(false)
const snackbar = ref({ show: false, text: '', color: 'success' })

// Split contests into Current / Upcoming / Past by their date range.
function toDate(value) {
  return value ? new Date(value) : null
}
const buckets = computed(() => {
  const now = new Date()
  const result = { current: [], upcoming: [], past: [] }
  for (const contest of contests.value) {
    const start = toDate(contest.start_date)
    const end = toDate(contest.end_date)
    if (start && start > now) result.upcoming.push(contest)
    else if (end && end < now) result.past.push(contest)
    else result.current.push(contest)
  }
  return result
})
const visible = computed(() => buckets.value[tab.value] || [])

// Superadmins and rights-holders can create contests directly.
const showCreateBtn = computed(
  () => logged.value && (canCreateContest.value || isSuperadmin.value),
)
const showRequestBtn = computed(
  () =>
    logged.value &&
    !showCreateBtn.value &&
    (!requestStatus.value || requestStatus.value === 'rejected'),
)
const showPending = computed(
  () => logged.value && !showCreateBtn.value && requestStatus.value === 'pending',
)

async function loadRights() {
  try {
    const data = await getMyRequest()
    requestStatus.value = data.request?.status ?? null
    rejectionReason.value = data.request?.rejection_reason ?? ''
  } catch {
    // Not logged in / no request info — leave defaults.
  }
}

function onRequested(request) {
  requestStatus.value = request?.status ?? 'pending'
  loadRights()
  snackbar.value = {
    show: true,
    text: 'Request submitted. A superadmin will review it.',
    color: 'success',
  }
}

function onCreated(contest) {
  contests.value = [contest, ...contests.value]
  snackbar.value = {
    show: true,
    text: 'Contest created successfully.',
    color: 'success',
  }
}

// Load rights once auth state resolves (getMyRequest needs a session).
watch(logged, (isLogged) => isLogged && loadRights(), { immediate: true })

onMounted(async () => {
  try {
    contests.value = await listContests()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
      <h1 class="text-h4 font-weight-bold">Contests</h1>

      <v-btn
        v-if="showCreateBtn"
        color="primary"
        variant="flat"
        :prepend-icon="mdiPlus"
        @click="createOpen = true"
      >
        Create Contest
      </v-btn>
      <v-btn
        v-else-if="showRequestBtn"
        color="grey-darken-1"
        variant="flat"
        :prepend-icon="mdiAccountPlus"
        @click="modalOpen = true"
      >
        Request Contest Creator Rights
      </v-btn>
      <v-chip
        v-else-if="showPending"
        color="warning"
        variant="flat"
        size="large"
        :prepend-icon="mdiClockOutline"
      >
        Contest Right Request Pending
      </v-chip>
    </div>

    <v-alert
      v-if="requestStatus === 'rejected'"
      type="warning"
      variant="tonal"
      class="mb-6"
    >
      Your contest-creation request was rejected<span v-if="rejectionReason">:
        {{ rejectionReason }}</span>. You can submit a new request.
    </v-alert>

    <v-tabs v-model="tab" color="primary" class="mb-6">
      <v-tab value="current">Current</v-tab>
      <v-tab value="upcoming">Upcoming</v-tab>
      <v-tab value="past">Past</v-tab>
    </v-tabs>

    <div v-if="loading" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-alert v-else-if="error" type="error" variant="tonal">
      {{ error }}
    </v-alert>

    <v-alert v-else-if="visible.length === 0" type="info" variant="tonal">
      No {{ tab }} contests available.
    </v-alert>

    <div v-else>
      <ContestCard
        v-for="contest in visible"
        :key="contest.id"
        :contest="contest"
      />
    </div>

    <RequestRightsModal v-model="modalOpen" @submitted="onRequested" />
    <ContestFormModal v-model="createOpen" @saved="onCreated" />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>
