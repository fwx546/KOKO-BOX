<script setup lang="ts">
import { useWechatShare } from '../../src/composables/useWechatShare'
import VoiceCallPage from '../../src/pages/VoiceCallPage.vue'

useWechatShare({
  path: '/pages/voice-call/index',
  query: {
    from: 'share',
    page: 'voice-call',
  },
})
</script>

<template>
  <VoiceCallPage />
</template>
