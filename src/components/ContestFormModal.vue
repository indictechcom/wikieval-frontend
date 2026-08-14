<script setup>
import { ref, computed, watch } from 'vue'
import { mdiPlus, mdiPencil, mdiClose, mdiContentSave } from '@mdi/js'
import { createContest, updateContest } from '../api/contests'
import UserAutocomplete from './UserAutocomplete.vue'

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
  { name: 'Quality', weight: 40, description: 'Article structure & content quality' },
  { name: 'Sources', weight: 30, description: 'References & citations' },
  { name: 'Neutrality', weight: 20, description: 'Unbiased writing' },
  { name: 'Formatting', weight: 10, description: 'Presentation & formatting' },
]

const blankForm = () => ({
  name: '',
  project_name: '',
  description: '',
  allowed_submission_type: 'both',
  start_date: '',
  end_date: '',
  marks_setting_accepted: 10,
  marks_setting_rejected: 0,
  max_score: 100,
  min_score: 0,
  parameters: DEFAULT_PARAMS.map((p) => ({ ...p })),
  organizers: [],
  jury_members: [],
  min_byte_count: 0,
  min_reference_count: 0,
  outreach_dashboard_url: '',
})

function fromContest(c) {
  const rules = c.rules && typeof c.rules === 'object' ? c.rules : {}
  const sp =
    c.scoring_parameters && typeof c.scoring_parameters === 'object'
      ? c.scoring_parameters
      : {}
  return {
    ...blankForm(),
    name: c.name || '',
    project_name: c.project_name || '',
    description: c.description || '',
    allowed_submission_type: rules.allowed_submission_type || 'both',
    start_date: c.start_date || '',
    end_date: c.end_date || '',
    marks_setting_accepted: c.marks_setting_accepted ?? 10,
    marks_setting_rejected: c.marks_setting_rejected ?? 0,
    max_score: sp.max_score ?? 100,
    min_score: sp.min_score ?? 0,
    parameters: sp.parameters?.length
      ? sp.parameters.map((p) => ({
          name: p.name,
          weight: p.weight,
          description: p.description || '',
        }))
      : DEFAULT_PARAMS.map((p) => ({ ...p })),
    organizers: [...(c.organizers || [])],
    jury_members: [...(c.jury_members || [])],
    min_byte_count: rules.min_byte_count ?? 0,
    min_reference_count: rules.min_reference_count ?? 0,
    outreach_dashboard_url: c.outreach_dashboard_url || '',
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

const totalWeight = computed(() =>
  form.value.parameters.reduce((sum, p) => sum + (Number(p.weight) || 0), 0),
)

function addParameter() {
  form.value.parameters.push({ name: '', weight: 0, description: '' })
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
      Number(f.max_score) > 0 &&
      Number(f.min_score) <= 0 &&
      totalWeight.value === 100 &&
      f.parameters.every((p) => p.name.trim())
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
  const payload = {
    name: f.name.trim(),
    project_name: f.project_name.trim(),
    start_date: f.start_date,
    organizers: f.organizers,
    jury_members: f.jury_members,
    rules: {
      allowed_submission_type: f.allowed_submission_type,
      min_byte_count: f.min_byte_count,
      min_reference_count: f.min_reference_count,
    },
    end_date: f.end_date || null,
    description: f.description.trim() || null,
    outreach_dashboard_url: f.outreach_dashboard_url.trim() || null,
  }
  if (scoringMode.value === 'multi_parameter') {
    // Backend needs valid marks; map max/min onto them.
    payload.marks_setting_accepted = Number(f.max_score)
    payload.marks_setting_rejected = Number(f.min_score)
    payload.scoring_parameters = {
      enabled: true,
      max_score: Number(f.max_score),
      min_score: Number(f.min_score),
      parameters: f.parameters.map((p) => ({
        name: p.name.trim(),
        weight: Number(p.weight) || 0,
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

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.start_date"
                label="Start Date * (UTC, YYYY-MM-DD)"
                type="date"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.end_date"
                label="End Date (UTC, YYYY-MM-DD)"
                type="date"
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
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="form.max_score"
                      label="Maximum Score (accepted)"
                      type="number"
                      min="1"
                      variant="outlined"
                      density="comfortable"
                      hint="Final score is scaled to this. Must be positive."
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="form.min_score"
                      label="Rejected Score"
                      type="number"
                      max="0"
                      variant="outlined"
                      density="comfortable"
                      hint="Zero or negative."
                      persistent-hint
                    />
                  </v-col>
                </v-row>

                <div
                  class="d-flex align-center justify-space-between mt-2 mb-2"
                >
                  <span class="text-subtitle-2 font-weight-medium">
                    Parameters (weights must total 100%)
                  </span>
                  <v-chip
                    :color="totalWeight === 100 ? 'success' : 'error'"
                    size="small"
                    label
                  >
                    Total: {{ totalWeight }}%
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
                    v-model.number="param.weight"
                    label="Weight %"
                    type="number"
                    min="0"
                    max="100"
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
          </v-row>

          <v-text-field
            v-model="form.outreach_dashboard_url"
            label="Outreach Dashboard URL (optional)"
            placeholder="https://outreachdashboard.wmflabs.org/courses/{school}/{course_slug}"
            type="url"
            variant="outlined"
            density="comfortable"
            hint="Link this contest to an Outreach Dashboard course to show its stats in a dedicated tab."
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
