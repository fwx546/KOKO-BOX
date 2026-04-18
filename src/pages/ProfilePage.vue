<script setup lang="ts">
import { computed } from 'vue'
import { useLanguage } from '../composables/useLanguage'
import { isWechatCloudConfigured } from '../config/cloud'
import { useAuth } from '../composables/useAuth'

const { t } = useLanguage()
const { user, pet, loading, error, isMockSession, isLoggedIn, login, syncUserProfile } = useAuth()

const summaryCards = computed(() => t.value.profile.archiveCards.slice(0, 1))
const loginStatusText = computed(() => {
  if (loading.value) {
    return 'Logging in...'
  }

  if (isLoggedIn.value) {
    return isMockSession.value ? 'H5 mock session' : 'WeChat cloud session active'
  }

  return isWechatCloudConfigured() ? 'Not logged in' : 'Cloud env not configured, using H5-safe mock mode'
})

const petStats = computed(() => {
  if (!pet.value) {
    return []
  }

  return [
    { label: 'Mood', value: pet.value.mood },
    { label: 'Health', value: pet.value.health },
    { label: 'Intimacy', value: pet.value.intimacy },
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

const handleChooseAvatar = (event: { detail?: { avatarUrl?: string } }) => {
  void syncUserProfile({
    avatarUrl: event.detail?.avatarUrl,
  })
}

const handleNicknameBlur = (event: { detail?: { value?: string } }) => {
  const nickName = event.detail?.value?.trim()

  if (nickName) {
    void syncUserProfile({ nickName })
  }
}

void login()
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
      <view class="panel-block panel-block--full auth-card">
        <view class="eyebrow">WeChat Login</view>
        <view>Account status</view>
        <view class="auth-card__body">
          <view class="auth-card__avatar">
            <image v-if="user?.avatarUrl" :src="user.avatarUrl" mode="aspectFill" />
            <view v-else>K</view>
          </view>
          <view class="auth-card__main">
            <view class="auth-card__name">{{ user?.nickName || 'Koko Friend' }}</view>
            <view class="muted-line">{{ loginStatusText }}</view>
            <view v-if="pet" class="auth-card__pet">
              <view>{{ pet.name }} · {{ pet.stage }}</view>
              <view v-for="item in petStats" :key="item.label">{{ item.label }} {{ item.value }}</view>
            </view>
            <view v-if="error" class="auth-card__error">{{ error }}</view>
          </view>
        </view>

        <view class="auth-card__actions">
          <button class="profile-shortcut-button" :disabled="loading" @click="handleLogin">
            {{ loading ? 'Logging in...' : '微信自动登录' }}
          </button>
          <button class="profile-shortcut-button" open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
            同步头像
          </button>
          <input
            class="auth-card__nickname"
            type="nickname"
            :value="user?.nickName || ''"
            placeholder="同步微信昵称"
            @blur="handleNicknameBlur"
          />
        </view>
      </view>

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
