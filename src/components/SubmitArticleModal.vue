<script setup>
import { ref, watch } from 'vue'
import { mdiClose, mdiMagnify, mdiSend, mdiArrowLeft } from '@mdi/js'
import { evaluateSubmission, createSubmission } from '../api/submissions'
import ArticleMetadata from './ArticleMetadata.vue'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  contestId: { type: [Number, String], required: true },
})
const emit = defineEmits(['submitted'])

// Two-step, tamper-proof flow:
//   1. evaluate(link) → article_metadata + signed hash (nothing stored)
//   2. submit(hash)   → confirm
const step = ref(1)
const articleLink = ref('')
const evaluation = ref(null) // { article_link, article_metadata, hash }
const evaluating = ref(false)
const submitting = ref(false)
const error = ref('')

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
            against the contest rules before you confirm.
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
          <div class="text-caption text-medium-emphasis mb-2">
            Review before submitting
          </div>
          <ArticleMetadata :metadata="evaluation?.article_metadata || {}" />
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
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
