<script setup>
// Renders a submission's per-parameter jury scores as compact chips.
defineProps({
  scores: { type: Object, default: null },
})
</script>

<template>
  <div
    v-if="scores && Object.keys(scores).length"
    class="d-flex flex-wrap ga-1 mt-1"
  >
    <v-chip
      v-for="(value, name) in scores"
      :key="name"
      size="x-small"
      label
      variant="tonal"
      color="primary"
    >
      {{ name }}: {{ value }}
    </v-chip>
  </div>
</template>
