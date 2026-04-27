<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { watch } from 'vue'
import { useLanguage } from '../composables/useLanguage'
import { syncNativeLanguageUi } from '../utils/nativeLanguageUi'

defineProps<{
  shellClass?: string
}>()

const { language } = useLanguage()

onShow(() => {
  syncNativeLanguageUi(language.value)
})

watch(language, (value) => {
  syncNativeLanguageUi(value)
})
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
