<script setup lang="ts">
import PageScaffold from '../../src/components/PageScaffold.vue'
import PetCatchGamePage from '../../src/pages/PetCatchGamePage.vue'
import { useWechatShare } from '../../src/composables/useWechatShare'

useWechatShare({
  path: '/pages/pet-game-catch/index',
})
</script>

<template>
  <PageScaffold>
    <PetCatchGamePage />
  </PageScaffold>
</template>
