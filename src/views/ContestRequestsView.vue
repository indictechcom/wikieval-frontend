<script setup>
import { ref, computed, watch } from 'vue'
import {
  mdiCheck,
  mdiClose,
  mdiShieldAccountOutline,
  mdiOpenInNew,
} from '@mdi/js'
import { listRequests, reviewRequest } from '../api/contestCreationRequests'
import { useAuth } from '../composables/useAuth'

const { isSuperadmin, logged, loading: authLoading } = useAuth()

const requests = ref([])
const loading = ref(true)
const error = ref('')
const tab = ref('pending')
const processing = ref(new Set())
const snackbar = ref({ show: false, text: '', color: 'success' })

// Reject dialog state.
const rejectDialog = ref(false)
const rejectTarget = ref(null)
const rejectReason = ref('')

const pending = computed(() =>
  requests.value.filter((r) => r.status === 'pending'),
)
const visible = computed(() =>
  tab.value === 'pending' ? pending.value : requests.value,
)

const statusColor = (status) =>
  ({ approved: 'success', rejected: 'error', pending: 'warning' })[status] ||
  'grey'

// Global account overview on Meta-Wiki, for vetting the requester.
const centralAuthUrl = (username) =>
  `https://meta.wikimedia.org/wiki/Special:CentralAuth/${encodeURIComponent(username)}`

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    requests.value = await listRequests()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function replaceRequest(updated) {
  const i = requests.value.findIndex((r) => r.id === updated.id)
  if (i !== -1) requests.value[i] = updated
}

async function approve(request) {
  processing.value.add(request.id)
  try {
    const updated = await reviewRequest(request.id, 'approve')
    replaceRequest(updated)
    snackbar.value = {
      show: true,
      text: `Approved ${request.username}'s request.`,
      color: 'success',
    }
  } catch (e) {
    snackbar.value = { show: true, text: e.message, color: 'error' }
  } finally {
    processing.value.delete(request.id)
  }
}

function openReject(request) {
  rejectTarget.value = request
  rejectReason.value = ''
  rejectDialog.value = true
}

async function confirmReject() {
  const request = rejectTarget.value
  processing.value.add(request.id)
  rejectDialog.value = false
  try {
    const updated = await reviewRequest(request.id, 'reject', rejectReason.value.trim())
    replaceRequest(updated)
    snackbar.value = {
      show: true,
      text: `Rejected ${request.username}'s request.`,
      color: 'success',
    }
  } catch (e) {
    snackbar.value = { show: true, text: e.message, color: 'error' }
  } finally {
    processing.value.delete(request.id)
  }
}

// Load once auth resolves and confirms superadmin.
watch(
  isSuperadmin,
  (isAdmin) => isAdmin && load(),
  { immediate: true },
)
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center ga-2 mb-6">
      <v-icon :icon="mdiShieldAccountOutline" size="large" color="primary" />
      <h1 class="text-h4 font-weight-bold">Contest Creation Requests</h1>
    </div>

    <!-- Not a superadmin -->
    <v-alert
      v-if="!authLoading && logged && !isSuperadmin"
      type="error"
      variant="tonal"
    >
      Superadmin rights are required to view this page.
    </v-alert>

    <template v-else>
      <v-tabs v-model="tab" color="primary" class="mb-6">
        <v-tab value="pending">
          Pending
          <v-chip
            v-if="pending.length"
            color="warning"
            size="x-small"
            class="ms-2"
          >
            {{ pending.length }}
          </v-chip>
        </v-tab>
        <v-tab value="all">All</v-tab>
      </v-tabs>

      <div v-if="loading" class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <v-alert v-else-if="error" type="error" variant="tonal">
        {{ error }}
      </v-alert>

      <v-alert v-else-if="visible.length === 0" type="info" variant="tonal">
        No {{ tab === 'pending' ? 'pending' : '' }} requests.
      </v-alert>

      <v-card v-else variant="outlined">
        <v-table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Details</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Requested</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in visible" :key="request.id">
              <td class="font-weight-medium">{{ request.username }}</td>
              <td>
                <v-btn
                  :href="centralAuthUrl(request.username)"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="text"
                  size="small"
                  color="primary"
                  :append-icon="mdiOpenInNew"
                >
                  CentralAuth
                </v-btn>
              </td>
              <td style="max-width: 360px">{{ request.reason }}</td>
              <td>
                <v-chip :color="statusColor(request.status)" size="small" label>
                  {{ request.status }}
                </v-chip>
                <div
                  v-if="request.status === 'rejected' && request.rejection_reason"
                  class="text-caption text-medium-emphasis mt-1"
                >
                  {{ request.rejection_reason }}
                </div>
              </td>
              <td>{{ formatDate(request.created_at) }}</td>
              <td class="text-right">
                <template v-if="request.status === 'pending'">
                  <v-btn
                    color="success"
                    variant="tonal"
                    size="small"
                    class="me-2"
                    :prepend-icon="mdiCheck"
                    :loading="processing.has(request.id)"
                    @click="approve(request)"
                  >
                    Approve
                  </v-btn>
                  <v-btn
                    color="error"
                    variant="tonal"
                    size="small"
                    :prepend-icon="mdiClose"
                    :disabled="processing.has(request.id)"
                    @click="openReject(request)"
                  >
                    Reject
                  </v-btn>
                </template>
                <span v-else class="text-medium-emphasis text-caption">
                  Reviewed {{ formatDate(request.reviewed_at) }}
                </span>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </template>

    <!-- Reject reason dialog -->
    <v-dialog v-model="rejectDialog" max-width="520">
      <v-card>
        <v-card-title class="text-h6">Reject request</v-card-title>
        <v-card-text>
          <p class="mb-4 text-medium-emphasis">
            Provide a reason for rejecting
            <strong>{{ rejectTarget?.username }}</strong>'s request.
          </p>
          <v-textarea
            v-model="rejectReason"
            label="Rejection reason"
            variant="outlined"
            rows="3"
            auto-grow
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="tonal" @click="rejectDialog = false">Cancel</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :disabled="!rejectReason.trim()"
            @click="confirmReject"
          >
            Reject
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>
