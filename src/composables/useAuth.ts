import { computed, ref } from 'vue'
import { isWechatCloudConfigured } from '../config/cloud'

export interface AuthUser {
  _id?: string
  _openid: string
  nickName: string
  avatarUrl: string
  onboardingDone: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
  lastLoginAt?: string | Date
}

export interface PetProfile {
  _id?: string
  _openid: string
  name: string
  stage: 'egg' | 'baby' | 'growing' | 'adult'
  mood: number
  health: number
  hunger: number
  energy: number
  intimacy: number
  cleanliness: number
}

interface LoginResult {
  user: AuthUser
  pet: PetProfile
  isNewUser: boolean
  isMock?: boolean
}

const AUTH_ONBOARDING_STORAGE_KEY = 'koko-auth-onboarding-complete'

const mockUser: AuthUser = {
  _openid: 'mock-openid-h5',
  nickName: 'Koko Friend',
  avatarUrl: '',
  onboardingDone: false,
}

const mockPet: PetProfile = {
  _openid: mockUser._openid,
  name: 'Koko',
  stage: 'growing',
  mood: 82,
  health: 88,
  hunger: 64,
  energy: 76,
  intimacy: 55,
  cleanliness: 90,
}

const user = ref<AuthUser | null>(null)
const pet = ref<PetProfile | null>(null)
const loading = ref(false)
const error = ref('')
const isMockSession = ref(false)
const hasCompletedOnboarding = ref(false)

interface WechatCloudApi {
  callFunction?: (options: unknown) => Promise<{ result: unknown }>
  uploadFile?: (options: {
    cloudPath: string
    filePath: string
  }) => Promise<{ fileID: string }>
}

const getWechatCloudApi = () =>
  (globalThis as { wx?: { cloud?: WechatCloudApi } }).wx?.cloud

const readOnboardingState = () => {
  try {
    return uni.getStorageSync(AUTH_ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const writeOnboardingState = (value: boolean) => {
  hasCompletedOnboarding.value = value

  try {
    if (value) {
      uni.setStorageSync(AUTH_ONBOARDING_STORAGE_KEY, '1')
      return
    }

    uni.removeStorageSync(AUTH_ONBOARDING_STORAGE_KEY)
  } catch {
    // Ignore storage failures so login can still proceed.
  }
}

hasCompletedOnboarding.value = readOnboardingState()

const callWechatCloudFunction = async <T>(name: string, data?: Record<string, unknown>) => {
  const wxCloud = getWechatCloudApi()

  if (!wxCloud?.callFunction) {
    throw new Error('WeChat cloud is not available in this environment.')
  }

  const response = await wxCloud.callFunction({
    name,
    data,
  })

  return response.result as T
}

const uploadAvatarToCloud = async (filePath: string, openid?: string) => {
  const wxCloud = getWechatCloudApi()

  if (!wxCloud?.uploadFile) {
    throw new Error('WeChat cloud upload is not available in this environment.')
  }

  const extension = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')) : '.png'
  const sanitizedOpenid = openid?.replace(/[^a-zA-Z0-9_-]/g, '') || 'anonymous'
  const timestamp = Date.now()
  const cloudPath = `avatars/${sanitizedOpenid}-${timestamp}${extension}`
  const { fileID } = await wxCloud.uploadFile({
    cloudPath,
    filePath,
  })

  return fileID
}

const useMockLogin = () => {
  user.value = mockUser
  pet.value = mockPet
  isMockSession.value = true
  error.value = ''
}

const login = async () => {
  if (loading.value) {
    return
  }

  loading.value = true
  error.value = ''

  try {
    if (!isWechatCloudConfigured()) {
      useMockLogin()
      return
    }

    const result = await callWechatCloudFunction<LoginResult>('login')
    user.value = result.user
    pet.value = result.pet
    isMockSession.value = Boolean(result.isMock)
    writeOnboardingState(Boolean(result.user.onboardingDone))
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'WeChat auto login failed. Please try again.'
  } finally {
    loading.value = false
  }
}

const syncUserProfile = async (profile: { nickName?: string; avatarUrl?: string; onboardingDone?: boolean }) => {
  if (!user.value) {
    await login()
  }

  loading.value = true
  error.value = ''

  try {
    if (!isWechatCloudConfigured() || isMockSession.value) {
      user.value = {
        ...(user.value ?? mockUser),
        nickName: profile.nickName?.trim() || user.value?.nickName || mockUser.nickName,
        avatarUrl: profile.avatarUrl || user.value?.avatarUrl || '',
        onboardingDone: profile.onboardingDone ?? user.value?.onboardingDone ?? false,
      }
      if (profile.onboardingDone !== undefined) {
        writeOnboardingState(profile.onboardingDone)
      }
      return
    }

    const result = await callWechatCloudFunction<LoginResult>('login', {
      action: 'syncUserProfile',
      profile,
    })
    user.value = result.user
    pet.value = result.pet
    writeOnboardingState(Boolean(result.user.onboardingDone))
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'Profile sync failed. Please try again.'
  } finally {
    loading.value = false
  }
}

const importWechatProfile = async (profile: { nickName?: string; avatarFilePath?: string }) => {
  if (!user.value) {
    await login()
  }

  const nextProfile: { nickName?: string; avatarUrl?: string } = {}

  if (profile.nickName?.trim()) {
    nextProfile.nickName = profile.nickName.trim()
  }

  if (profile.avatarFilePath) {
    if (!isWechatCloudConfigured() || isMockSession.value) {
      nextProfile.avatarUrl = profile.avatarFilePath
    } else {
      nextProfile.avatarUrl = await uploadAvatarToCloud(profile.avatarFilePath, user.value?._openid)
    }
  }

  if (!nextProfile.nickName && !nextProfile.avatarUrl) {
    return
  }

  await syncUserProfile(nextProfile)
}

const completeOnboarding = async (options?: {
  useWechatProfile?: boolean
  nickName?: string
  avatarFilePath?: string
}) => {
  await login()

  const nextProfile: { nickName?: string; avatarUrl?: string; onboardingDone?: boolean } = {
    onboardingDone: true,
  }

  if (options?.useWechatProfile) {
    if (options.nickName?.trim()) {
      nextProfile.nickName = options.nickName.trim()
    }

    if (options.avatarFilePath) {
      nextProfile.avatarUrl =
        !isWechatCloudConfigured() || isMockSession.value
          ? options.avatarFilePath
          : await uploadAvatarToCloud(options.avatarFilePath, user.value?._openid)
    }
  } else if (options?.nickName?.trim()) {
    nextProfile.nickName = options.nickName.trim()
  }

  await syncUserProfile(nextProfile)
}

export const useAuth = () => ({
  user,
  pet,
  loading,
  error,
  isMockSession,
  isLoggedIn: computed(() => Boolean(user.value)),
  hasCompletedOnboarding,
  login,
  syncUserProfile,
  importWechatProfile,
  completeOnboarding,
  refreshOnboardingState: () => {
    hasCompletedOnboarding.value = readOnboardingState()
  },
})
