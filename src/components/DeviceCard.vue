<script setup lang="ts">
const props = defineProps<{
  name: string
  status: string
  detail: string
  accent: string
}>()
</script>

<template>
  <article class="device-card">
    <div class="device-card__dot" :style="{ background: props.accent }"></div>
    <div>
      <p class="device-card__name">{{ props.name }}</p>
      <p class="device-card__status">{{ props.status }}</p>
      <p class="device-card__detail">{{ props.detail }}</p>
    </div>
  </article>
</template>
