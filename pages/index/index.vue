<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageScaffold from '../../src/components/PageScaffold.vue'
import { useAuth } from '../../src/composables/useAuth'

const { loading, error, hasCompletedOnboarding, completeOnboarding, refreshOnboardingState } = useAuth()

const useWechatProfile = ref(true)
const wechatNickname = ref('')
const customNickname = ref('')
const avatarFilePath = ref('')

const enteredNickname = computed(() =>
  useWechatProfile.value ? wechatNickname.value.trim() : customNickname.value.trim(),
)

const canContinue = computed(() => {
  if (loading.value) {
    return false
  }

  if (useWechatProfile.value) {
    return true
  }

  return enteredNickname.value.length > 0
})

const redirectToHome = () => {
  uni.switchTab({
    url: '/pages/home/index',
  })
}

const handleChooseAvatar = (event: { detail?: { avatarUrl?: string } }) => {
  avatarFilePath.value = event.detail?.avatarUrl || ''
}

const handleWechatNicknameBlur = (event: { detail?: { value?: string } }) => {
  wechatNickname.value = event.detail?.value?.trim() || ''
}

const handleCustomNicknameInput = (event: { detail?: { value?: string } }) => {
  customNickname.value = event.detail?.value?.trim() || ''
}

const submitLogin = async () => {
  if (!canContinue.value) {
    uni.showToast({
      title: 'Add a nickname first',
      icon: 'none',
    })
    return
  }

  await completeOnboarding({
    useWechatProfile: useWechatProfile.value,
    nickName: enteredNickname.value || undefined,
    avatarFilePath: useWechatProfile.value ? avatarFilePath.value || undefined : undefined,
  })

  if (error.value) {
    return
  }

  redirectToHome()
}

onShow(() => {
  refreshOnboardingState()

  if (hasCompletedOnboarding.value) {
    redirectToHome()
  }
})
</script>

<template>
  <PageScaffold>
    <view class="login-page">
      <view class="login-header">
        <view class="login-kicker">Koko Box</view>
        <view class="login-title">Sign in and start gently.</view>
        <view class="login-copy">Use your WeChat profile or begin with a custom nickname.</view>
      </view>

      <view class="login-shell">
        <view class="login-mode-switch">
          <button
            class="login-mode-button"
            :class="{ 'login-mode-button--active': useWechatProfile }"
            @click="useWechatProfile = true"
          >
            WeChat profile
          </button>
          <button
            class="login-mode-button"
            :class="{ 'login-mode-button--active': !useWechatProfile }"
            @click="useWechatProfile = false"
          >
            Custom nickname
          </button>
        </view>

        <view v-if="useWechatProfile" class="login-form-row">
          <button class="login-avatar-button" open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
            <image v-if="avatarFilePath" class="login-avatar-image" :src="avatarFilePath" mode="aspectFill" />
            <view v-else class="login-avatar-placeholder">Avatar</view>
          </button>

          <view class="login-inline-fields">
            <input
              class="login-name-input"
              type="nickname"
              :value="wechatNickname"
              placeholder="Confirm your WeChat nickname"
              @blur="handleWechatNicknameBlur"
            />
            <view class="login-helper-text">Only the details you confirm here will be saved.</view>
          </view>
        </view>

        <view v-else class="login-form-row login-form-row--single">
          <input
            class="login-name-input"
            type="text"
            maxlength="20"
            :value="customNickname"
            placeholder="Choose the name you want to use"
            @input="handleCustomNicknameInput"
          />
        </view>

        <view v-if="error" class="login-inline-error">
          {{ error }}
        </view>

        <button class="login-submit-button" :disabled="!canContinue" @click="submitLogin">
          {{ loading ? 'Signing in...' : 'Continue with WeChat' }}
        </button>
      </view>
    </view>
  </PageScaffold>
</template>
