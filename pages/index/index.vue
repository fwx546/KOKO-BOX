<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import PageScaffold from '../../src/components/PageScaffold.vue'
import PetLottieAvatar from '../../src/components/PetLottieAvatar.vue'
import { useAuth } from '../../src/composables/useAuth'
import { useKokoState } from '../../src/composables/useKokoState'
import { useLanguage } from '../../src/composables/useLanguage'
import { syncNativeLanguageUi } from '../../src/utils/nativeLanguageUi'
import { useWechatShare } from '../../src/composables/useWechatShare'

type LoginMode = 'wechat' | 'guest'
type LoginStep = 'auth-choice' | 'pet-naming'

const { loading, authMode, pet: authPet, hasCompletedOnboarding, login, completeOnboarding, refreshOnboardingState } = useAuth()
const { syncPetFromAuth, syncCourseScheduleFromCloud, syncTasksFromCloud, syncEconomyFromCloud, updateSettings } = useKokoState()
const { language, setLanguage, t } = useLanguage()

useWechatShare({
  path: '/pages/index/index',
  query: {
    from: 'share',
    page: 'landing',
  },
})

const step = ref<LoginStep>('auth-choice')
const selectedLoginMode = ref<LoginMode>('wechat')
const petName = ref('')
const isRedirectingHome = ref(false)
const pendingTownInvite = ref('')
const TOWN_PENDING_INVITE_STORAGE_KEY = 'koko-town-pending-invite'

const normalizedPetName = computed(() => petName.value.trim())
const canStart = computed(() => !loading.value && selectedLoginMode.value === 'wechat' && normalizedPetName.value.length > 0)

const changeLanguage = (nextLanguage: 'zh' | 'en') => {
  setLanguage(nextLanguage)
  updateSettings({ language: nextLanguage })
  syncNativeLanguageUi(nextLanguage)
}

const decodeInviteCode = (value?: string) => {
  if (!value) return ''
  const decoded = decodeURIComponent(value)
  const query = decoded.includes('?') ? decoded.slice(decoded.indexOf('?') + 1) : decoded
  const invitePair = query
    .split('&')
    .map((part) => part.split('='))
    .find(([key]) => key === 'invite')

  return (invitePair?.[1] || decoded).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()
}

const redirectToHome = () => {
  if (isRedirectingHome.value) return

  isRedirectingHome.value = true
  const invite = pendingTownInvite.value

  if (invite) {
    if (typeof uni.setStorageSync === 'function') {
      uni.setStorageSync(TOWN_PENDING_INVITE_STORAGE_KEY, invite)
    }
    uni.switchTab({
      url: '/pages/town/index',
      fail: () => {
        uni.reLaunch({
          url: '/pages/town/index',
          complete: () => {
            isRedirectingHome.value = false
          },
        })
      },
      success: () => {
        isRedirectingHome.value = false
      },
    })
    return
  }

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

const chooseLoginMode = async (mode: LoginMode) => {
  selectedLoginMode.value = mode

  const result = await login(mode)

  if (mode === 'guest') {
    syncPetFromAuth(result.pet)
    redirectToHome()
    return
  }

  if (result.user.onboardingDone) {
    syncPetFromAuth(result.pet)
    await syncEconomyFromCloud()
    await syncTasksFromCloud()
    await syncCourseScheduleFromCloud()
    redirectToHome()
    return
  }

  petName.value = ''
  step.value = 'pet-naming'
}

const handlePetNameInput = (event: { detail?: { value?: string } }) => {
  petName.value = event.detail?.value ?? ''
}

const submitPetName = async () => {
  if (selectedLoginMode.value !== 'wechat') {
    return
  }

  if (!canStart.value) {
    uni.showToast({
      title: t.value.onboarding.nameRequired,
      icon: 'none',
    })
    return
  }

  const finalPetName = normalizedPetName.value || t.value.onboarding.defaultPetName
  await completeOnboarding({
    useWechatProfile: selectedLoginMode.value === 'wechat',
    petName: finalPetName,
  })

  syncPetFromAuth({
    ...(authPet.value ?? {}),
    name: finalPetName,
  })
  await syncTasksFromCloud()
  await syncEconomyFromCloud()
  await syncCourseScheduleFromCloud()
  redirectToHome()
}

onShow(() => {
  refreshOnboardingState()

  if (authMode.value && hasCompletedOnboarding.value) {
    redirectToHome()
  }
})

onLoad((options = {}) => {
  const invite = decodeInviteCode(String(options.townInvite || options.invite || options.scene || ''))
  if (invite) {
    pendingTownInvite.value = invite
  }
})
</script>

<template>
  <PageScaffold>
    <view class="onboarding-page">
      <view class="onboarding-card">
        <view class="onboarding-pet-avatar">
          <PetLottieAvatar :size-rpx="138" />
        </view>

        <view v-if="step === 'auth-choice'" class="onboarding-panel">
          <view class="onboarding-kicker">KOKO BOX</view>
          <view class="onboarding-title">{{ t.onboarding.authTitle }}</view>
          <view class="onboarding-copy">{{ t.onboarding.authCopy }}</view>

          <view class="onboarding-language">
            <button
              class="onboarding-language__button"
              :class="{ 'onboarding-language__button--active': language === 'zh' }"
              :disabled="loading"
              @click="changeLanguage('zh')"
            >
              中文
            </button>
            <button
              class="onboarding-language__button"
              :class="{ 'onboarding-language__button--active': language === 'en' }"
              :disabled="loading"
              @click="changeLanguage('en')"
            >
              English
            </button>
          </view>

          <view class="onboarding-actions">
            <button class="onboarding-button onboarding-button--primary" :disabled="loading" @click="chooseLoginMode('wechat')">
              {{ loading && selectedLoginMode === 'wechat' ? t.onboarding.loggingIn : t.onboarding.wechatLogin }}
            </button>
            <button class="onboarding-button onboarding-button--ghost" :disabled="loading" @click="chooseLoginMode('guest')">
              {{ loading && selectedLoginMode === 'guest' ? t.onboarding.entering : t.onboarding.guestLogin }}
            </button>
          </view>
        </view>

        <view v-else class="onboarding-panel onboarding-panel--name">
          <view class="onboarding-kicker">MEET YOUR PET</view>
          <view class="onboarding-title">{{ t.onboarding.nameTitle }}</view>
          <view class="onboarding-copy">{{ t.onboarding.nameCopy }}</view>

          <input
            class="onboarding-name-input"
            type="text"
            maxlength="12"
            :value="petName"
            :placeholder="t.onboarding.namePlaceholder"
            @input="handlePetNameInput"
          />

          <button class="onboarding-button onboarding-button--primary" :disabled="!canStart" @click="submitPetName">
            {{ loading ? t.onboarding.preparing : t.onboarding.start }}
          </button>

          <button class="onboarding-back-button" :disabled="loading" @click="step = 'auth-choice'">
            {{ t.onboarding.back }}
          </button>
        </view>
      </view>
    </view>
  </PageScaffold>
</template>

<style scoped>
.onboarding-page {
  align-items: center;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  min-height: calc(100vh - 160rpx);
  padding: 40rpx 28rpx;
}

.onboarding-card {
  background: rgba(255, 253, 248, 0.94);
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 36rpx;
  box-shadow: 0 24rpx 60rpx rgba(167, 124, 72, 0.12);
  box-sizing: border-box;
  max-width: 660rpx;
  overflow: visible;
  padding: 54rpx 32rpx 32rpx;
  position: relative;
  width: 100%;
}

.onboarding-pet-avatar {
  height: 138rpx;
  overflow: visible;
  position: absolute;
  right: 36rpx;
  top: -52rpx;
  width: 138rpx;
  z-index: 2;
}

.onboarding-panel {
  margin-top: 0;
}

.onboarding-kicker {
  color: #5f8c78;
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
}

.onboarding-title {
  color: #253047;
  font-size: 46rpx;
  font-weight: 900;
  line-height: 1.15;
  margin-top: 14rpx;
}

.onboarding-copy {
  color: #8a7a68;
  font-size: 27rpx;
  line-height: 1.55;
  margin-top: 14rpx;
}

.onboarding-actions {
  display: grid;
  gap: 18rpx;
  margin-top: 46rpx;
}

.onboarding-language {
  background: rgba(255, 255, 255, 0.64);
  border: 2rpx solid rgba(176, 143, 102, 0.14);
  border-radius: 999rpx;
  display: grid;
  gap: 8rpx;
  grid-template-columns: 1fr 1fr;
  margin-top: 30rpx;
  padding: 8rpx;
}

.onboarding-language__button {
  background: transparent;
  border-radius: 999rpx;
  color: #6d7a70;
  font-size: 27rpx;
  font-weight: 850;
  height: 72rpx;
  line-height: 72rpx;
  margin: 0;
  padding: 0 16rpx;
}

.onboarding-language__button::after {
  border: none;
}

.onboarding-language__button--active {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  color: #173f38;
}

.onboarding-button {
  align-items: center;
  border: none;
  border-radius: 999rpx;
  display: flex;
  font-size: 30rpx;
  font-weight: 850;
  height: 96rpx;
  justify-content: center;
  margin: 0;
  padding: 0 30rpx;
}

.onboarding-button::after,
.onboarding-back-button::after {
  border: none;
}

.onboarding-button--primary {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  color: #173f38;
}

.onboarding-button--ghost {
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 0 0 2rpx rgba(176, 143, 102, 0.18);
  color: #365f56;
}

.onboarding-button[disabled],
.onboarding-back-button[disabled] {
  opacity: 0.56;
}

.onboarding-name-input {
  background: rgba(255, 255, 255, 0.78);
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 28rpx;
  box-sizing: border-box;
  color: #253047;
  font-size: 34rpx;
  font-weight: 850;
  height: 100rpx;
  margin-top: 40rpx;
  padding: 0 28rpx;
  width: 100%;
}

.onboarding-back-button {
  background: transparent;
  color: #8a7a68;
  font-size: 25rpx;
  margin-top: 22rpx;
}
</style>
