<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import { useAuth } from './composables/useAuth'

const { fetchUser } = useAuth()

// Check whether the user is logged in as soon as the app loads.
onMounted(fetchUser)
</script>

<template>
  <v-app>
    <AppHeader />
    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>
