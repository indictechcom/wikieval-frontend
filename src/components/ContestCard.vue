<script setup>
import { computed } from 'vue'
import {
  mdiBriefcaseOutline,
  mdiCalendarRange,
  mdiFileDocumentOutline,
} from '@mdi/js'
import { contestStatus } from '../utils/contestStatus'

const props = defineProps({
  contest: { type: Object, required: true },
})

const status = computed(() => contestStatus(props.contest))
const submissionCount = computed(() => props.contest.submission_count ?? 0)

// Contest window dates: shown in the contest's own timezone (day only).
const dateInZone = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: props.contest.timezone || 'UTC',
  }).format(new Date(value))

// The created-at metadata timestamp is shown in UTC (not a contest-window date).
const dateUTC = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))

const dateRange = computed(() => {
  const { start_date, end_date } = props.contest
  if (start_date && end_date)
    return `${dateInZone(start_date)} – ${dateInZone(end_date)}`
  if (start_date) return `Starts ${dateInZone(start_date)}`
  if (end_date) return `Ends ${dateInZone(end_date)}`
  return ''
})
</script>

<template>
  <v-card :to="`/contests/${contest.id}`" hover border flat class="mb-3">
    <v-card-item>
      <div class="d-flex justify-space-between align-start ga-3">
        <v-card-title class="text-primary text-wrap pa-0">
          {{ contest.name }}
        </v-card-title>
        <span
          v-if="contest.created_at"
          class="text-caption text-medium-emphasis flex-shrink-0"
        >
          {{ dateUTC(contest.created_at) }}
        </span>
      </div>

      <div class="d-flex flex-wrap align-center ga-2 mt-3">
        <v-chip
          :color="status.color"
          :prepend-icon="status.icon"
          size="small"
          variant="tonal"
        >
          {{ status.label }}
        </v-chip>

        <v-chip
          :prepend-icon="mdiBriefcaseOutline"
          size="small"
          variant="tonal"
          color="blue"
        >
          {{ contest.project_name }}
        </v-chip>

        <v-chip
          :prepend-icon="mdiFileDocumentOutline"
          size="small"
          variant="tonal"
          color="teal"
        >
          {{ submissionCount }}
          {{ submissionCount === 1 ? 'submission' : 'submissions' }}
        </v-chip>

        <v-chip
          v-if="dateRange"
          :prepend-icon="mdiCalendarRange"
          size="small"
          variant="tonal"
          color="deep-orange"
        >
          {{ dateRange }}
        </v-chip>
      </div>
    </v-card-item>
  </v-card>
</template>
