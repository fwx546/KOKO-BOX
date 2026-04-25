<script setup lang="ts">
import PageScaffold from '../../src/components/PageScaffold.vue'
import { useWechatShare } from '../../src/composables/useWechatShare'
import PlannerPage from '../../src/pages/PlannerPage.vue'

useWechatShare({
  path: '/pages/planner/index',
  query: {
    from: 'share',
    page: 'planner',
  },
})
</script>

<template>
  <PageScaffold shell-class="page-shell--planner-fixed">
    <PlannerPage />
  </PageScaffold>
</template>

<style>
page {
  height: 100%;
  overflow: hidden;
}
</style>
