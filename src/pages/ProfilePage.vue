<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { isWechatCloudConfigured } from '../config/cloud'
import { useAuth } from '../composables/useAuth'

const { user, pet, loading, error, isMockSession, isLoggedIn, login, syncUserProfile, importWechatProfile } = useAuth()

interface WechatPrivacyApi {
  canIUse?: (schema: string) => boolean
  getPrivacySetting?: (options: {
    success?: (result: { needAuthorization?: boolean }) => void
    fail?: () => void
  }) => void
  requirePrivacyAuthorize?: (options?: {
    success?: () => void
    fail?: () => void
  }) => void
}

const getWechatApi = () => (globalThis as { wx?: WechatPrivacyApi }).wx

const displayName = computed(() => user.value?.nickName || 'Koko Friend')
const accountStatus = computed(() => {
  if (loading.value) {
    return 'Connecting...'
  }

  if (isLoggedIn.value) {
    return isMockSession.value ? 'Preview mode' : 'Account connected'
  }

  return isWechatCloudConfigured() ? 'Sign in to sync your profile' : 'Preview mode'
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

const handleChooseAvatar = (event: { detail?: { avatarUrl?: string } }) => {
  const avatarFilePath = event.detail?.avatarUrl

  if (avatarFilePath) {
    void importWechatProfile({
      nickName: user.value?.nickName,
      avatarFilePath,
    })
  }
}

const handleAvatarTap = () => {
  // #ifdef MP-WEIXIN
  const wxApi = getWechatApi()

  if (wxApi?.canIUse && !wxApi.canIUse('button.open-type.chooseAvatar')) {
    uni.showToast({
      title: 'Avatar import is not supported here',
      icon: 'none',
    })
    return
  }

  wxApi?.getPrivacySetting?.({
    success: (result) => {
      if (result.needAuthorization) {
        wxApi.requirePrivacyAuthorize?.({
          fail: () => {
            uni.showToast({
              title: 'Please allow privacy access first',
              icon: 'none',
            })
          },
        })
      }
    },
  })
  // #endif
}

onMounted(() => {
  void login()
})
</script>

<template>
  <view class="profile-page">
    <view class="profile-hero-card">
      <view class="profile-hero-banner">
        <view class="profile-eyebrow">Profile</view>
        <view class="profile-hero-title">A calm, bright home for your account details.</view>
        <view class="profile-hero-note">Keep your nickname, avatar, and companion details tidy in one place.</view>
      </view>

      <view class="profile-hero-top">
        <button
          class="profile-avatar profile-avatar-button"
          open-type="chooseAvatar"
          @click="handleAvatarTap"
          @chooseavatar="handleChooseAvatar"
        >
          <image v-if="user?.avatarUrl" :src="user.avatarUrl" mode="aspectFill" />
          <view v-else>{{ profileInitial }}</view>
        </button>

        <view class="profile-identity">
          <input
            class="profile-name-input"
            type="nickname"
            :value="displayName"
            placeholder="Tap to use your WeChat nickname"
            @blur="handleNicknameBlur"
          />
          <view class="profile-account-row">
            <view class="profile-status-dot" />
            <view>{{ accountStatus }}</view>
          </view>
          <view class="profile-profile-tip">Tap the avatar or nickname field to import your WeChat profile.</view>
        </view>

        <button
          v-if="shouldShowRetry"
          class="profile-retry-button"
          :disabled="loading"
          @click="handleLogin"
        >
          {{ loading ? 'Please wait' : 'Retry sign-in' }}
        </button>
      </view>

      <view class="profile-companion-card">
        <view>
          <view class="profile-section-label">Companion</view>
          <view class="profile-companion-title">{{ companionName }}</view>
          <view class="profile-companion-subtitle">{{ companionStage }} stage</view>
        </view>
        <view class="profile-pet-mark">KB</view>
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
        <view class="profile-menu-icon profile-menu-icon--sun">PL</view>
        <view>
          <view>Plans</view>
          <view>Daily rhythms, task lists, and light reminders</view>
        </view>
        <view class="profile-menu-arrow">-></view>
      </button>

      <button class="profile-menu-row" @click="openHardware">
        <view class="profile-menu-icon profile-menu-icon--mint">HW</view>
        <view>
          <view>Hardware</view>
          <view>Device pairing and sync overview</view>
        </view>
        <view class="profile-menu-arrow">-></view>
      </button>

      <button class="profile-menu-row" @click="openSettings">
        <view class="profile-menu-icon profile-menu-icon--sky">ST</view>
        <view>
          <view>Settings</view>
          <view>Privacy, reminders, and account preferences</view>
        </view>
        <view class="profile-menu-arrow">-></view>
      </button>
    </view>
  </view>
</template>
