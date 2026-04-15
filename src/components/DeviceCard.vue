<script setup lang="ts">
const props = defineProps<{
  name: string
  status: string
  detail: string
  accent: string
}>()
</script>

<template>
  <view class="device-card">
    <view class="device-card__dot" :style="{ background: props.accent }"></view>
    <view>
      <view class="device-card__name">{{ props.name }}</view>
      <view class="device-card__status">{{ props.status }}</view>
      <view class="device-card__detail">{{ props.detail }}</view>
    </view>
  </view>
</template>
