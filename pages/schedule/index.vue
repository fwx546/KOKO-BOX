<script setup lang="ts">
import PageScaffold from '../../src/components/PageScaffold.vue'
import { useWechatShare } from '../../src/composables/useWechatShare'
import SchedulePage from '../../src/pages/SchedulePage.vue'

useWechatShare({
  path: '/pages/schedule/index',
  query: {
    from: 'share',
    page: 'schedule',
  },
})
</script>

<template>
  <PageScaffold shell-class="page-shell--planner-fixed">
    <SchedulePage />
  </PageScaffold>
</template>

<style>
page {
  background: #fff8ec;
  min-height: 100%;
  overflow-y: auto;
}
</style>
