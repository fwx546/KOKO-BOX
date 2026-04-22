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
      <view class="login-hero">
        <view class="login-kicker">Koko Box</view>
        <view class="login-title">A soft start for your companion space.</view>
        <view class="login-copy">Sign in with WeChat, then decide whether to keep your WeChat profile or start with your own nickname.</view>
        <view class="login-badge-row">
          <view class="login-badge">Bright UI</view>
          <view class="login-badge">English only</view>
        </view>
      </view>

      <view class="login-panel">
        <view class="login-panel-head">
          <view class="login-panel-title">Choose your setup</view>
          <view class="login-panel-copy">You can change your profile details later in Settings.</view>
        </view>

        <view class="login-choice-grid">
          <button
            class="login-choice-card"
            :class="{ 'login-choice-card--active': useWechatProfile }"
            @click="useWechatProfile = true"
          >
            <view class="login-choice-title">Use my WeChat profile</view>
            <view class="login-choice-copy">Keep the WeChat avatar and nickname you confirm here.</view>
          </button>

          <button
            class="login-choice-card"
            :class="{ 'login-choice-card--active': !useWechatProfile }"
            @click="useWechatProfile = false"
          >
            <view class="login-choice-title">Create a custom nickname</view>
            <view class="login-choice-copy">Start with your own name and update the avatar later.</view>
          </button>
        </view>

        <view v-if="useWechatProfile" class="login-profile-card">
          <button class="login-avatar-button" open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
            <image v-if="avatarFilePath" class="login-avatar-image" :src="avatarFilePath" mode="aspectFill" />
            <view v-else class="login-avatar-placeholder">Avatar</view>
          </button>

          <view class="login-profile-fields">
            <input
              class="login-name-input"
              type="nickname"
              :value="wechatNickname"
              placeholder="Tap to confirm your WeChat nickname"
              @blur="handleWechatNicknameBlur"
            />
            <view class="login-helper-text">Your avatar and nickname are only synced after you explicitly confirm them.</view>
          </view>
        </view>

        <view v-else class="login-custom-card">
          <view class="login-field-label">Your nickname</view>
          <input
            class="login-name-input login-name-input--custom"
            type="text"
            maxlength="20"
            :value="customNickname"
            placeholder="Choose the name you want to use"
            @input="handleCustomNicknameInput"
          />
        </view>

        <view v-if="error" class="login-error-card">
          <view>Something interrupted sign-in</view>
          <view>{{ error }}</view>
        </view>

        <button class="login-submit-button" :disabled="!canContinue" @click="submitLogin">
          {{ loading ? 'Signing in...' : 'Continue with WeChat' }}
        </button>

        <view class="login-footnote">After the first sign-in, Koko Box will open straight to Home.</view>
      </view>
    </view>
  </PageScaffold>
</template>
