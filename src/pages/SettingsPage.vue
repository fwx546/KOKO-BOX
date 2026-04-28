<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import { syncNativeLanguageUi } from '../utils/nativeLanguageUi'

const { language, setLanguage, t } = useLanguage()
const { pet, syncPetFromAuth, updateSettings } = useKokoState()
const { authMode, isGuestSession, pet: authPet, syncUserProfile, logout } = useAuth()

const petNameInput = ref(pet.value.name)
const renaming = ref(false)

const renameHint = computed(() =>
  isGuestSession.value
    ? t.value.settings.guestRenameHint
    : t.value.settings.renameHint,
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
  syncNativeLanguageUi(next)
}

const openFeedback = () => {
  uni.navigateTo({
    url: '/pages/feedback/index',
  })
}

const renamePet = async () => {
  if (isGuestSession.value) {
    uni.showToast({
      title: t.value.settings.guestNameFixed,
      icon: 'none',
    })
    return
  }

  const nextName = petNameInput.value.trim()

  if (!nextName) {
    uni.showToast({
      title: t.value.settings.emptyPetName,
      icon: 'none',
    })
    return
  }

  if (nextName.length > 12) {
    uni.showToast({
      title: t.value.settings.petNameTooLong,
      icon: 'none',
    })
    return
  }

  if (nextName === authPet.value?.name) {
    uni.showToast({
      title: t.value.settings.nameUnchanged,
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
      title: t.value.settings.nameUpdated,
      icon: 'success',
    })
  } finally {
    renaming.value = false
  }
}

const confirmLogout = () =>
  new Promise<boolean>((resolve) => {
    uni.showModal({
      title: t.value.settings.logoutTitle,
      content: t.value.settings.logoutContent,
      confirmText: t.value.settings.logoutConfirm,
      cancelText: t.value.settings.cancel,
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
      <view class="settings-title">{{ t.settings.title }}</view>
      <view class="settings-subtitle">{{ t.settings.subtitle }}</view>

      <view class="settings-block">
        <view class="settings-block__label">{{ t.settings.languageLabel }}</view>
        <view class="language-switch">
          <button
            class="language-switch__button"
            :class="{ 'language-switch__button--active': language === 'zh' }"
            @click="changeLanguage('zh')"
          >
            {{ t.app.langChinese }}
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
        <view class="settings-block__label">{{ t.settings.petNameLabel }}</view>
        <input
          class="settings-input"
          maxlength="12"
          :value="petNameInput"
          :placeholder="t.settings.petNamePlaceholder"
          @input="(event) => (petNameInput = event.detail?.value ?? '')"
        />
        <view class="settings-block__hint">{{ renameHint }}</view>
        <button class="settings-button" :disabled="renaming" @click="renamePet">
          {{ renaming ? t.settings.saving : t.settings.savePetName }}
        </button>
      </view>

      <view class="settings-block">
        <view class="settings-block__label">投诉与建议</view>
        <view class="settings-block__hint">提交后仅本人和管理员可见，发送后不可编辑。</view>
        <button class="settings-button settings-button--secondary" @click="openFeedback">进入投诉与建议</button>
      </view>

      <view class="settings-block">
        <view class="settings-block__label">{{ t.settings.logoutLabel }}</view>
        <view class="settings-block__hint">
          {{ t.settings.logoutHint.replace('{mode}', authMode || t.settings.notLoggedIn) }}
        </view>
        <button class="settings-button settings-button--danger" @click="handleLogout">{{ t.settings.logoutLabel }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.settings-page {
  padding: 28rpx;
}

.settings-panel {
  background: #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 28rpx;
  box-shadow: 0 16rpx 34rpx rgba(167, 124, 72, 0.1);
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 24rpx;
}

.settings-title {
  color: #253047;
  font-size: 40rpx;
  font-weight: 800;
}

.settings-subtitle {
  color: #8a7a68;
  font-size: 24rpx;
}

.settings-block {
  background: rgba(255, 248, 236, 0.82);
  border: 2rpx solid rgba(176, 143, 102, 0.12);
  border-radius: 22rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 18rpx;
}

.settings-block__label {
  color: #253047;
  font-size: 30rpx;
  font-weight: 700;
}

.settings-block__hint {
  color: #8a7a68;
  font-size: 24rpx;
  line-height: 1.45;
}

.language-switch {
  display: flex;
  gap: 10rpx;
}

.language-switch__button {
  background: rgba(255, 255, 255, 0.74);
  border-radius: 999rpx;
  color: #8a7a68;
  font-size: 26rpx;
  line-height: 1;
  margin: 0;
  padding: 16rpx 22rpx;
}

.language-switch__button::after {
  border: 0;
}

.language-switch__button--active {
  background: #e8f7ef;
  color: #365f56;
}

.settings-input {
  background: #fff;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 18rpx;
  color: #253047;
  font-size: 28rpx;
  padding: 14rpx 16rpx;
}

.settings-button {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  border-radius: 999rpx;
  color: #173f38;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1;
  margin: 0;
  padding: 20rpx;
}

.settings-button::after {
  border: 0;
}

.settings-button--danger {
  background: #ffe4df;
  color: #b85454;
}

.settings-button--secondary {
  background: #e8f7ef;
  color: #365f56;
}
</style>
