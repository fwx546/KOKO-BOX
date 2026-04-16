<script setup lang="ts">
import { computed } from 'vue'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()

const summaryCards = computed(() => t.value.profile.archiveCards.slice(0, 1))

const openPlanner = () => {
  uni.navigateTo({ url: '/pages/planner/index' })
}

const openHardware = () => {
  uni.navigateTo({ url: '/pages/hardware/index' })
}

const openSettings = () => {
  uni.navigateTo({ url: '/pages/settings/index' })
}
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.profile.eyebrow }}</view>
        <view>{{ t.profile.title }}</view>
      </view>
      <view>{{ t.profile.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block" v-for="item in summaryCards" :key="item.title">
        <view class="eyebrow">{{ item.label }}</view>
        <view>{{ item.title }}</view>
        <view>{{ item.description }}</view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">Core Modules</view>
        <view>Open feature pages</view>
        <view class="profile-shortcuts">
          <button class="profile-shortcut-button" @click="openPlanner">{{ t.nav.planner }}</button>
          <button class="profile-shortcut-button" @click="openHardware">{{ t.nav.hardware }}</button>
          <button class="profile-shortcut-button" @click="openSettings">{{ t.nav.settings }}</button>
        </view>
      </view>
    </view>
  </view>
</template>
