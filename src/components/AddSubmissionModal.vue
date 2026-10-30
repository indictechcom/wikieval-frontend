<script setup>
import { ref, watch } from 'vue'
import { mdiClose, mdiAccountPlusOutline } from '@mdi/js'
import { addSubmissionOnBehalf } from '../api/submissions'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  contestId: { type: [Number, String], required: true },
})
const emit = defineEmits(['added'])

const username = ref('')
const articleLink = ref('')
const loading = ref(false)
const error = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    username.value = ''
    articleLink.value = ''
    error.value = ''
    loading.value = false
  }
})

async function submit() {
  if (!username.value.trim() || !articleLink.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    const submission = await addSubmissionOnBehalf(props.contestId, {
      username: username.value.trim(),
      articleLink: articleLink.value.trim(),
    })
    emit('added', submission)
    open.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card>
      <v-toolbar color="primary" density="comfortable">
        <v-icon :icon="mdiAccountPlusOutline" class="ms-4" />
        <v-toolbar-title class="font-weight-bold">
          Add Submission
        </v-toolbar-title>
        <v-btn :icon="mdiClose" variant="text" @click="open = false" />
      </v-toolbar>

      <v-card-text class="pa-6">
        <v-alert type="info" variant="tonal" density="comfortable" class="mb-4">
          Add an article on behalf of a participant who missed submitting during
          the campaign. This does not change the campaign dates; the article
          must still meet the contest's eligibility rules, and words-added is
          counted only within the campaign period.
        </v-alert>

        <v-text-field
          v-model="username"
          label="Participant username *"
          placeholder="Their Wikipedia username (the “By”)"
          variant="outlined"
          density="comfortable"
          autofocus
          :disabled="loading"
          class="mb-1"
        />
        <v-text-field
          v-model="articleLink"
          label="Article URL *"
          placeholder="https://xx.wikipedia.org/wiki/Article_Title"
          type="url"
          variant="outlined"
          density="comfortable"
          :disabled="loading"
          @keyup.enter="submit"
        />

        <v-alert v-if="error" type="error" variant="tonal" class="mt-2">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="tonal" :disabled="loading" @click="open = false">
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :prepend-icon="mdiAccountPlusOutline"
          :loading="loading"
          :disabled="!username.trim() || !articleLink.trim()"
          @click="submit"
        >
          Add
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
