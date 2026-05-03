<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageScaffold from '../../src/components/PageScaffold.vue'
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

const normalizedPetName = computed(() => petName.value.trim())
const canStart = computed(() => !loading.value && selectedLoginMode.value === 'wechat' && normalizedPetName.value.length > 0)
const stepLabel = computed(() => (step.value === 'auth-choice' ? '1 / 2' : '2 / 2'))

const changeLanguage = (nextLanguage: 'zh' | 'en') => {
  setLanguage(nextLanguage)
  updateSettings({ language: nextLanguage })
  syncNativeLanguageUi(nextLanguage)
}

const redirectToHome = () => {
  if (isRedirectingHome.value) return

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
</script>

<template>
  <PageScaffold>
    <view class="onboarding-page">
      <view class="onboarding-card">
        <view class="onboarding-card__top">
          <view class="onboarding-card__step">{{ stepLabel }}</view>
          <view class="onboarding-pet-mark">
            <view class="onboarding-pet-mark__ear onboarding-pet-mark__ear--left" />
            <view class="onboarding-pet-mark__ear onboarding-pet-mark__ear--right" />
            <view class="onboarding-pet-mark__face">
              <view class="onboarding-pet-mark__eye onboarding-pet-mark__eye--left" />
              <view class="onboarding-pet-mark__eye onboarding-pet-mark__eye--right" />
              <view class="onboarding-pet-mark__nose" />
            </view>
          </view>
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
  overflow: hidden;
  padding: 32rpx;
  width: 100%;
}

.onboarding-card__top {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.onboarding-card__step {
  background: rgba(255, 255, 255, 0.72);
  border-radius: 999rpx;
  color: #8a7a68;
  font-size: 24rpx;
  font-weight: 800;
  padding: 10rpx 18rpx;
}

.onboarding-pet-mark {
  background: linear-gradient(180deg, #fff2d7, #ffdca2);
  border-radius: 50%;
  height: 118rpx;
  position: relative;
  width: 118rpx;
}

.onboarding-pet-mark__face {
  background: linear-gradient(180deg, #ffc66f, #f2a04f);
  border-radius: 46% 46% 42% 42%;
  bottom: 22rpx;
  height: 68rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 76rpx;
}

.onboarding-pet-mark__ear {
  background: #ef9e4f;
  border-radius: 22rpx 22rpx 8rpx 8rpx;
  height: 42rpx;
  position: absolute;
  top: 18rpx;
  width: 28rpx;
  z-index: 1;
}

.onboarding-pet-mark__ear--left {
  left: 28rpx;
  transform: rotate(-18deg);
}

.onboarding-pet-mark__ear--right {
  right: 28rpx;
  transform: rotate(18deg);
}

.onboarding-pet-mark__eye,
.onboarding-pet-mark__nose {
  background: #253047;
  position: absolute;
}

.onboarding-pet-mark__eye {
  border-radius: 999rpx;
  height: 14rpx;
  top: 28rpx;
  width: 9rpx;
}

.onboarding-pet-mark__eye--left {
  left: 22rpx;
}

.onboarding-pet-mark__eye--right {
  right: 22rpx;
}

.onboarding-pet-mark__nose {
  border-radius: 50%;
  bottom: 18rpx;
  height: 10rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 16rpx;
}

.onboarding-panel {
  margin-top: 34rpx;
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
