<script setup>
defineProps({
  title: { type: String, required: true },
  icon: { type: String, required: true },
  // Fill the parent column's height (for equal-height cards in a row).
  fillHeight: { type: Boolean, default: false },
})
</script>

<template>
  <v-card
    :class="fillHeight ? undefined : 'mb-4'"
    :height="fillHeight ? '100%' : undefined"
  >
    <v-card-title class="bg-primary d-flex align-center ga-2 py-3">
      <v-icon :icon="icon" size="small" />
      <span class="text-body-1 font-weight-bold">{{ title }}</span>
    </v-card-title>
    <v-card-text class="pa-5">
      <slot />
    </v-card-text>
  </v-card>
</template>
