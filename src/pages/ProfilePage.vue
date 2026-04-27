<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { user, pet: authPet, authMode, isGuestSession, loading, importWechatProfile, login } = useAuth()
const { pet, weeklyCompletionRate, syncPetFromAuth, syncCourseScheduleFromCloud } = useKokoState()
const { t } = useLanguage()

const displayName = computed(() => user.value?.nickName || (isGuestSession.value ? t.value.profile.guest : 'Koko Friend'))
const accountModeLabel = computed(() => (isGuestSession.value ? t.value.profile.guestMode : t.value.profile.wechatAccount))
const profileInitial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || 'K')
const accountHint = computed(() => (isGuestSession.value ? t.value.profile.guestHint : t.value.profile.accountHint))
const petStageLabel = computed(() => t.value.profile.stages[pet.value.stage] ?? pet.value.stage)

const openSettings = () => {
  uni.navigateTo({
    url: '/pages/settings/index',
  })
}

const handleChooseAvatar = (event: { detail?: { avatarUrl?: string } }) => {
  if (isGuestSession.value) {
    return
  }

  const avatarFilePath = event.detail?.avatarUrl

  if (!avatarFilePath) {
    return
  }

  void importWechatProfile({
    nickName: user.value?.nickName,
    avatarFilePath,
  })
}

watch(
  () => authPet.value,
  (value) => {
    syncPetFromAuth(value ?? undefined)
  },
  { immediate: true },
)

onMounted(async () => {
  const result = await login(authMode.value ?? 'wechat')
  syncPetFromAuth(result.pet)
  if (authMode.value !== 'guest') {
    await syncCourseScheduleFromCloud()
  }
})
</script>

<template>
  <view class="profile-page">
    <view class="profile-hero">
      <view class="profile-hero__top">
        <button
          v-if="!isGuestSession"
          class="profile-avatar profile-avatar--button"
          open-type="chooseAvatar"
          @chooseavatar="handleChooseAvatar"
        >
          <image v-if="user?.avatarUrl" class="profile-avatar__image" :src="user.avatarUrl" mode="aspectFill" />
          <view v-else class="profile-avatar__fallback">{{ profileInitial }}</view>
        </button>
        <view v-else class="profile-avatar">
          <view class="profile-avatar__fallback">{{ profileInitial }}</view>
        </view>

        <view class="profile-hero__main">
          <view class="profile-hero__eyebrow">{{ t.profile.eyebrow }}</view>
          <view class="profile-hero__name">{{ displayName }}</view>
          <view class="profile-hero__meta">{{ accountModeLabel }}</view>
        </view>

        <view class="profile-mode-pill">{{ isGuestSession ? 'Guest' : 'WeChat' }}</view>
      </view>

      <view class="profile-pet-pill">{{ t.profile.pet }}: {{ pet.name }} · {{ petStageLabel }}</view>
      <view class="profile-hero__hint">{{ accountHint }}</view>
    </view>

    <view class="profile-stats">
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">{{ t.profile.mood }}</view>
        <view class="profile-stat-item__value">{{ pet.mood }}</view>
        <view class="profile-stat-item__bar"><view class="profile-stat-item__fill profile-stat-item__fill--mood" :style="{ width: `${pet.mood}%` }" /></view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">{{ t.profile.intimacy }}</view>
        <view class="profile-stat-item__value">{{ pet.intimacy }}</view>
        <view class="profile-stat-item__bar"><view class="profile-stat-item__fill profile-stat-item__fill--bond" :style="{ width: `${pet.intimacy}%` }" /></view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">{{ t.profile.weeklyCompletion }}</view>
        <view class="profile-stat-item__value">{{ weeklyCompletionRate }}%</view>
        <view class="profile-stat-item__bar"><view class="profile-stat-item__fill profile-stat-item__fill--done" :style="{ width: `${weeklyCompletionRate}%` }" /></view>
      </view>
    </view>

    <view class="profile-summary">
      <view class="profile-summary__title">{{ pet.name }} {{ t.profile.currentStatus }}</view>
      <view class="profile-summary__copy">{{ t.profile.stageCopy.replace('{stage}', petStageLabel) }}</view>
    </view>

    <button class="profile-settings-entry" :disabled="loading" @click="openSettings">
      <view>{{ t.profile.settings }}</view>
      <view class="profile-settings-entry__hint">{{ t.profile.settingsHint }}</view>
    </button>
  </view>
</template>

<style scoped>
.profile-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  min-height: 100%;
  padding: 24rpx;
}

.profile-hero {
  background:
    linear-gradient(155deg, rgba(255, 255, 255, 0.96), rgba(255, 248, 236, 0.94)),
    #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 30rpx;
  box-shadow: 0 16rpx 34rpx rgba(167, 124, 72, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 22rpx;
}

.profile-hero__top {
  align-items: center;
  display: flex;
  gap: 16rpx;
}

.profile-avatar {
  background: linear-gradient(160deg, #ffe39a, #ffc9b6);
  border-radius: 24rpx;
  height: 108rpx;
  overflow: hidden;
  width: 108rpx;
}

.profile-avatar--button {
  margin: 0;
  padding: 0;
}

.profile-avatar--button::after {
  border: 0;
}

.profile-avatar__image,
.profile-avatar__fallback {
  height: 100%;
  width: 100%;
}

.profile-avatar__fallback {
  align-items: center;
  color: #6d5542;
  display: flex;
  font-size: 42rpx;
  font-weight: 800;
  justify-content: center;
}

.profile-hero__main {
  flex: 1;
  min-width: 0;
}

.profile-mode-pill {
  background: #e8f7ef;
  border-radius: 999rpx;
  color: #365f56;
  font-size: 20rpx;
  font-weight: 700;
  padding: 8rpx 16rpx;
}

.profile-hero__eyebrow {
  color: #8a7a68;
  font-size: 22rpx;
  font-weight: 700;
}

.profile-hero__name {
  color: #253047;
  font-size: 52rpx;
  font-weight: 800;
  line-height: 1.16;
}

.profile-hero__meta {
  color: #5f8c78;
  font-size: 30rpx;
  font-weight: 600;
}

.profile-pet-pill {
  align-self: flex-start;
  background: #fff0ca;
  border-radius: 999rpx;
  color: #7d644f;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
}

.profile-hero__hint {
  color: #8a7a68;
  font-size: 23rpx;
}

.profile-stats {
  display: grid;
  gap: 10rpx;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-stat-item,
.profile-summary,
.profile-settings-entry {
  background: #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 22rpx;
  box-shadow: 0 12rpx 26rpx rgba(167, 124, 72, 0.08);
}

.profile-stat-item {
  padding: 16rpx;
}

.profile-stat-item__label,
.profile-summary__copy,
.profile-settings-entry__hint {
  color: #8a7a68;
}

.profile-stat-item__label {
  font-size: 22rpx;
}

.profile-stat-item__value {
  color: #253047;
  font-size: 34rpx;
  font-weight: 700;
  margin-top: 8rpx;
}

.profile-stat-item__bar {
  background: rgba(228, 213, 194, 0.64);
  border-radius: 999rpx;
  height: 10rpx;
  margin-top: 10rpx;
  overflow: hidden;
}

.profile-stat-item__fill {
  border-radius: inherit;
  height: 100%;
}

.profile-stat-item__fill--mood {
  background: linear-gradient(90deg, #f8cb64, #f0b94a);
}

.profile-stat-item__fill--bond {
  background: linear-gradient(90deg, #8adfb0, #5fc7a8);
}

.profile-stat-item__fill--done {
  background: linear-gradient(90deg, #8ad8ff, #6ebfea);
}

.profile-summary {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 18rpx;
}

.profile-summary__title {
  color: #253047;
  font-size: 30rpx;
  font-weight: 700;
}

.profile-summary__copy {
  font-size: 24rpx;
  line-height: 1.5;
}

.profile-settings-entry {
  align-items: flex-start;
  color: #253047;
  display: flex;
  flex-direction: column;
  font-size: 32rpx;
  font-weight: 700;
  gap: 6rpx;
  line-height: 1.2;
  margin-top: 2rpx;
  padding: 22rpx;
  text-align: left;
}

.profile-settings-entry::after {
  border: 0;
}

.profile-settings-entry__hint {
  font-size: 24rpx;
  font-weight: 500;
}
</style>
