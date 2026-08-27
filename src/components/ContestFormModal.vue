<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  mdiPlus,
  mdiPencil,
  mdiClose,
  mdiContentSave,
  mdiInformationOutline,
  mdiFileOutline,
  mdiFormatAlignLeft,
  mdiLinkVariant,
  mdiImageMultiple,
  mdiFileDocumentPlusOutline,
  mdiAccountEdit,
  mdiShieldCheckOutline,
  mdiTuneVariant,
  mdiTrophyOutline,
  mdiStarOutline,
  mdiViewGridOutline,
  mdiAccountGroupOutline,
  mdiAutoFix,
} from '@mdi/js'
import { AUTO_METRICS, AUTO_OPERATORS } from '../utils/autoScore'

// Icon per eligibility-rule key (the catalog is data; icons are presentation).
const RULE_ICONS = {
  min_byte_count: mdiFileOutline,
  min_word_count: mdiFormatAlignLeft,
  min_reference_count: mdiLinkVariant,
  min_image_count: mdiImageMultiple,
  allowed_submission_type: mdiFileDocumentPlusOutline,
  author_only: mdiAccountEdit,
}
const ruleIcon = (key) => RULE_ICONS[key] || mdiShieldCheckOutline
import {
  createContest,
  updateContest,
  getEligibilityRules,
} from '../api/contests'
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
  // Dynamic article-submission eligibility rules: { rule_key: value }.
  eligibility_rules: {},
  project_link: '',
})

// The eligibility-rule catalog (fetched once). Each entry: { key, label, type,
// default, unit?, options? }. Drives which rules can be added and how they render.
const catalog = ref([])
onMounted(async () => {
  try {
    catalog.value = await getEligibilityRules()
  } catch {
    catalog.value = []
  }
})
// Rules the creator has added (catalog entry + current value), and the ones
// still available to add.
const activeRules = computed(() =>
  catalog.value.filter((r) => r.key in form.value.eligibility_rules),
)
const availableRules = computed(() =>
  catalog.value.filter((r) => !(r.key in form.value.eligibility_rules)),
)
function addRule(rule) {
  // Seed with the rule's default; for an enum without one fall back to the
  // first option so the select is never left on an invalid/blank value.
  let value = rule.default
  if (value == null) {
    if (rule.type === 'boolean') value = true
    else if (rule.type === 'enum') value = rule.options?.[0]?.value ?? null
    else value = 0
  }
  form.value.eligibility_rules[rule.key] = value
}
function removeRule(key) {
  delete form.value.eligibility_rules[key]
}

function fromContest(c) {
  const rules =
    c.eligibility_rules && typeof c.eligibility_rules === 'object'
      ? c.eligibility_rules
      : {}
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
          auto: p.auto ? { ...p.auto } : null,
        }))
      : DEFAULT_PARAMS.map((p) => ({ ...p })),
    organizers: [...(c.organizers || [])],
    jury_members: [...(c.jury_members || [])],
    eligibility_rules: { ...rules },
    project_link: c.project_link || '',
  }
}

const form = ref(blankForm())
const scoringMode = ref('simple') // 'simple' | 'multi_parameter'
const loading = ref(false)
const error = ref('')

// Max score is the sum of the parameters' point allocations.
const totalPoints = computed(() =>
  form.value.parameters.reduce((sum, p) => sum + (Number(p.points) || 0), 0),
)

function addParameter() {
  form.value.parameters.push({ name: '', points: 0, description: '', auto: null })
}
function removeParameter(index) {
  if (form.value.parameters.length > 1) form.value.parameters.splice(index, 1)
}
// Toggle an auto-scoring rule on a parameter (award full points when a metric
// condition on the article is met).
function toggleAuto(param) {
  param.auto = param.auto
    ? null
    : { metric: 'image_count', op: '>=', value: 0 }
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

// The end as a UTC instant, pushed to :59 seconds so the whole final minute is
// included (the time picker only captures minutes). null when no end is set.
function endInstant(f) {
  if (!f.end_date) return null
  const iso = zonedToUtcIso(f.end_date, f.end_time, f.timezone)
  return new Date(new Date(iso).getTime() + 59_000).toISOString()
}

function buildPayload() {
  const f = form.value
  // Once started the config is locked, but the end date stays editable so a
  // running contest can be extended or closed early.
  if (locked.value) {
    return {
      organizers: f.organizers,
      jury_members: f.jury_members,
      end_date: endInstant(f),
    }
  }
  // Convert the organizer's local wall-clock date/time to a UTC instant. The
  // start begins at :00 of its minute; the end at :59 (see endInstant).
  const startIso = zonedToUtcIso(f.start_date, f.start_time, f.timezone)

  const payload = {
    name: f.name.trim(),
    project_name: f.project_name.trim(),
    timezone: f.timezone,
    start_date: startIso,
    organizers: f.organizers,
    jury_members: f.jury_members,
    eligibility_rules: { ...f.eligibility_rules },
    end_date: endInstant(f),
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
        // Only persist a complete auto rule.
        ...(p.auto && p.auto.metric && p.auto.op && p.auto.value !== '' && p.auto.value != null
          ? { auto: { metric: p.auto.metric, op: p.auto.op, value: Number(p.auto.value) || 0 } }
          : {}),
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
          This contest has started, so its configuration is locked. You can still
          change organizers, jury members, and the end date (e.g. to extend the
          contest).
        </v-alert>

        <!-- End date stays editable after start so the contest can be extended
             or closed early. Times are in the contest's (fixed) timezone. -->
        <template v-if="locked">
          <div class="text-caption text-medium-emphasis mb-2">
            End date/time — in {{ form.timezone }}
          </div>
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
        </template>

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

          <v-text-field
            v-model="form.project_link"
            label="Project Link (optional)"
            placeholder="https://en.wikipedia.org/wiki/Wikipedia:WikiProject_..."
            type="url"
            variant="outlined"
            density="comfortable"
            hint="Link this contest to its project or campaign page."
            persistent-hint
            class="mb-6"
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
          <v-card variant="outlined" rounded="lg" class="mb-4">
            <div class="d-flex align-center ga-2 px-4 py-3 bg-surface-light">
              <v-icon :icon="mdiTrophyOutline" size="20" color="primary" />
              <span class="text-subtitle-1 font-weight-bold">
                Scoring System Configuration
              </span>
              <v-tooltip location="bottom" max-width="620">
                <template #activator="{ props: tip }">
                  <v-icon
                    v-bind="tip"
                    :icon="mdiInformationOutline"
                    size="18"
                    color="medium-emphasis"
                    style="cursor: help"
                  />
                </template>
                How accepted submissions are scored by the jury.
              </v-tooltip>
              <v-spacer />
              <v-chip
                v-if="scoringMode === 'multi_parameter'"
                size="small"
                variant="tonal"
                color="primary"
              >
                Max score: {{ totalPoints }}
              </v-chip>
            </div>

            <v-divider />

            <v-card-text>
              <!-- Mode selector (segmented) -->
              <v-btn-toggle
                v-model="scoringMode"
                mandatory
                divided
                color="primary"
                variant="outlined"
                density="comfortable"
                class="mb-4"
              >
                <v-btn value="simple" :prepend-icon="mdiStarOutline">
                  Simple
                </v-btn>
                <v-btn value="multi_parameter" :prepend-icon="mdiViewGridOutline">
                  Multi-Parameter
                </v-btn>
              </v-btn-toggle>

              <!-- Simple -->
              <template v-if="scoringMode === 'simple'">
                <p class="text-caption text-medium-emphasis mb-3">
                  A single score for accepted submissions, and one for rejected.
                </p>
                <v-row>
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
              </template>

              <!-- Multi-parameter -->
              <template v-else>
                <p class="text-caption text-medium-emphasis mb-3">
                  Allocate points to each parameter. The maximum score is their
                  total; a jury awards up to that many points per parameter.
                </p>

                <div
                  v-for="(param, i) in form.parameters"
                  :key="i"
                  class="param-row rounded-lg border pa-2 mb-2"
                >
                  <div class="d-flex align-center ga-2">
                    <v-chip size="small" label color="primary" variant="tonal">
                      #{{ i + 1 }}
                    </v-chip>
                    <v-text-field
                      v-model="param.name"
                      label="Name"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="flex: 1 1 150px"
                    />
                    <v-text-field
                      v-model.number="param.points"
                      label="Points"
                      type="number"
                      min="1"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="width: 96px"
                    />
                    <v-text-field
                      v-model="param.description"
                      label="Description"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="flex: 2 1 200px"
                    />
                    <v-tooltip location="top" text="Auto-score from an article stat">
                      <template #activator="{ props: tip }">
                        <v-btn
                          v-bind="tip"
                          :icon="mdiAutoFix"
                          variant="text"
                          size="small"
                          :color="param.auto ? 'primary' : 'medium-emphasis'"
                          @click="toggleAuto(param)"
                        />
                      </template>
                    </v-tooltip>
                    <v-btn
                      :icon="mdiClose"
                      variant="text"
                      size="small"
                      color="medium-emphasis"
                      :disabled="form.parameters.length <= 1"
                      @click="removeParameter(i)"
                    />
                  </div>

                  <!-- Auto-scoring rule -->
                  <div
                    v-if="param.auto"
                    class="d-flex align-center flex-wrap ga-2 mt-2 ps-2"
                  >
                    <v-icon :icon="mdiAutoFix" size="16" color="primary" />
                    <span class="text-caption text-medium-emphasis">
                      Award full points when
                    </span>
                    <v-select
                      v-model="param.auto.metric"
                      :items="AUTO_METRICS"
                      item-title="label"
                      item-value="key"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="width: 180px"
                    />
                    <v-select
                      v-model="param.auto.op"
                      :items="AUTO_OPERATORS"
                      item-title="label"
                      item-value="value"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="width: 140px"
                    />
                    <v-text-field
                      v-model.number="param.auto.value"
                      type="number"
                      min="0"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="width: 100px"
                    />
                  </div>
                </div>

                <div class="d-flex ga-2 mt-3">
                  <v-btn
                    variant="tonal"
                    color="primary"
                    :prepend-icon="mdiPlus"
                    @click="addParameter"
                  >
                    Add Parameter
                  </v-btn>
                  <v-btn variant="text" @click="loadDefaults">
                    Load Defaults
                  </v-btn>
                </div>
              </template>
            </v-card-text>
          </v-card>
        </template>

        <!-- People (organizers & jury — always editable by an organizer) -->
        <v-card variant="outlined" rounded="lg" class="mb-4">
          <div class="d-flex align-center ga-2 px-4 py-3 bg-surface-light">
            <v-icon :icon="mdiAccountGroupOutline" size="20" color="primary" />
            <span class="text-subtitle-1 font-weight-bold">
              Organizers &amp; Jury
            </span>
            <v-tooltip location="bottom" max-width="620">
              <template #activator="{ props: tip }">
                <v-icon
                  v-bind="tip"
                  :icon="mdiInformationOutline"
                  size="18"
                  color="medium-emphasis"
                  style="cursor: help"
                />
              </template>
              Organizers manage the contest; jury members review submissions.
              Editable even after the contest starts.
            </v-tooltip>
          </div>

          <v-divider />

          <v-card-text>
            <UserAutocomplete
              v-model="form.organizers"
              label="Organizers"
              hint="You are automatically added as an organizer. Add others who should manage this contest."
              class="mb-2"
            />
            <UserAutocomplete
              v-model="form.jury_members"
              label="Jury Members"
              hint="Jury members review and score submissions."
            />
          </v-card-text>
        </v-card>

        <template v-if="!locked">
          <!-- Dynamic article-submission eligibility rules -->
          <v-card variant="outlined" rounded="lg" class="mb-4">
            <div class="d-flex align-center ga-2 px-4 py-3 bg-surface-light">
              <v-icon :icon="mdiShieldCheckOutline" size="20" color="primary" />
              <span class="text-subtitle-1 font-weight-bold">
                Submission Eligibility Rules
              </span>
              <v-tooltip location="bottom" max-width="620">
                <template #activator="{ props: tip }">
                  <v-icon
                    v-bind="tip"
                    :icon="mdiInformationOutline"
                    size="18"
                    color="medium-emphasis"
                    style="cursor: help"
                  />
                </template>
                Rules an article must satisfy to be submitted (checked at
                submission time).
              </v-tooltip>
              <v-spacer />
              <v-chip
                v-if="activeRules.length"
                size="small"
                variant="tonal"
                color="primary"
              >
                {{ activeRules.length }}
                {{ activeRules.length === 1 ? 'rule' : 'rules' }}
              </v-chip>
            </div>

            <v-divider />

            <!-- Empty state -->
            <div
              v-if="activeRules.length === 0"
              class="text-center px-4 py-6 text-medium-emphasis"
            >
              <v-icon :icon="mdiTuneVariant" size="32" class="mb-2 opacity-60" />
              <p class="text-body-2">
                No rules yet — any main-namespace article may be submitted.
              </p>
              <p class="text-caption">Add a rule below to restrict submissions.</p>
            </div>

            <!-- Rule rows -->
            <v-list v-else class="py-0">
              <template v-for="(rule, i) in activeRules" :key="rule.key">
                <v-divider v-if="i > 0" />
                <v-list-item class="px-4 py-3">
                  <template #prepend>
                    <v-icon
                      :icon="ruleIcon(rule.key)"
                      color="primary"
                      class="me-3"
                    />
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ rule.label }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption">
                    {{ rule.description }}
                  </v-list-item-subtitle>

                  <template #append>
                    <div class="d-flex align-center ga-2">
                      <v-text-field
                        v-if="rule.type === 'number'"
                        v-model.number="form.eligibility_rules[rule.key]"
                        :suffix="rule.unit"
                        type="number"
                        min="0"
                        variant="outlined"
                        density="compact"
                        hide-details
                        style="width: 150px"
                      />
                      <v-select
                        v-else-if="rule.type === 'enum'"
                        v-model="form.eligibility_rules[rule.key]"
                        :items="rule.options"
                        item-title="label"
                        item-value="value"
                        variant="outlined"
                        density="compact"
                        hide-details
                        style="width: 200px"
                      />
                      <v-switch
                        v-else-if="rule.type === 'boolean'"
                        v-model="form.eligibility_rules[rule.key]"
                        color="primary"
                        density="compact"
                        hide-details
                        inset
                        class="flex-grow-0"
                      />
                      <v-btn
                        :icon="mdiClose"
                        variant="text"
                        size="small"
                        color="medium-emphasis"
                        @click="removeRule(rule.key)"
                      />
                    </div>
                  </template>
                </v-list-item>
              </template>
            </v-list>

            <v-divider v-if="availableRules.length" />

            <div v-if="availableRules.length" class="pa-3">
              <v-menu>
                <template #activator="{ props: menu }">
                  <v-btn
                    v-bind="menu"
                    variant="tonal"
                    color="primary"
                    :prepend-icon="mdiPlus"
                    block
                  >
                    Add Rule
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item
                    v-for="rule in availableRules"
                    :key="rule.key"
                    :prepend-icon="ruleIcon(rule.key)"
                    :title="rule.label"
                    :subtitle="rule.description"
                    @click="addRule(rule)"
                  />
                </v-list>
              </v-menu>
            </div>
          </v-card>
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

<style scoped>
.param-row {
  background: rgba(var(--v-theme-primary), 0.02);
}
</style>
