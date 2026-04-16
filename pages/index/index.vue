<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

onLoad(() => {
  uni.switchTab({
    url: '/pages/home/index',
  })
})
</script>

<template>
  <view></view>
</template>
