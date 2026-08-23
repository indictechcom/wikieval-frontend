<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  mdiArrowLeft,
  mdiFileDelimited,
  mdiUpload,
  mdiRefresh,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiClockOutline,
} from '@mdi/js'
import { getContest } from '../api/contests'
import { importSubmission } from '../api/submissions'
import { parseSubmissionsCsv } from '../utils/csv'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const { isSuperadmin, loading: authLoading } = useAuth()

const contest = ref(null)
const loadError = ref('')

// Import rows: { articleLink, username, state, error }
// state: 'queued' | 'importing' | 'done' | 'failed'
const rows = ref([])
const file = ref(null)
const parseError = ref('')
const running = ref(false)

const CONCURRENCY = 4 // small pool: fast, but gentle on the MediaWiki API

const counts = computed(() => {
  const c = { queued: 0, importing: 0, done: 0, failed: 0 }
  for (const r of rows.value) c[r.state]++
  return c
})
const total = computed(() => rows.value.length)
const finishedCount = computed(() => counts.value.done + counts.value.failed)
const progress = computed(() =>
  total.value ? Math.round((finishedCount.value / total.value) * 100) : 0,
)
const hasFailed = computed(() => counts.value.failed > 0)
const canStart = computed(
  () => !running.value && counts.value.queued > 0,
)

async function loadContest(id) {
  loadError.value = ''
  try {
    contest.value = await getContest(id)
  } catch (e) {
    loadError.value = e.message
  }
}
watch(() => route.params.id, (id) => loadContest(id), { immediate: true })

function onFile(files) {
  parseError.value = ''
  rows.value = []
  const f = Array.isArray(files) ? files[0] : files
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      rows.value = parseSubmissionsCsv(String(reader.result)).map((r) => ({
        ...r,
        state: 'queued',
        error: '',
      }))
    } catch (e) {
      parseError.value = e.message
    }
  }
  reader.onerror = () => {
    parseError.value = 'Could not read the file.'
  }
  reader.readAsText(f)
}

async function importRow(row) {
  row.state = 'importing'
  row.error = ''
  try {
    await importSubmission(route.params.id, {
      articleLink: row.articleLink,
      username: row.username,
    })
    row.state = 'done'
  } catch (e) {
    row.state = 'failed'
    row.error = e.message
  }
}

// Process a set of rows through a small concurrency pool.
async function runPool(targets) {
  running.value = true
  let cursor = 0
  const worker = async () => {
    while (cursor < targets.length) {
      const row = targets[cursor++]
      await importRow(row)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker),
  )
  running.value = false
}

function startImport() {
  runPool(rows.value.filter((r) => r.state === 'queued'))
}

function retryFailed() {
  const failed = rows.value.filter((r) => r.state === 'failed')
  failed.forEach((r) => {
    r.state = 'queued'
    r.error = ''
  })
  runPool(failed)
}

const stateMeta = {
  queued: { color: 'grey', icon: mdiClockOutline, label: 'Queued' },
  importing: { color: 'info', icon: mdiUpload, label: 'Importing' },
  done: { color: 'success', icon: mdiCheckCircle, label: 'Imported' },
  failed: { color: 'error', icon: mdiAlertCircle, label: 'Failed' },
}
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

    <!-- Access control -->
    <v-alert v-if="!authLoading && !isSuperadmin" type="error" variant="tonal">
      Importing submissions is restricted to superadmins.
    </v-alert>

    <template v-else>
      <div class="d-flex align-center ga-3 mb-2">
        <v-icon :icon="mdiFileDelimited" size="large" color="primary" />
        <h1 class="text-h4 font-weight-bold">Import Submissions</h1>
      </div>
      <p class="text-body-2 text-medium-emphasis mb-6">
        {{ contest?.name }} — upload a CSV exported from a contest. Each row is
        restored as a <strong>pending</strong> submission for its original
        submitter (the “By” column). Jury reviews are not restored, and article
        details are re-fetched from Wikipedia.
      </p>

      <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4">
        {{ loadError }}
      </v-alert>

      <!-- Step 1: file -->
      <v-card variant="outlined" class="mb-4">
        <v-card-text>
          <v-file-input
            v-model="file"
            accept=".csv,text/csv"
            label="Submissions CSV"
            :prepend-icon="mdiFileDelimited"
            variant="outlined"
            density="comfortable"
            hide-details
            show-size
            :disabled="running"
            @update:model-value="onFile"
          />
          <v-alert
            v-if="parseError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{ parseError }}
          </v-alert>
        </v-card-text>
      </v-card>

      <!-- Step 2: summary + actions -->
      <template v-if="total">
        <div
          class="d-flex flex-wrap align-center ga-2 mb-3"
        >
          <v-chip variant="tonal" color="grey">{{ total }} total</v-chip>
          <v-chip variant="tonal" color="success">
            {{ counts.done }} imported
          </v-chip>
          <v-chip variant="tonal" color="error">
            {{ counts.failed }} failed
          </v-chip>
          <v-chip v-if="counts.queued" variant="tonal" color="grey-darken-1">
            {{ counts.queued }} queued
          </v-chip>
          <v-spacer />
          <v-btn
            v-if="hasFailed && !running"
            variant="tonal"
            color="warning"
            :prepend-icon="mdiRefresh"
            @click="retryFailed"
          >
            Retry Failed ({{ counts.failed }})
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :prepend-icon="mdiUpload"
            :loading="running"
            :disabled="!canStart"
            @click="startImport"
          >
            {{ counts.done || counts.failed ? 'Import Queued' : 'Import All' }}
          </v-btn>
        </div>

        <v-progress-linear
          v-if="running || finishedCount"
          :model-value="progress"
          color="primary"
          height="18"
          rounded
          class="mb-4"
        >
          <span class="text-caption">{{ progress }}%</span>
        </v-progress-linear>

        <!-- Row table -->
        <v-table density="comfortable">
          <thead>
            <tr>
              <th style="width: 48px">#</th>
              <th>Article</th>
              <th>By</th>
              <th style="width: 130px">Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i">
              <td class="text-medium-emphasis">{{ i + 1 }}</td>
              <td class="text-truncate" style="max-width: 320px">
                <a :href="r.articleLink" target="_blank" rel="noopener noreferrer">
                  {{ r.articleLink }}
                </a>
              </td>
              <td>{{ r.username }}</td>
              <td>
                <v-chip
                  :color="stateMeta[r.state].color"
                  :prepend-icon="stateMeta[r.state].icon"
                  size="small"
                  variant="tonal"
                >
                  {{ stateMeta[r.state].label }}
                </v-chip>
              </td>
              <td class="text-caption text-error">{{ r.error }}</td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </template>
  </v-container>
</template>
