<script setup>
import { ref, computed, watch } from 'vue'
import { mdiCheck, mdiClose, mdiClipboardTextClockOutline } from '@mdi/js'
import { reviewChildRequest } from '../api/childCampaignRequests'
import UserAutocomplete from './UserAutocomplete.vue'

// A group organizer's review of one child-campaign request: edit the local
// organizers / jury if needed, then approve (creates the child campaign) or
// reject with a reason.
const props = defineProps({
  request: { type: Object, required: true },
  parent: { type: Object, required: true },
})
const open = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['reviewed'])

const organizers = ref([])
const jury = ref([])
const rejectReason = ref('')
const rejecting = ref(false)
const loading = ref(false)
const error = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    organizers.value = [...(props.request.organizers || [])]
    jury.value = [...(props.request.jury_members || [])]
    rejectReason.value = ''
    rejecting.value = false
    error.value = ''
    loading.value = false
  }
})

const canApprove = computed(() => organizers.value.length > 0)

async function decide(decision) {
  loading.value = true
  error.value = ''
  try {
    const extra =
      decision === 'approve'
        ? { organizers: organizers.value, jury_members: jury.value }
        : { rejection_reason: rejectReason.value.trim() }
    const updated = await reviewChildRequest(
      props.parent.id,
      props.request.id,
      decision,
      extra,
    )
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
  <v-dialog v-model="open" max-width="720" scrollable>
    <v-card>
      <v-toolbar color="primary" density="comfortable">
        <v-icon :icon="mdiClipboardTextClockOutline" class="ms-4" />
        <v-toolbar-title class="font-weight-bold">
          Review Child Campaign Request
        </v-toolbar-title>
        <v-btn :icon="mdiClose" variant="text" @click="open = false" />
      </v-toolbar>

      <v-card-text class="pa-6">
        <div class="mb-4">
          <div class="text-h6 font-weight-bold">{{ request.name }}</div>
          <div class="text-medium-emphasis">
            Requested by <strong>{{ request.username }}</strong>
          </div>
        </div>

        <UserAutocomplete
          v-model="organizers"
          label="Local organizers"
          hint="At least one. The requester is always included as the campaign's creator."
          class="mb-2"
        />

        <UserAutocomplete
          v-model="jury"
          label="Jury members"
          :hint="jury.length ? '' : `Empty: the group's default jury will be used.`"
          class="mb-4"
        />

        <v-alert type="info" variant="tonal" density="compact" class="mb-4">
          Approving creates <strong>{{ request.name }}</strong> under
          <strong>{{ parent.name }}</strong> as a draft with the group's
          project, dates, eligibility rules and scoring, and grants
          {{ request.username }} contest creator rights. Its organizers can
          adjust it before starting it.
        </v-alert>

        <v-expand-transition>
          <div v-if="rejecting">
            <v-textarea
              v-model="rejectReason"
              label="Rejection reason"
              hint="Shown to the requester."
              persistent-hint
              variant="outlined"
              rows="3"
              auto-grow
              autofocus
            />
          </div>
        </v-expand-transition>

        <v-alert v-if="error" type="error" variant="tonal" class="mt-4">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-btn
          v-if="!rejecting"
          color="error"
          variant="tonal"
          :prepend-icon="mdiClose"
          :disabled="loading"
          @click="rejecting = true"
        >
          Reject…
        </v-btn>
        <template v-else>
          <v-btn variant="tonal" :disabled="loading" @click="rejecting = false">
            Back
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            :prepend-icon="mdiClose"
            :loading="loading"
            :disabled="!rejectReason.trim()"
            @click="decide('reject')"
          >
            Confirm Reject
          </v-btn>
        </template>
        <v-spacer />
        <v-btn variant="tonal" :disabled="loading" @click="open = false">
          Cancel
        </v-btn>
        <v-btn
          v-if="!rejecting"
          color="success"
          variant="flat"
          :prepend-icon="mdiCheck"
          :loading="loading"
          :disabled="!canApprove"
          @click="decide('approve')"
        >
          Approve &amp; Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
