<script setup>
import { computed } from 'vue'
import { mdiBriefcaseOutline, mdiCalendarRange, mdiCircle } from '@mdi/js'
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
  <v-card
    :to="`/contests/${contest.id}`"
    hover
    flat
    border
    rounded="lg"
    class="contest-card h-100 d-flex flex-column"
  >
    <v-card-item class="pb-3">
      <v-card-title
        class="text-primary text-wrap pa-0 text-h6 font-weight-bold"
        style="line-height: 1.3"
      >
        {{ contest.name }}
      </v-card-title>
      <div class="d-flex align-center ga-2 mt-2">
        <v-icon :icon="mdiCircle" :color="status.color" size="10" />
        <span
          class="text-body-2 font-weight-medium"
          :class="`text-${status.color}`"
        >
          {{ status.label }}
        </span>
      </div>
    </v-card-item>

    <v-divider />

    <div
      class="d-flex align-center justify-space-between ga-4 px-4 py-4 flex-grow-1"
    >
      <div class="text-center flex-shrink-0">
        <div class="text-h4 font-weight-bold">{{ submissionCount }}</div>
        <div
          class="text-caption text-medium-emphasis text-uppercase"
          style="letter-spacing: 0.5px"
        >
          {{ submissionCount === 1 ? 'submission' : 'submissions' }}
        </div>
      </div>

      <div class="text-body-2 text-medium-emphasis text-end">
        <div class="d-flex align-center justify-end ga-1">
          <v-icon :icon="mdiBriefcaseOutline" size="16" />
          {{ contest.project_name }}
        </div>
        <div
          v-if="dateRange"
          class="d-flex align-center justify-end ga-1 mt-1"
        >
          <v-icon :icon="mdiCalendarRange" size="16" />
          {{ dateRange }}
        </div>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.contest-card {
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}
.contest-card:hover {
  transform: translateY(-2px);
}
</style>
