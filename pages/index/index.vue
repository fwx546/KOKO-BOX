<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageScaffold from '../../src/components/PageScaffold.vue'
import { useWechatShare } from '../../src/composables/useWechatShare'
import { useAuth } from '../../src/composables/useAuth'

const { loading, error, hasCompletedOnboarding, completeOnboarding, refreshOnboardingState } = useAuth()

useWechatShare({
  path: '/pages/index/index',
  query: {
    from: 'share',
    page: 'landing',
  },
})

const useWechatProfile = ref(true)
const wechatNickname = ref('')
const customNickname = ref('')
const avatarFilePath = ref('')
const isRedirectingHome = ref(false)

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
  if (isRedirectingHome.value) {
    return
  }

  isRedirectingHome.value = true
  uni.switchTab({
    url: '/pages/home/index',
    fail: () => {
      uni.reLaunch({
        url: '/pages/home/index',
        complete: () => {
          isRedirectingHome.value = false
        },
      })
    },
    success: () => {
      isRedirectingHome.value = false
    },
  })
}

const switchMode = (next: boolean) => {
  useWechatProfile.value = next
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
      title: '请先输入昵称',
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
    <view class="login-page login-page--warm">
      <view class="login-welcome-card">
        <view class="login-welcome-card__badge">Koko Box</view>
        <view class="login-welcome-card__hero">
          <view class="login-welcome-card__copy">
            <view class="login-title">轻轻登录，然后开始陪伴。</view>
            <view class="login-copy">优先使用微信头像和昵称进入，也可以先用一个自定义昵称快速开始。</view>
          </view>
          <view class="login-pet-mark">
            <view class="login-pet-mark__face">
              <view class="login-pet-mark__ear login-pet-mark__ear--left" />
              <view class="login-pet-mark__ear login-pet-mark__ear--right" />
              <view class="login-pet-mark__eye login-pet-mark__eye--left" />
              <view class="login-pet-mark__eye login-pet-mark__eye--right" />
              <view class="login-pet-mark__nose" />
            </view>
          </view>
        </view>
      </view>

      <view class="login-shell login-shell--soft">
        <view class="login-kicker">优先微信授权</view>

        <view class="login-primary-panel">
          <view class="login-primary-panel__header">
            <view>
              <view class="login-primary-panel__title">微信头像昵称登录</view>
              <view class="login-primary-panel__note">确认你想保存的头像和昵称，就能直接进入首页。</view>
            </view>
            <button class="login-submit-button" :disabled="!canContinue || !useWechatProfile" @click="submitLogin">
              {{ loading && useWechatProfile ? '登录中...' : '继续进入' }}
            </button>
          </view>

          <view class="login-form-row login-form-row--card">
            <button class="login-avatar-button" open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
              <image v-if="avatarFilePath" class="login-avatar-image" :src="avatarFilePath" mode="aspectFill" />
              <view v-else class="login-avatar-placeholder">头像</view>
            </button>

            <view class="login-inline-fields">
              <input
                class="login-name-input"
                type="nickname"
                :value="wechatNickname"
                placeholder="确认你的微信昵称"
                @blur="handleWechatNicknameBlur"
              />
              <view class="login-helper-text">只有你确认过的资料会被保存，用于展示账户信息和宠物陪伴记录。</view>
            </view>
          </view>
        </view>

        <view class="login-mode-switch login-mode-switch--secondary">
          <button
            class="login-mode-button"
            :class="{ 'login-mode-button--active': useWechatProfile }"
            @click="switchMode(true)"
          >
            微信资料
          </button>
          <button
            class="login-mode-button"
            :class="{ 'login-mode-button--active': !useWechatProfile }"
            @click="switchMode(false)"
          >
            自定义昵称
          </button>
        </view>

        <view v-if="!useWechatProfile" class="login-secondary-panel">
          <view class="login-secondary-panel__title">备用进入方式</view>
          <view class="login-secondary-panel__note">如果你暂时不想同步微信资料，也可以先用昵称进入，稍后再补充头像。</view>
          <view class="login-form-row login-form-row--single login-form-row--cardless">
            <input
              class="login-name-input login-name-input--field"
              type="text"
              maxlength="20"
              :value="customNickname"
              placeholder="输入你想使用的昵称"
              @input="handleCustomNicknameInput"
            />
          </view>
          <button class="login-secondary-button" :disabled="!canContinue" @click="submitLogin">
            {{ loading ? '登录中...' : '使用昵称进入' }}
          </button>
        </view>

        <view v-if="error" class="login-inline-error">
          {{ error }}
        </view>

        <view class="login-footer-note">我们只会保存你主动确认的头像和昵称，让登录过程保持简单安心。</view>
      </view>
    </view>
  </PageScaffold>
</template>
