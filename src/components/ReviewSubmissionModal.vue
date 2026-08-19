<script setup>
import { ref, computed, watch } from 'vue'
import { mdiClose, mdiGavel } from '@mdi/js'
import { reviewSubmission } from '../api/submissions'
import ArticleMetadata from './ArticleMetadata.vue'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  submission: { type: Object, default: null },
  contest: { type: Object, default: null },
})
const emit = defineEmits(['reviewed'])

const decision = ref('accept')
const score = ref(0)
const comment = ref('')
const loading = ref(false)
const error = ref('')

// Editing an existing review vs a first-time review.
const isEditing = computed(() => !!props.submission?.already_reviewed)

// Multi-parameter scoring (when the contest is configured for it).
const scoring = computed(() => {
  const sp = props.contest?.scoring_parameters
  return sp && sp.enabled ? sp : null
})
const params = computed(() => scoring.value?.parameters || [])
const maxScore = computed(() => scoring.value?.max_score ?? 0)
const paramScores = ref({})

// Final score = sum of the points awarded across parameters.
const calculatedScore = computed(() => {
  if (!scoring.value) return 0
  return params.value.reduce(
    (sum, p) => sum + (Number(paramScores.value[p.name]) || 0),
    0,
  )
})

watch(open, (isOpen) => {
  if (isOpen) {
    const s = props.submission
    // Editing an existing review: pre-fill with the previous decision/score/
    // parameter scores/comment. First review: start from defaults.
    const editing = s?.already_reviewed
    decision.value = editing && s.status === 'rejected' ? 'reject' : 'accept'
    // Simple: default to accepted marks. Multi: starts at 0 (all sliders 0).
    score.value = editing ? (s.score ?? 0) : (props.contest?.marks_setting_accepted ?? 0)
    paramScores.value = Object.fromEntries(
      params.value.map((p) => [p.name, editing ? (s.parameter_scores?.[p.name] ?? 0) : 0]),
    )
    comment.value = editing ? (s.review_comment ?? '') : ''
    error.value = ''
    loading.value = false
  }
}, { immediate: true })  // run on first mount too (modal opens with open=true)

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const payload = {
      decision: decision.value,
      reviewComment: comment.value.trim() || undefined,
    }
    if (decision.value === 'accept') {
      if (scoring.value) {
        payload.score = calculatedScore.value
        payload.parameterScores = { ...paramScores.value }
      } else {
        payload.score = Number(score.value)
      }
    }
    const updated = await reviewSubmission(props.submission.id, payload)
    emit('reviewed', updated)
    open.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="580" scrollable>
    <v-card>
      <v-toolbar color="primary" density="comfortable">
        <v-icon :icon="mdiGavel" class="ms-4" />
        <v-toolbar-title class="font-weight-bold">
          {{ isEditing ? 'Edit Review' : 'Review Submission' }}
        </v-toolbar-title>
        <v-btn :icon="mdiClose" variant="text" @click="open = false" />
      </v-toolbar>

      <v-card-text class="pa-6">
        <ArticleMetadata
          :metadata="submission?.article_metadata || {}"
          :rules="contest?.rules || {}"
          class="mb-2"
        />
        <div class="text-caption text-medium-emphasis mb-1">
          Submitted by {{ submission?.username }}
        </div>

        <v-divider class="my-4" />

        <div class="text-caption text-medium-emphasis mb-1">Decision</div>
        <v-btn-toggle
          v-model="decision"
          mandatory
          divided
          variant="outlined"
          class="mb-4"
        >
          <v-btn value="accept" color="success">Accept</v-btn>
          <v-btn value="reject" color="error">Reject</v-btn>
        </v-btn-toggle>

        <template v-if="decision === 'accept'">
          <!-- Multi-parameter scoring -->
          <template v-if="scoring">
            <div class="text-caption text-medium-emphasis mb-2">
              Award points for each parameter.
            </div>
            <div v-for="p in params" :key="p.name" class="mb-3">
              <div class="d-flex align-center justify-space-between">
                <span class="text-body-2 font-weight-medium">
                  {{ p.name }}
                  <span class="text-medium-emphasis">(max {{ p.points }})</span>
                </span>
                <span class="text-body-2 font-weight-bold">
                  {{ paramScores[p.name] || 0 }}/{{ p.points }}
                </span>
              </div>
              <v-slider
                v-model="paramScores[p.name]"
                :min="0"
                :max="p.points"
                :step="1"
                color="primary"
                hide-details
              />
              <div v-if="p.description" class="text-caption text-medium-emphasis">
                {{ p.description }}
              </div>
            </div>
            <v-alert type="info" variant="tonal" density="compact" class="mt-2">
              Final score: <strong>{{ calculatedScore }}</strong> / {{ maxScore }}
            </v-alert>
          </template>

          <!-- Simple scoring -->
          <v-text-field
            v-else
            v-model.number="score"
            label="Score"
            type="number"
            variant="outlined"
            density="comfortable"
            hint="Defaults to the contest's accepted marks."
            persistent-hint
          />
        </template>

        <v-alert v-else type="info" variant="tonal" density="compact">
          Rejected submissions receive the contest's rejected marks.
        </v-alert>

        <v-textarea
          v-model="comment"
          label="Review comment (optional)"
          variant="outlined"
          rows="3"
          auto-grow
          class="mt-4"
        />

        <v-alert v-if="error" type="error" variant="tonal" class="mt-2">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="tonal" @click="open = false">Cancel</v-btn>
        <v-btn
          :color="decision === 'accept' ? 'success' : 'error'"
          variant="flat"
          :loading="loading"
          @click="submit"
        >
          {{ decision === 'accept' ? 'Accept' : 'Reject' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
