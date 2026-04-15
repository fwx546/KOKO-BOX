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
  <view class="status-card">
    <view class="status-card__top">
      <view>
        <view class="status-card__label">{{ props.label }}</view>
        <view class="status-card__hint">{{ props.hint }}</view>
      </view>
      <view class="status-card__value" :style="{ color: props.color }">{{ formattedValue(props.value) }}</view>
    </view>
    <view class="status-card__track">
      <view class="status-card__fill" :style="{ width: `${props.value}%`, background: props.color }"></view>
    </view>
  </view>
</template>
