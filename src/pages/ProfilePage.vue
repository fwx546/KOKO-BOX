<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useKokoState } from '../composables/useKokoState'

const { user, pet: authPet, authMode, isGuestSession, login } = useAuth()
const { pet, weeklyCompletionRate, syncPetFromAuth } = useKokoState()

const displayName = computed(() => user.value?.nickName || (isGuestSession.value ? '游客' : 'Koko Friend'))
const accountModeLabel = computed(() => (isGuestSession.value ? '游客模式' : '微信账号'))

const openSettings = () => {
  uni.navigateTo({
    url: '/pages/settings/index',
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
      <view class="profile-hero__eyebrow">我的</view>
      <view class="profile-hero__name">{{ displayName }}</view>
      <view class="profile-hero__meta">{{ accountModeLabel }}</view>
      <view class="profile-pet-pill">宠物：{{ pet.name }} · {{ pet.stage }}</view>
    </view>

    <view class="profile-stats">
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">心情</view>
        <view class="profile-stat-item__value">{{ pet.mood }}</view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">亲密度</view>
        <view class="profile-stat-item__value">{{ pet.intimacy }}</view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-item__label">本周完成度</view>
        <view class="profile-stat-item__value">{{ weeklyCompletionRate }}%</view>
      </view>
    </view>

    <button class="profile-settings-entry" @click="openSettings">
      <view>设置</view>
      <view class="profile-settings-entry__hint">退出登录、切换语言、给宠物改名</view>
    </button>
  </view>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 28rpx;
}

.profile-hero {
  background: #fff;
  border: 2rpx solid #ece2d7;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx;
}

.profile-hero__eyebrow {
  color: #a18972;
  font-size: 24rpx;
  font-weight: 600;
}

.profile-hero__name {
  color: #26324f;
  font-size: 46rpx;
  font-weight: 800;
  line-height: 1.2;
}

.profile-hero__meta {
  color: #7d6b5c;
  font-size: 26rpx;
}

.profile-pet-pill {
  align-self: flex-start;
  background: #f8f1e6;
  border-radius: 999rpx;
  color: #7d644f;
  font-size: 24rpx;
  margin-top: 6rpx;
  padding: 8rpx 18rpx;
}

.profile-stats {
  display: grid;
  gap: 14rpx;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-stat-item {
  background: #fff;
  border: 2rpx solid #efe5d8;
  border-radius: 20rpx;
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

.profile-settings-entry {
  align-items: flex-start;
  background: #fff;
  border: 2rpx solid #efe5d8;
  border-radius: 20rpx;
  color: #2a3553;
  display: flex;
  flex-direction: column;
  font-size: 32rpx;
  font-weight: 700;
  gap: 6rpx;
  line-height: 1.2;
  margin-top: 4rpx;
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
