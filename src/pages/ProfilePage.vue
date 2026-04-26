<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useKokoState } from '../composables/useKokoState'

const { user, pet: authPet, authMode, isGuestSession, loading, importWechatProfile, login } = useAuth()
const { pet, weeklyCompletionRate, syncPetFromAuth } = useKokoState()

const displayName = computed(() => user.value?.nickName || (isGuestSession.value ? '游客' : 'Koko Friend'))
const accountModeLabel = computed(() => (isGuestSession.value ? '游客模式' : '微信账号'))
const profileInitial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || 'K')
const accountHint = computed(() =>
  isGuestSession.value ? '游客模式不会连接微信头像和账号信息。' : '账号信息已和当前微信小程序账号同步。',
)

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
          <view class="profile-hero__eyebrow">我的</view>
          <view class="profile-hero__name">{{ displayName }}</view>
          <view class="profile-hero__meta">{{ accountModeLabel }}</view>
        </view>

        <view class="profile-mode-pill">{{ isGuestSession ? 'Guest' : 'WeChat' }}</view>
      </view>

      <view class="profile-pet-pill">宠物：{{ pet.name }} · {{ pet.stage }}</view>
      <view class="profile-hero__hint">{{ accountHint }}</view>
    </view>

    <view class="profile-stats">
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">心情</view>
        <view class="profile-stat-item__value">{{ pet.mood }}</view>
        <view class="profile-stat-item__bar"><view class="profile-stat-item__fill profile-stat-item__fill--mood" :style="{ width: `${pet.mood}%` }" /></view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">亲密度</view>
        <view class="profile-stat-item__value">{{ pet.intimacy }}</view>
        <view class="profile-stat-item__bar"><view class="profile-stat-item__fill profile-stat-item__fill--bond" :style="{ width: `${pet.intimacy}%` }" /></view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">本周完成度</view>
        <view class="profile-stat-item__value">{{ weeklyCompletionRate }}%</view>
        <view class="profile-stat-item__bar"><view class="profile-stat-item__fill profile-stat-item__fill--done" :style="{ width: `${weeklyCompletionRate}%` }" /></view>
      </view>
    </view>

    <view class="profile-summary">
      <view class="profile-summary__title">{{ pet.name }} 当前状态</view>
      <view class="profile-summary__copy">处于 {{ pet.stage }} 阶段，继续保持互动和任务完成可以提升亲密度。</view>
    </view>

    <button class="profile-settings-entry" :disabled="loading" @click="openSettings">
      <view>设置</view>
      <view class="profile-settings-entry__hint">退出登录、切换语言、给宠物改名</view>
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
  background: linear-gradient(155deg, #ffffff, #f8fcfb);
  border: 2rpx solid #e9ddd0;
  border-radius: 30rpx;
  box-shadow: 0 12rpx 26rpx rgba(137, 120, 97, 0.08);
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
  background: linear-gradient(160deg, #ffdca7, #ffc59f);
  border-radius: 22rpx;
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
  background: #edf7f2;
  border-radius: 999rpx;
  color: #5f9579;
  font-size: 20rpx;
  font-weight: 700;
  padding: 8rpx 16rpx;
}

.profile-hero__eyebrow {
  color: #a18972;
  font-size: 22rpx;
  font-weight: 700;
}

.profile-hero__name {
  color: #26324f;
  font-size: 52rpx;
  font-weight: 800;
  line-height: 1.16;
}

.profile-hero__meta {
  color: #6f8b7c;
  font-size: 30rpx;
  font-weight: 600;
}

.profile-pet-pill {
  align-self: flex-start;
  background: #f8efe4;
  border-radius: 999rpx;
  color: #7d644f;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
}

.profile-hero__hint {
  color: #8d7a68;
  font-size: 23rpx;
}

.profile-stats {
  display: grid;
  gap: 10rpx;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-stat-item {
  background: #fffdf8;
  border: 2rpx solid #efe5d8;
  border-radius: 18rpx;
  padding: 16rpx;
}

.profile-stat-item__label {
  color: #9b846e;
  font-size: 22rpx;
}

.profile-stat-item__value {
  color: #2a3553;
  font-size: 34rpx;
  font-weight: 700;
  margin-top: 8rpx;
}

.profile-stat-item__bar {
  background: #efe8db;
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
  background: linear-gradient(90deg, #f3c764, #ecb54c);
}

.profile-stat-item__fill--bond {
  background: linear-gradient(90deg, #7ccfb7, #61c89d);
}

.profile-stat-item__fill--done {
  background: linear-gradient(90deg, #80c8e9, #62b4df);
}

.profile-summary {
  background: #fff;
  border: 2rpx solid #ece2d6;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 18rpx;
}

.profile-summary__title {
  color: #2c3653;
  font-size: 30rpx;
  font-weight: 700;
}

.profile-summary__copy {
  color: #8b7765;
  font-size: 24rpx;
  line-height: 1.5;
}

.profile-settings-entry {
  align-items: flex-start;
  background: linear-gradient(150deg, #ffffff, #f5faf8);
  border: 2rpx solid #efe5d8;
  border-radius: 20rpx;
  color: #2a3553;
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
  color: #8f7a66;
  font-size: 24rpx;
  font-weight: 500;
}
</style>
