<script setup lang="ts">
import PageScaffold from '../../src/components/PageScaffold.vue'
import PetBubbleGamePage from '../../src/pages/PetBubbleGamePage.vue'
import { useWechatShare } from '../../src/composables/useWechatShare'

useWechatShare({
  path: '/pages/pet-game-bubble/index',
})
</script>

<template>
  <PageScaffold>
    <PetBubbleGamePage />
  </PageScaffold>
</template>
