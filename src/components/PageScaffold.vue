<script setup lang="ts">
defineProps<{
  shellClass?: string
}>()
</script>

<template>
  <view class="page-shell" :class="shellClass">
    <view class="app-card">
      <view class="view-container">
        <slot />
      </view>
    </view>
  </view>
</template>
