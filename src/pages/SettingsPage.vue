<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { language, setLanguage } = useLanguage()
const { pet, syncPetFromAuth, updateSettings } = useKokoState()
const { authMode, isGuestSession, pet: authPet, syncUserProfile, logout } = useAuth()

const petNameInput = ref(pet.value.name)
const renaming = ref(false)

const renameHint = computed(() =>
  isGuestSession.value
    ? '游客模式下宠物名固定为 koko。'
    : '改名会同步到云端，换设备登录后仍保持一致。',
)

watch(
  () => authPet.value?.name,
  (name) => {
    if (name) {
      petNameInput.value = name
    }
  },
  { immediate: true },
)

const changeLanguage = (next: 'zh' | 'en') => {
  setLanguage(next)
  updateSettings({ language: next })
}

const renamePet = async () => {
  if (isGuestSession.value) {
    uni.showToast({
      title: '游客模式宠物名固定为 koko',
      icon: 'none',
    })
    return
  }

  const nextName = petNameInput.value.trim()

  if (!nextName) {
    uni.showToast({
      title: '请输入宠物名',
      icon: 'none',
    })
    return
  }

  if (nextName.length > 12) {
    uni.showToast({
      title: '宠物名最多 12 个字符',
      icon: 'none',
    })
    return
  }

  if (nextName === authPet.value?.name) {
    uni.showToast({
      title: '名字没有变化',
      icon: 'none',
    })
    return
  }

  renaming.value = true

  try {
    await syncUserProfile({
      petName: nextName,
    })

    syncPetFromAuth({
      ...(authPet.value ?? {}),
      name: nextName,
    })

    petNameInput.value = nextName

    uni.showToast({
      title: '已更新宠物名',
      icon: 'success',
    })
  } finally {
    renaming.value = false
  }
}

const confirmLogout = () =>
  new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '退出登录',
      content: '确认退出当前账号吗？',
      confirmText: '退出',
      cancelText: '取消',
      success: (result) => {
        resolve(Boolean(result.confirm))
      },
      fail: () => {
        resolve(false)
      },
    })
  })

const handleLogout = async () => {
  const confirmed = await confirmLogout()

  if (!confirmed) {
    return
  }

  await logout()

  uni.reLaunch({
    url: '/pages/index/index',
  })
}
</script>

<template>
  <view class="settings-page">
    <view class="settings-panel">
      <view class="settings-title">设置</view>
      <view class="settings-subtitle">仅保留核心操作，减少干扰。</view>

      <view class="settings-block">
        <view class="settings-block__label">切换语言</view>
        <view class="language-switch">
          <button
            class="language-switch__button"
            :class="{ 'language-switch__button--active': language === 'zh' }"
            @click="changeLanguage('zh')"
          >
            中文
          </button>
          <button
            class="language-switch__button"
            :class="{ 'language-switch__button--active': language === 'en' }"
            @click="changeLanguage('en')"
          >
            English
          </button>
        </view>
      </view>

      <view class="settings-block">
        <view class="settings-block__label">给宠物改名</view>
        <input
          class="settings-input"
          maxlength="12"
          :value="petNameInput"
          placeholder="输入新的宠物名"
          @input="(event) => (petNameInput = event.detail?.value ?? '')"
        />
        <view class="settings-block__hint">{{ renameHint }}</view>
        <button class="settings-button" :disabled="renaming" @click="renamePet">
          {{ renaming ? '保存中...' : '保存宠物名' }}
        </button>
      </view>

      <view class="settings-block">
        <view class="settings-block__label">退出登录</view>
        <view class="settings-block__hint">退出后会回到登录页。当前登录方式：{{ authMode || '未登录' }}</view>
        <button class="settings-button settings-button--danger" @click="handleLogout">退出登录</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.settings-page {
  padding: 28rpx;
}

.settings-panel {
  background: #fff;
  border: 2rpx solid #ece2d7;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 24rpx;
}

.settings-title {
  color: #2a3553;
  font-size: 40rpx;
  font-weight: 800;
}

.settings-subtitle {
  color: #8f7a66;
  font-size: 24rpx;
}

.settings-block {
  background: #fcf8f2;
  border-radius: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 18rpx;
}

.settings-block__label {
  color: #2c3653;
  font-size: 30rpx;
  font-weight: 700;
}

.settings-block__hint {
  color: #907d69;
  font-size: 24rpx;
}

.language-switch {
  display: flex;
  gap: 10rpx;
}

.language-switch__button {
  background: #efe4d7;
  border-radius: 14rpx;
  color: #7d634d;
  font-size: 26rpx;
  line-height: 1;
  margin: 0;
  padding: 16rpx 18rpx;
}

.language-switch__button::after {
  border: 0;
}

.language-switch__button--active {
  background: #2f3d5f;
  color: #fff;
}

.settings-input {
  background: #fff;
  border: 2rpx solid #e7d8c7;
  border-radius: 12rpx;
  color: #2a3553;
  font-size: 28rpx;
  padding: 14rpx 16rpx;
}

.settings-button {
  background: #2f3d5f;
  border-radius: 14rpx;
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
  margin: 0;
  padding: 18rpx 20rpx;
}

.settings-button::after {
  border: 0;
}

.settings-button--danger {
  background: #b34747;
}
</style>
