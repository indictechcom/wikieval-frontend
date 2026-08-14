<script setup>
import { mdiAccountGroup, mdiPlusCircle, mdiGavel } from '@mdi/js'
import { loginUrl } from '../api/auth'

const roles = [
  {
    key: 'participants',
    icon: mdiAccountGroup,
    title: 'Participants',
    text: 'Submit articles, collaborate, and compete in global contests.',
  },
  {
    key: 'organizers',
    icon: mdiPlusCircle,
    title: 'Organizers',
    text: 'Create contests, manage tasks, and engage communities.',
  },
  {
    key: 'judges',
    icon: mdiGavel,
    title: 'Judges',
    text: 'Review submissions and ensure fair evaluation.',
  },
]
</script>

<template>
  <v-sheet color="primary" class="text-center py-16">
    <v-container>
      <h1 class="text-h2 font-weight-bold text-white mb-4">WikiEval</h1>
      <p class="text-h5 font-weight-medium text-white mb-4">
        Collaborate. Compete. Create Knowledge.
      </p>
      <p class="text-body-1 text-white mx-auto mb-8" style="max-width: 720px; opacity: 0.9">
        A professional platform for managing Wikipedia article contests and
        fostering collaborative knowledge creation.
      </p>
      <div class="d-flex justify-center ga-4 flex-wrap">
        <v-btn size="large" color="white" variant="flat" to="/contests">
          Browse Contests
        </v-btn>
        <v-btn size="large" color="white" variant="outlined" :href="loginUrl">
          Get Started
        </v-btn>
      </div>
    </v-container>
  </v-sheet>

  <v-container class="py-12">
    <v-row>
      <v-col v-for="role in roles" :key="role.key" cols="12" md="4">
        <v-card class="text-center pa-6" variant="outlined" height="100%">
          <v-icon :icon="role.icon" color="primary" size="40" class="mb-3" />
          <h3 class="text-h6 mb-2">{{ role.title }}</h3>
          <p class="text-body-2 text-medium-emphasis">{{ role.text }}</p>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
