<script setup lang="ts">
const props = defineProps<{
  label: string
  value: number
  hint: string
  color: string
}>()

const formattedValue = (value: number) => `${value}%`
</script>

<template>
  <article class="status-card">
    <div class="status-card__top">
      <div>
        <p class="status-card__label">{{ props.label }}</p>
        <p class="status-card__hint">{{ props.hint }}</p>
      </div>
      <span class="status-card__value" :style="{ color: props.color }">{{ formattedValue(props.value) }}</span>
    </div>
    <div class="status-card__track" aria-hidden="true">
      <span class="status-card__fill" :style="{ width: `${props.value}%`, background: props.color }"></span>
    </div>
  </article>
</template>
