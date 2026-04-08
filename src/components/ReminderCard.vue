<script setup lang="ts">
const props = defineProps<{
  title: string
  subtitle: string
  tone: 'sun' | 'mint' | 'peach'
  badge: string
}>()

const toneClasses = {
  sun: 'reminder-card--sun',
  mint: 'reminder-card--mint',
  peach: 'reminder-card--peach',
}
</script>

<template>
  <article class="reminder-card" :class="toneClasses[props.tone]">
    <div class="reminder-card__badge">{{ props.badge }}</div>
    <div>
      <h3 class="reminder-card__title">{{ props.title }}</h3>
      <p class="reminder-card__subtitle">{{ props.subtitle }}</p>
    </div>
  </article>
</template>
