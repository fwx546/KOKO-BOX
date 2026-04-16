<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <view class="page-shell">
    <view class="app-card">
      <view class="topbar">
        <view class="h1-like">{{ t.app.appName }}</view>
      </view>

      <view class="view-container">
        <slot />
      </view>
    </view>
  </view>
</template>
