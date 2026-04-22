<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { isWechatCloudConfigured } from '../config/cloud'
import { useAuth } from '../composables/useAuth'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
const { user, pet: authPet, loading, error, isMockSession, isLoggedIn, login, syncUserProfile } = useAuth()
const { pet, archive, metrics, weeklyCompletionRate, syncPetFromAuth } = useKokoState()

const displayName = computed(() => user.value?.nickName || 'Koko Friend')
const accountStatus = computed(() => {
  if (loading.value) {
    return '连接中...'
  }

  if (isLoggedIn.value) {
    return isMockSession.value ? '预览模式' : '微信已连接'
  }

  return isWechatCloudConfigured() ? '点击重试连接' : '预览模式'
})

const shouldShowRetry = computed(() => Boolean(error.value) || (!loading.value && !isLoggedIn.value))
const profileInitial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || 'K')

const openPage = (url: string) => {
  uni.navigateTo({ url })
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

watch(
  () => authPet.value,
  (value) => {
    syncPetFromAuth(value ?? undefined)
  },
  { immediate: true },
)

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
        <button class="profile-avatar profile-avatar-button" open-type="chooseAvatar">
          <image v-if="user?.avatarUrl" :src="user.avatarUrl" mode="aspectFill" />
          <view v-else>{{ profileInitial }}</view>
        </button>

        <view class="profile-identity">
          <input
            class="profile-name-input"
            type="nickname"
            :value="displayName"
            placeholder="你的昵称"
            @blur="handleNicknameBlur"
          />
          <view class="profile-account-row">
            <view class="profile-status-dot" />
            <view>{{ accountStatus }}</view>
          </view>
          <view class="profile-profile-tip">Tap the avatar or nickname field to import your WeChat profile.</view>
        </view>

<<<<<<< HEAD
        <button v-if="shouldShowRetry" class="profile-retry-button" :disabled="loading" @click="handleLogin">
          {{ loading ? '请稍候' : '重试连接' }}
        </button>
      </view>

      <view class="profile-companion-card">
        <view>
          <view class="profile-section-label">Companion</view>
          <view class="profile-companion-title">{{ pet.name }}</view>
          <view class="profile-companion-subtitle">{{ pet.stage }} · {{ pet.state }}</view>
        </view>
        <view class="profile-pet-mark">KB</view>
      </view>

      <view class="profile-stat-grid">
        <view class="profile-stat-item">
          <view class="profile-stat-head">
            <view>心情</view>
            <view>{{ pet.mood }}</view>
          </view>
          <view class="profile-stat-track"><view class="profile-stat-fill" :style="{ width: `${pet.mood}%` }" /></view>
        </view>
        <view class="profile-stat-item">
          <view class="profile-stat-head">
            <view>亲密度</view>
            <view>{{ pet.intimacy }}</view>
          </view>
          <view class="profile-stat-track"><view class="profile-stat-fill" :style="{ width: `${pet.intimacy}%` }" /></view>
        </view>
        <view class="profile-stat-item">
          <view class="profile-stat-head">
            <view>完成率</view>
            <view>{{ weeklyCompletionRate }}%</view>
          </view>
          <view class="profile-stat-track"><view class="profile-stat-fill" :style="{ width: `${weeklyCompletionRate}%` }" /></view>
        </view>
      </view>

      <view v-if="error" class="profile-error-card">
        <view>连接异常</view>
        <view>{{ error }}</view>
      </view>
    </view>

    <view class="panel-block">
      <view class="eyebrow">{{ t.profile.archiveLabel }}</view>
      <view>{{ t.profile.archiveTitle }}</view>
      <view class="archive-grid">
        <view class="archive-item">
          <view>领养时间</view>
          <view>{{ archive.adoptedAt }}</view>
        </view>
        <view class="archive-item">
          <view>陪伴时长</view>
          <view>{{ metrics.companionMinutes }} 分钟</view>
        </view>
        <view class="archive-item">
          <view>最近病史</view>
          <view>{{ archive.medicalLogs[0]?.note || '暂无' }}</view>
        </view>
        <view class="archive-item">
          <view>最近里程碑</view>
          <view>{{ archive.milestones[0]?.title || '暂无' }}</view>
        </view>
      </view>
    </view>

    <view class="profile-menu-card">
      <button class="profile-menu-row" @click="openPage('/pages/planner/index')">
        <view class="profile-menu-icon profile-menu-icon--sun">P</view>
        <view>
          <view>计划</view>
          <view>管理待办和完成奖励</view>
        </view>
        <view class="profile-menu-arrow">-></view>
      </button>

      <button class="profile-menu-row" @click="openPage('/pages/hardware/index')">
        <view class="profile-menu-icon profile-menu-icon--mint">H</view>
        <view>
          <view>硬件</view>
          <view>查看三端联动状态和同步日志</view>
        </view>
        <view class="profile-menu-arrow">-></view>
      </button>

      <button class="profile-menu-row" @click="openPage('/pages/settings/index')">
        <view class="profile-menu-icon profile-menu-icon--sky">S</view>
        <view>
          <view>设置</view>
          <view>切换语言、隐私和 Demo 模式</view>
        </view>
        <view class="profile-menu-arrow">-></view>
      </button>
    </view>
  </view>
</template>
