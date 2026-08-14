<script setup>
import { ref, watch } from 'vue'
import { mdiAccountPlus, mdiClose, mdiSend } from '@mdi/js'
import { createRequest } from '../api/contestCreationRequests'

const open = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['submitted'])

const reason = ref('')
const loading = ref(false)
const error = ref('')

// Reset the form each time the dialog opens.
watch(open, (isOpen) => {
  if (isOpen) {
    reason.value = ''
    error.value = ''
    loading.value = false
  }
})

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const request = await createRequest(reason.value.trim())
    emit('submitted', request)
    open.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="900" scrollable>
    <v-card>
      <v-toolbar color="primary" density="comfortable">
        <v-icon :icon="mdiAccountPlus" class="ms-4" />
        <v-toolbar-title class="font-weight-bold">
          Request Contest Creator Rights
        </v-toolbar-title>
        <v-btn :icon="mdiClose" variant="text" @click="open = false" />
      </v-toolbar>

      <v-card-text class="pa-6">
        <v-alert type="info" variant="tonal" class="mb-6">
          <div class="font-weight-bold mb-2">About Contest Creator Rights:</div>
          <ul class="ps-4">
            <li>Contest creators can create and manage contests</li>
            <li>Users with fewer edits need to provide a reason for review</li>
          </ul>
        </v-alert>

        <v-textarea
          v-model="reason"
          label="Reason for Request"
          variant="outlined"
          rows="8"
          auto-grow
          persistent-placeholder
          placeholder="Please explain why you would like to become a contest creator. Include information about your experience, contributions, or any relevant background."
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
          color="primary"
          variant="flat"
          :prepend-icon="mdiSend"
          :loading="loading"
          :disabled="!reason.trim()"
          @click="submit"
        >
          Submit Request
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
