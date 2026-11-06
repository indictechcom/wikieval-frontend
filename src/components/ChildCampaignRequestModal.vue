<script setup>
import { ref, computed, watch } from 'vue'
import { mdiClose, mdiSend, mdiSitemapOutline } from '@mdi/js'
import { createChildRequest } from '../api/childCampaignRequests'
import { useAuth } from '../composables/useAuth'
import UserAutocomplete from './UserAutocomplete.vue'

// Ask for a child campaign under a group campaign. Only the child's name, its
// local organizers and (optionally) its jury are collected: the project,
// dates, eligibility rules and scoring are the group's defaults, copied on
// approval by the group's organizers.
const props = defineProps({
  parent: { type: Object, required: true },
})
const open = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['submitted'])

const { username } = useAuth()

const name = ref('')
const organizers = ref([])
const jury = ref([])
const loading = ref(false)
const error = ref('')

// Reset each time the dialog opens: the requester starts as an organizer and
// the group's default jury is pre-filled (both editable).
watch(open, (isOpen) => {
  if (isOpen) {
    name.value = ''
    organizers.value = username.value ? [username.value] : []
    jury.value = [...(props.parent.jury_members || [])]
    error.value = ''
    loading.value = false
  }
})

const valid = computed(() => !!name.value.trim() && organizers.value.length > 0)

// Human-readable summary of the inherited eligibility rules.
const ruleLabels = {
  min_byte_count: (v) => `at least ${v} bytes`,
  min_word_count: (v) => `at least ${v} words`,
  min_image_count: (v) => `at least ${v} image${v === 1 ? '' : 's'}`,
  min_reference_count: (v) => `at least ${v} reference${v === 1 ? '' : 's'}`,
  allowed_submission_type: (v) => `${v} articles`,
  author_only: (v) => (v ? 'author must be the submitter' : null),
}
const inheritedRules = computed(() => {
  const rules = props.parent.eligibility_rules || {}
  return Object.entries(rules)
    .map(([key, value]) =>
      ruleLabels[key] ? ruleLabels[key](value) : `${key}: ${value}`,
    )
    .filter(Boolean)
})
const inheritedScoring = computed(() => {
  const p = props.parent
  if (p.scoring_parameters?.enabled) {
    return `multi-parameter, up to ${p.scoring_parameters.max_score} points`
  }
  return `${p.marks_setting_accepted} points per accepted article`
})

async function submit() {
  if (!valid.value) return
  loading.value = true
  error.value = ''
  try {
    const request = await createChildRequest(props.parent.id, {
      name: name.value.trim(),
      organizers: organizers.value,
      jury_members: jury.value,
    })
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
  <v-dialog v-model="open" max-width="720" scrollable>
    <v-card>
      <v-toolbar color="primary" density="comfortable">
        <v-icon :icon="mdiSitemapOutline" class="ms-4" />
        <v-toolbar-title class="font-weight-bold">
          Request a Child Campaign
        </v-toolbar-title>
        <v-btn :icon="mdiClose" variant="text" @click="open = false" />
      </v-toolbar>

      <v-card-text class="pa-6">
        <p class="text-medium-emphasis mb-4">
          Ask the organizers of <strong>{{ parent.name }}</strong> to add your
          campaign under it. They review the request; once approved, the
          campaign is created, you can manage it, and you receive contest
          creator rights.
        </p>

        <v-text-field
          v-model="name"
          label="Child campaign name"
          placeholder="e.g. Wikipedia Asian Month — Hindi"
          variant="outlined"
          density="comfortable"
          autofocus
          class="mb-2"
        />

        <UserAutocomplete
          v-model="organizers"
          label="Local organizers"
          hint="At least one. They will manage the campaign; you are included as its creator."
          class="mb-2"
        />

        <UserAutocomplete
          v-model="jury"
          label="Jury members (optional)"
          hint="Pre-filled with the group's default jury; the group organizers can adjust this before approving."
          class="mb-4"
        />

        <v-alert type="info" variant="tonal" density="compact">
          <div class="font-weight-bold mb-1">Inherited from {{ parent.name }}</div>
          <ul class="ps-4">
            <li>Project: {{ parent.project_name }}</li>
            <li>Scoring: {{ inheritedScoring }}</li>
            <li v-if="inheritedRules.length">
              Eligibility: {{ inheritedRules.join(', ') }}
            </li>
            <li v-else>Eligibility: no extra rules</li>
            <li>Dates and timezone: same as the group</li>
          </ul>
          <div class="text-caption mt-1">
            You do not need to fill these in. They can be adjusted on the new
            campaign once it is approved.
          </div>
        </v-alert>

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
          :prepend-icon="mdiSend"
          :loading="loading"
          :disabled="!valid"
          @click="submit"
        >
          Submit Request
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
