<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { isWechatCloudConfigured } from '../config/cloud'
import { useAuth } from '../composables/useAuth'

const { user, pet, loading, error, isMockSession, isLoggedIn, login, syncUserProfile } = useAuth()

const displayName = computed(() => user.value?.nickName || 'Koko Friend')
const accountStatus = computed(() => {
  if (loading.value) {
    return 'Connecting...'
  }

  if (isLoggedIn.value) {
    return isMockSession.value ? 'Preview mode' : 'WeChat connected'
  }

  return isWechatCloudConfigured() ? 'Tap retry to connect' : 'Preview mode'
})
const companionName = computed(() => pet.value?.name || 'Koko')
const companionStage = computed(() => pet.value?.stage || 'growing')
const shouldShowRetry = computed(() => Boolean(error.value) || (!loading.value && !isLoggedIn.value))
const profileInitial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || 'K')
const statRows = computed(() => {
  const currentPet = pet.value ?? {
    mood: 82,
    health: 88,
    intimacy: 55,
  }

  return [
    { label: 'Mood', value: currentPet.mood },
    { label: 'Health', value: currentPet.health },
    { label: 'Bond', value: currentPet.intimacy },
  ]
})

const openPlanner = () => {
  uni.navigateTo({ url: '/pages/planner/index' })
}

const openHardware = () => {
  uni.navigateTo({ url: '/pages/hardware/index' })
}

const openSettings = () => {
  uni.navigateTo({ url: '/pages/settings/index' })
}

const handleLogin = () => {
  void login()
}

const handleNicknameBlur = (event: { detail?: { value?: string } }) => {
  const nickName = event.detail?.value?.trim()

  if (nickName && nickName !== user.value?.nickName) {
    void syncUserProfile({ nickName })
  }
}

onMounted(() => {
  void login()
})
</script>

<template>
  <view class="profile-page">
    <view class="profile-hero-card">
      <view class="profile-hero-top">
        <view class="profile-avatar">
          <image v-if="user?.avatarUrl" :src="user.avatarUrl" mode="aspectFill" />
          <view v-else>{{ profileInitial }}</view>
        </view>

        <view class="profile-identity">
          <input
            class="profile-name-input"
            type="text"
            :value="displayName"
            placeholder="Your nickname"
            @blur="handleNicknameBlur"
          />
          <view class="profile-account-row">
            <view class="profile-status-dot" />
            <view>{{ accountStatus }}</view>
          </view>
        </view>

        <button
          v-if="shouldShowRetry"
          class="profile-retry-button"
          :disabled="loading"
          @click="handleLogin"
        >
          {{ loading ? 'Wait' : 'Retry' }}
        </button>
      </view>

      <view class="profile-companion-card">
        <view>
          <view class="profile-section-label">Companion</view>
          <view class="profile-companion-title">{{ companionName }}</view>
          <view class="profile-companion-subtitle">{{ companionStage }} stage</view>
        </view>
        <view class="profile-pet-mark">K</view>
      </view>

      <view class="profile-stat-grid">
        <view v-for="item in statRows" :key="item.label" class="profile-stat-item">
          <view class="profile-stat-head">
            <view>{{ item.label }}</view>
            <view>{{ item.value }}</view>
          </view>
          <view class="profile-stat-track">
            <view class="profile-stat-fill" :style="{ width: `${item.value}%` }" />
          </view>
        </view>
      </view>

      <view v-if="error" class="profile-error-card">
        <view>Connection issue</view>
        <view>{{ error }}</view>
      </view>
    </view>

    <view class="profile-menu-card">
      <button class="profile-menu-row" @click="openPlanner">
        <view class="profile-menu-icon profile-menu-icon--sun">P</view>
        <view>
          <view>Plans</view>
          <view>Daily tasks and gentle reminders</view>
        </view>
        <view class="profile-menu-arrow">></view>
      </button>

      <button class="profile-menu-row" @click="openHardware">
        <view class="profile-menu-icon profile-menu-icon--mint">H</view>
        <view>
          <view>Hardware</view>
          <view>Bind device and sync status</view>
        </view>
        <view class="profile-menu-arrow">></view>
      </button>

      <button class="profile-menu-row" @click="openSettings">
        <view class="profile-menu-icon profile-menu-icon--sky">S</view>
        <view>
          <view>Settings</view>
          <view>Privacy, language, and preferences</view>
        </view>
        <view class="profile-menu-arrow">></view>
      </button>
    </view>
  </view>
</template>
