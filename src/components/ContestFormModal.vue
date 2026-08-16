<script setup>
import { ref, computed, watch } from 'vue'
import { mdiPlus, mdiPencil, mdiClose, mdiContentSave } from '@mdi/js'
import { createContest, updateContest } from '../api/contests'
import {
  browserTimeZone,
  canonicalZone,
  timezoneList,
  utcIsoToZoned,
  zonedToUtcIso,
} from '../utils/timezone'
import UserAutocomplete from './UserAutocomplete.vue'

const timezones = timezoneList()

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  // null → create mode; a contest object → edit mode.
  contest: { type: Object, default: null },
})
const emit = defineEmits(['saved'])

const isEdit = computed(() => !!props.contest)
// Once a contest is active its config is locked; only organizers/jury editable.
const locked = computed(() => isEdit.value && props.contest.status !== 'pending')

const DEFAULT_PARAMS = [
  { name: 'Quality', points: 4, description: 'Article structure & content quality' },
  { name: 'Sources', points: 3, description: 'References & citations' },
  { name: 'Neutrality', points: 2, description: 'Unbiased writing' },
  { name: 'Formatting', points: 1, description: 'Presentation & formatting' },
]

const blankForm = () => ({
  name: '',
  project_name: '',
  description: '',
  allowed_submission_type: 'both',
  // Dates/times are entered as wall-clock in `timezone`; converted to a UTC
  // instant on submit. Defaults: start at 00:00, end at 23:59 of the chosen day.
  timezone: browserTimeZone(),
  start_date: '',
  start_time: '00:00',
  end_date: '',
  end_time: '23:59',
  marks_setting_accepted: 10,
  marks_setting_rejected: 0,
  parameters: DEFAULT_PARAMS.map((p) => ({ ...p })),
  organizers: [],
  jury_members: [],
  min_byte_count: 0,
  min_reference_count: 0,
  min_word_count: 0,
  project_link: '',
})

function fromContest(c) {
  const rules = c.rules && typeof c.rules === 'object' ? c.rules : {}
  const sp =
    c.scoring_parameters && typeof c.scoring_parameters === 'object'
      ? c.scoring_parameters
      : {}
  // Canonicalize so an older contest stored as e.g. Asia/Calcutta shows and
  // re-saves as Asia/Kolkata (same instant, modern name).
  const tz = canonicalZone(c.timezone) || browserTimeZone()
  const start = utcIsoToZoned(c.start_date, tz)
  const end = utcIsoToZoned(c.end_date, tz)
  return {
    ...blankForm(),
    name: c.name || '',
    project_name: c.project_name || '',
    description: c.description || '',
    allowed_submission_type: rules.allowed_submission_type || 'both',
    timezone: tz,
    start_date: start.date,
    start_time: start.time || '00:00',
    end_date: end.date,
    end_time: end.time || '23:59',
    marks_setting_accepted: c.marks_setting_accepted ?? 10,
    marks_setting_rejected: c.marks_setting_rejected ?? 0,
    parameters: sp.parameters?.length
      ? sp.parameters.map((p) => ({
          name: p.name,
          points: p.points ?? 0,
          description: p.description || '',
        }))
      : DEFAULT_PARAMS.map((p) => ({ ...p })),
    organizers: [...(c.organizers || [])],
    jury_members: [...(c.jury_members || [])],
    min_byte_count: rules.min_byte_count ?? 0,
    min_reference_count: rules.min_reference_count ?? 0,
    min_word_count: rules.min_word_count ?? 0,
    project_link: c.project_link || '',
  }
}

const form = ref(blankForm())
const scoringMode = ref('simple') // 'simple' | 'multi_parameter'
const loading = ref(false)
const error = ref('')

const submissionTypes = [
  { title: 'New Articles Only', value: 'new' },
  { title: 'Improved Articles Only', value: 'expansion' },
  { title: 'Both (New + Improved Articles)', value: 'both' },
]
const scoringModes = [
  { label: 'Simple Scoring', value: 'simple' },
  { label: 'Multi-Parameter Scoring', value: 'multi_parameter' },
]

// Max score is the sum of the parameters' point allocations.
const totalPoints = computed(() =>
  form.value.parameters.reduce((sum, p) => sum + (Number(p.points) || 0), 0),
)

function addParameter() {
  form.value.parameters.push({ name: '', points: 0, description: '' })
}
function removeParameter(index) {
  if (form.value.parameters.length > 1) form.value.parameters.splice(index, 1)
}
function loadDefaults() {
  form.value.parameters = DEFAULT_PARAMS.map((p) => ({ ...p }))
}

const valid = computed(() => {
  if (locked.value) return true // only organizers/jury, always acceptable
  const f = form.value
  if (!(f.name.trim() && f.project_name.trim() && f.start_date)) return false
  if (scoringMode.value === 'multi_parameter') {
    return (
      totalPoints.value > 0 &&
      f.parameters.every((p) => p.name.trim() && Number(p.points) > 0)
    )
  }
  return (
    Number(f.marks_setting_accepted) > 0 && Number(f.marks_setting_rejected) <= 0
  )
})

watch(open, (isOpen) => {
  if (isOpen) {
    form.value = isEdit.value ? fromContest(props.contest) : blankForm()
    scoringMode.value =
      isEdit.value && props.contest.scoring_parameters?.enabled
        ? 'multi_parameter'
        : 'simple'
    error.value = ''
    loading.value = false
  }
})

function buildPayload() {
  const f = form.value
  // When locked, only organizers/jury may change.
  if (locked.value) {
    return { organizers: f.organizers, jury_members: f.jury_members }
  }
  // Convert the organizer's local wall-clock date/time to a UTC instant. The
  // start begins at :00 of its minute; the end is pushed to :59 seconds so the
  // whole final minute is included (the time picker only captures minutes).
  const startIso = zonedToUtcIso(f.start_date, f.start_time, f.timezone)
  let endIso = f.end_date
    ? zonedToUtcIso(f.end_date, f.end_time, f.timezone)
    : null
  if (endIso) endIso = new Date(new Date(endIso).getTime() + 59_000).toISOString()

  const payload = {
    name: f.name.trim(),
    project_name: f.project_name.trim(),
    timezone: f.timezone,
    start_date: startIso,
    organizers: f.organizers,
    jury_members: f.jury_members,
    rules: {
      allowed_submission_type: f.allowed_submission_type,
      min_byte_count: f.min_byte_count,
      min_reference_count: f.min_reference_count,
      min_word_count: f.min_word_count,
    },
    end_date: endIso,
    description: f.description.trim() || null,
    project_link: f.project_link.trim() || null,
  }
  if (scoringMode.value === 'multi_parameter') {
    // Max score is the sum of parameter points; rejected submissions score 0.
    payload.marks_setting_accepted = totalPoints.value
    payload.marks_setting_rejected = 0
    payload.scoring_parameters = {
      enabled: true,
      max_score: totalPoints.value,
      parameters: f.parameters.map((p) => ({
        name: p.name.trim(),
        points: Number(p.points) || 0,
        description: p.description?.trim() || '',
      })),
    }
  } else {
    payload.marks_setting_accepted = f.marks_setting_accepted
    payload.marks_setting_rejected = f.marks_setting_rejected
    payload.scoring_parameters = null // clear if switching away from multi
  }
  return payload
}

async function submit() {
  if (!valid.value) return
  loading.value = true
  error.value = ''
  try {
    const payload = buildPayload()
    const contest = isEdit.value
      ? await updateContest(props.contest.id, payload)
      : await createContest(payload)
    emit('saved', contest)
    open.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="860" scrollable>
    <v-card>
      <v-toolbar color="primary" density="comfortable">
        <v-icon :icon="isEdit ? mdiPencil : mdiPlus" class="ms-4" />
        <v-toolbar-title class="font-weight-bold">
          {{ isEdit ? 'Edit Contest' : 'Create Contest' }}
        </v-toolbar-title>
        <v-btn :icon="mdiClose" variant="text" @click="open = false" />
      </v-toolbar>

      <v-card-text class="pa-6">
        <v-alert v-if="locked" type="info" variant="tonal" class="mb-4">
          This contest has started, so its configuration is locked. Only
          organizers and jury members can be changed.
        </v-alert>

        <!-- Config fields (editable only while pending) -->
        <template v-if="!locked">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.name"
                label="Contest Name *"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.project_name"
                label="Project Name *"
                placeholder="e.g. commons, en.wikipedia"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>

          <v-textarea
            v-model="form.description"
            label="Description"
            variant="outlined"
            rows="2"
            auto-grow
          />

          <v-select
            v-model="form.allowed_submission_type"
            :items="submissionTypes"
            label="Allowed Submission Type"
            variant="outlined"
            density="comfortable"
          />

          <v-autocomplete
            v-model="form.timezone"
            :items="timezones"
            label="Contest Timezone *"
            variant="outlined"
            density="comfortable"
            hint="Start/end times below are in this timezone. Everyone sees the same deadline."
            persistent-hint
            class="mb-2"
          />

          <v-row>
            <v-col cols="8" md="8">
              <v-text-field
                v-model="form.start_date"
                label="Start Date *"
                type="date"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="4" md="4">
              <v-text-field
                v-model="form.start_time"
                label="Start Time"
                type="time"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="8" md="8">
              <v-text-field
                v-model="form.end_date"
                label="End Date"
                type="date"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="4" md="4">
              <v-text-field
                v-model="form.end_time"
                label="End Time"
                type="time"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>

          <!-- Scoring -->
          <v-card variant="outlined" class="mb-4">
            <v-card-text>
              <div class="text-subtitle-1 font-weight-bold">
                Scoring System Configuration
              </div>
              <div class="text-caption text-medium-emphasis mb-2">
                Choose how submissions will be scored.
              </div>

              <v-radio-group
                v-model="scoringMode"
                inline
                hide-details
                class="mb-2"
              >
                <v-radio
                  v-for="mode in scoringModes"
                  :key="mode.value"
                  :label="mode.label"
                  :value="mode.value"
                />
              </v-radio-group>

              <!-- Simple -->
              <v-row v-if="scoringMode === 'simple'">
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.marks_setting_accepted"
                    label="Points for Accepted"
                    type="number"
                    min="1"
                    variant="outlined"
                    density="comfortable"
                    hint="Must be a positive number."
                    persistent-hint
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.marks_setting_rejected"
                    label="Points for Rejected"
                    type="number"
                    max="0"
                    variant="outlined"
                    density="comfortable"
                    hint="Zero or negative."
                    persistent-hint
                  />
                </v-col>
              </v-row>

              <!-- Multi-parameter -->
              <template v-else>
                <div class="text-caption text-medium-emphasis mb-3">
                  Allocate points to each parameter. The maximum score is their
                  total; a jury awards up to that many points per parameter.
                </div>

                <div
                  class="d-flex align-center justify-space-between mt-2 mb-2"
                >
                  <span class="text-subtitle-2 font-weight-medium">
                    Parameters
                  </span>
                  <v-chip color="primary" size="small" label>
                    Maximum score: {{ totalPoints }}
                  </v-chip>
                </div>

                <div
                  v-for="(param, i) in form.parameters"
                  :key="i"
                  class="d-flex ga-2 mb-2 align-center"
                >
                  <v-text-field
                    v-model="param.name"
                    label="Name"
                    variant="outlined"
                    density="compact"
                    hide-details
                    style="max-width: 180px"
                  />
                  <v-text-field
                    v-model.number="param.points"
                    label="Points"
                    type="number"
                    min="1"
                    variant="outlined"
                    density="compact"
                    hide-details
                    style="max-width: 110px"
                  />
                  <v-text-field
                    v-model="param.description"
                    label="Description"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                  <v-btn
                    :icon="mdiClose"
                    variant="text"
                    size="small"
                    :disabled="form.parameters.length <= 1"
                    @click="removeParameter(i)"
                  />
                </div>

                <div class="d-flex ga-2">
                  <v-btn
                    size="small"
                    variant="text"
                    color="primary"
                    :prepend-icon="mdiPlus"
                    @click="addParameter"
                  >
                    Add Parameter
                  </v-btn>
                  <v-btn size="small" variant="text" @click="loadDefaults">
                    Load Defaults
                  </v-btn>
                </div>
              </template>
            </v-card-text>
          </v-card>
        </template>

        <!-- Organizers (always editable by an organizer) -->
        <UserAutocomplete
          v-model="form.organizers"
          label="Organizers"
          hint="You are automatically added as an organizer. Add others who should manage this contest."
          class="mb-4"
        />

        <!-- Jury (always editable by an organizer) -->
        <UserAutocomplete
          v-model="form.jury_members"
          label="Jury Members"
          class="mb-2"
        />

        <template v-if="!locked">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="form.min_byte_count"
                label="Minimum Byte Count"
                type="number"
                min="0"
                placeholder="e.g. 1000"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="form.min_reference_count"
                label="Minimum Reference Count"
                type="number"
                min="0"
                placeholder="e.g. 5"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="form.min_word_count"
                label="Minimum Word Count"
                type="number"
                min="0"
                placeholder="e.g. 300"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>

          <v-text-field
            v-model="form.project_link"
            label="Project Link (optional)"
            placeholder="https://en.wikipedia.org/wiki/Wikipedia:WikiProject_..."
            type="url"
            variant="outlined"
            density="comfortable"
            hint="Link this contest to its project or campaign page."
            persistent-hint
          />
        </template>

        <v-alert v-if="error" type="error" variant="tonal" class="mt-4">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="tonal" @click="open = false">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :prepend-icon="mdiContentSave"
          :loading="loading"
          :disabled="!valid"
          @click="submit"
        >
          {{ isEdit ? 'Save Changes' : 'Create Contest' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
