<script setup>
import { computed, ref, watch } from 'vue'
import { mdiClose, mdiMagnify, mdiSend, mdiArrowLeft, mdiUpdate } from '@mdi/js'
import { evaluateSubmission, createSubmission } from '../api/submissions'
import ArticleMetadata from './ArticleMetadata.vue'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  contestId: { type: [Number, String], required: true },
})
// `submitted` — a new submission was created.
// `updated`   — the user's existing submission of this article was refreshed
//               (stats replaced, jury review removed).
const emit = defineEmits(['submitted', 'updated'])

// Two-step, tamper-proof flow:
//   1. evaluate(link) → article_metadata + signed hash (nothing stored)
//   2. submit(hash)   → confirm
// An article can be in a contest once, by one participant only. If someone
// else already submitted it, evaluate fails with the backend's message. If the
// current user already submitted it, evaluate returns `existing_submission`
// and step 2 becomes an ignore-or-update choice instead of a plain confirm.
const step = ref(1)
const articleLink = ref('')
const evaluation = ref(null) // { article_link, article_metadata, hash, existing_submission? }
const evaluating = ref(false)
const submitting = ref(false)
const error = ref('')

const existing = computed(() => evaluation.value?.existing_submission || null)

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const date = d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC',
  })
  return `${date}, ${time} UTC`
}

const existingReviewText = computed(() => {
  const e = existing.value
  if (!e) return ''
  if (!e.already_reviewed) return 'It has not been reviewed by the jury yet.'
  const who = e.reviewed_by_username ? ` by ${e.reviewed_by_username}` : ''
  const when = e.reviewed_at ? ` on ${formatDateTime(e.reviewed_at)}` : ''
  return `A jury member${who} already reviewed it${when}: ${e.status} (score ${e.score}).`
})

watch(open, (isOpen) => {
  if (isOpen) {
    step.value = 1
    articleLink.value = ''
    evaluation.value = null
    error.value = ''
    evaluating.value = false
    submitting.value = false
  }
})

async function evaluate() {
  if (!articleLink.value.trim()) return
  evaluating.value = true
  error.value = ''
  try {
    evaluation.value = await evaluateSubmission(
      props.contestId,
      articleLink.value.trim(),
    )
    step.value = 2
  } catch (e) {
    error.value = e.message
  } finally {
    evaluating.value = false
  }
}

async function confirm() {
  submitting.value = true
  error.value = ''
  try {
    const submission = await createSubmission(
      props.contestId,
      evaluation.value.hash,
    )
    emit('submitted', submission)
    open.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

// "Update stats": replace the saved stats of the user's existing submission
// with this fresh evaluation. The backend also removes any jury review so the
// article is reviewed again — the alert above the button says so explicitly.
async function updateExisting() {
  submitting.value = true
  error.value = ''
  try {
    const submission = await createSubmission(
      props.contestId,
      evaluation.value.hash,
      { update: true },
    )
    emit('updated', submission)
    open.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

// "Ignore": keep the existing submission exactly as it is.
function ignore() {
  open.value = false
}

function back() {
  step.value = 1
  error.value = ''
}
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card>
      <v-toolbar color="primary" density="comfortable">
        <v-icon :icon="mdiSend" class="ms-4" />
        <v-toolbar-title class="font-weight-bold">Submit Article</v-toolbar-title>
        <v-btn :icon="mdiClose" variant="text" @click="open = false" />
      </v-toolbar>

      <v-card-text class="pa-6">
        <!-- Step 1: enter URL -->
        <template v-if="step === 1">
          <v-alert type="info" variant="tonal" class="mb-4">
            Paste the URL of your article. We'll fetch its details and check it
            against the contest rules before you confirm. Each article can be
            submitted to a contest by one participant only.
          </v-alert>

          <v-text-field
            v-model="articleLink"
            label="Article URL *"
            placeholder="https://en.wikipedia.org/wiki/Article_Title"
            type="url"
            variant="outlined"
            autofocus
            :disabled="evaluating"
            @keyup.enter="evaluate"
          />
        </template>

        <!-- Step 2: review fetched metadata -->
        <template v-else>
          <v-alert
            v-if="existing"
            type="warning"
            variant="tonal"
            class="mb-4"
            title="You already submitted this article"
          >
            <p class="mb-2">
              You submitted this article to this contest on
              {{ formatDateTime(existing.submitted_at) }}.
              {{ existingReviewText }}
            </p>
            <p class="mb-1">
              <strong>Ignore</strong> keeps your existing submission unchanged.
            </p>
            <p class="mb-0">
              <strong>Update stats</strong> replaces its saved stats with the
              fresh ones shown below
              <template v-if="existing.already_reviewed">
                and <strong>removes the jury review</strong> (the article goes
                back to pending and will be reviewed again from scratch).
              </template>
              <template v-else>
                (it stays pending for jury review).
              </template>
            </p>
          </v-alert>

          <div class="text-caption text-medium-emphasis mb-2">
            {{ existing ? 'Fresh stats for this article' : 'Review before submitting' }}
          </div>
          <ArticleMetadata
            :metadata="evaluation?.article_metadata || {}"
            :rules="evaluation?.eligibility_rules || {}"
          />
        </template>

        <v-alert v-if="error" type="error" variant="tonal" class="mt-4">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-btn
          v-if="step === 2"
          variant="text"
          :prepend-icon="mdiArrowLeft"
          :disabled="submitting"
          @click="back"
        >
          Back
        </v-btn>
        <v-spacer />
        <template v-if="step === 2 && existing">
          <v-btn variant="tonal" :disabled="submitting" @click="ignore">Ignore</v-btn>
          <v-btn
            color="warning"
            variant="flat"
            :prepend-icon="mdiUpdate"
            :loading="submitting"
            @click="updateExisting"
          >
            Update stats
          </v-btn>
        </template>
        <template v-else>
          <v-btn variant="tonal" @click="open = false">Cancel</v-btn>
          <v-btn
            v-if="step === 1"
            color="primary"
            variant="flat"
            :prepend-icon="mdiMagnify"
            :loading="evaluating"
            :disabled="!articleLink.trim()"
            @click="evaluate"
          >
            Evaluate
          </v-btn>
          <v-btn
            v-else
            color="primary"
            variant="flat"
            :prepend-icon="mdiSend"
            :loading="submitting"
            @click="confirm"
          >
            Confirm &amp; Submit
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
