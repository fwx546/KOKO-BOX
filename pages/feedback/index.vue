<script setup lang="ts">
import PageScaffold from '../../src/components/PageScaffold.vue'
import { useWechatShare } from '../../src/composables/useWechatShare'
import FeedbackPage from '../../src/pages/FeedbackPage.vue'

useWechatShare({
  path: '/pages/feedback/index',
  query: {
    from: 'share',
    page: 'feedback',
  },
})
</script>

<template>
  <PageScaffold>
    <FeedbackPage />
  </PageScaffold>
</template>
