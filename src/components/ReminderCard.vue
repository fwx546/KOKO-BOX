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
  <view class="reminder-card" :class="toneClasses[props.tone]">
    <view class="reminder-card__badge">{{ props.badge }}</view>
    <view>
      <view class="reminder-card__title">{{ props.title }}</view>
      <view class="reminder-card__subtitle">{{ props.subtitle }}</view>
    </view>
  </view>
</template>
