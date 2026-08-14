<script setup>
import {
  mdiWikipedia,
  mdiAccountCircle,
  mdiMenuDown,
  mdiLogout,
} from '@mdi/js'
import ThemeToggle from './ThemeToggle.vue'
import { loginUrl, logoutUrl } from '../api/auth'
import { useAuth } from '../composables/useAuth'

const { username, logged, isSuperadmin } = useAuth()
</script>

<template>
  <v-app-bar flat border="b" color="surface" height="64">
    <v-container class="d-flex align-center ga-4 py-0">
      <RouterLink
        to="/"
        class="text-primary text-h6 font-weight-bold"
        style="letter-spacing: -0.02em"
      >
        WikiEval
      </RouterLink>

      <v-spacer />
      <nav class="d-flex align-center ga-1">
        <v-btn to="/" variant="text" exact>Home</v-btn>
        <v-btn to="/contests" variant="text">Contests</v-btn>
        <template v-if="logged">
          <v-btn to="/dashboard" variant="text">Dashboard</v-btn>
          <v-btn v-if="isSuperadmin" to="/admin/requests" variant="text">
            Requests
          </v-btn>
        </template>
      </nav>
      <v-spacer />

      <ThemeToggle />

      <v-btn
        v-if="!logged"
        color="primary"
        variant="flat"
        :prepend-icon="mdiWikipedia"
        :href="loginUrl"
      >
        Log in
      </v-btn>

      <v-menu v-else>
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            variant="outlined"
            :prepend-icon="mdiAccountCircle"
            :append-icon="mdiMenuDown"
          >
            {{ username }}
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            :href="logoutUrl"
            :prepend-icon="mdiLogout"
            title="Log out"
          />
        </v-list>
      </v-menu>
    </v-container>
  </v-app-bar>
</template>
