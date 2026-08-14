<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mdiArrowLeft, mdiTrophy } from '@mdi/js'
import { getContest, getLeaderboard } from '../api/contests'

const route = useRoute()

const contest = ref(null)
const rows = ref([])
const loading = ref(true)
const error = ref('')

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
  try {
    const [c, board] = await Promise.all([getContest(id), getLeaderboard(id)])
    contest.value = c
    rows.value = board
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
        <v-data-table
          :headers="headers"
          :items="rows"
          :items-per-page="-1"
          :sort-by="[{ key: 'username', order: 'asc' }]"
          hide-default-footer
          density="comfortable"
        >
          <template #item.username="{ item }">
            <span class="font-weight-medium">{{ item.username }}</span>
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
