import { computed, ref } from 'vue'
import { isWechatCloudConfigured } from '../config/cloud'

export type AuthMode = 'wechat' | 'guest'

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

export interface AuthSessionResult extends LoginResult {
  mode: AuthMode
}

const AUTH_MODE_STORAGE_KEY = 'koko-auth-mode-v1'
const AUTH_WECHAT_ONBOARDING_STORAGE_KEY = 'koko-auth-wechat-onboarding-complete'
const GUEST_PET_NAME = 'koko'
const GUEST_OPENID = 'guest-openid-local'

const mockUser: AuthUser = {
  _openid: 'mock-openid-h5',
  nickName: 'Koko Friend',
  avatarUrl: '',
  onboardingDone: false,
}

const mockPet: PetProfile = {
  _openid: mockUser._openid,
  name: '可可',
  stage: 'growing',
  mood: 82,
  health: 88,
  hunger: 64,
  energy: 76,
  intimacy: 55,
  cleanliness: 90,
}

const guestUser: AuthUser = {
  _openid: GUEST_OPENID,
  nickName: 'Guest',
  avatarUrl: '',
  onboardingDone: true,
}

const guestPet: PetProfile = {
  _openid: GUEST_OPENID,
  name: GUEST_PET_NAME,
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
const authMode = ref<AuthMode | null>(null)
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

const readAuthMode = () => {
  try {
    const value = uni.getStorageSync(AUTH_MODE_STORAGE_KEY)
    return value === 'guest' || value === 'wechat' ? value : null
  } catch {
    return null
  }
}

const writeAuthMode = (mode: AuthMode) => {
  try {
    uni.setStorageSync(AUTH_MODE_STORAGE_KEY, mode)
  } catch {
    // Ignore storage failures so login can still proceed.
  }
}

const clearAuthStorage = () => {
  try {
    uni.removeStorageSync(AUTH_MODE_STORAGE_KEY)
    uni.removeStorageSync(AUTH_WECHAT_ONBOARDING_STORAGE_KEY)
  } catch {
    // Ignore storage failures so logout can still proceed.
  }
}

const readWechatOnboardingState = () => {
  try {
    return uni.getStorageSync(AUTH_WECHAT_ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const setAuthMode = (mode: AuthMode) => {
  authMode.value = mode
  writeAuthMode(mode)
  hasCompletedOnboarding.value = mode === 'guest' ? true : readWechatOnboardingState()
}

const writeOnboardingState = (value: boolean) => {
  hasCompletedOnboarding.value = value

  if (authMode.value === 'guest') {
    return
  }

  try {
    if (value) {
      uni.setStorageSync(AUTH_WECHAT_ONBOARDING_STORAGE_KEY, '1')
      return
    }

    uni.removeStorageSync(AUTH_WECHAT_ONBOARDING_STORAGE_KEY)
  } catch {
    // Ignore storage failures so login can still proceed.
  }
}

authMode.value = readAuthMode()
hasCompletedOnboarding.value = authMode.value === 'guest' ? true : readWechatOnboardingState()

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

const useMockLogin = (): AuthSessionResult => {
  setAuthMode('wechat')
  user.value = {
    ...mockUser,
  }
  pet.value = {
    ...mockPet,
  }
  isMockSession.value = true
  error.value = ''
  writeOnboardingState(Boolean(mockUser.onboardingDone))

  return {
    user: user.value,
    pet: pet.value,
    isNewUser: true,
    isMock: true,
    mode: 'wechat',
  }
}

const useGuestLogin = (): AuthSessionResult => {
  setAuthMode('guest')
  user.value = {
    ...guestUser,
  }
  pet.value = {
    ...guestPet,
  }
  isMockSession.value = false
  error.value = ''
  writeOnboardingState(true)

  return {
    user: user.value,
    pet: pet.value,
    isNewUser: true,
    isMock: false,
    mode: 'guest',
  }
}

const login = async (mode: AuthMode = authMode.value ?? 'wechat'): Promise<AuthSessionResult> => {
  if (loading.value) {
    return {
      user: user.value ?? (mode === 'guest' ? guestUser : mockUser),
      pet: pet.value ?? (mode === 'guest' ? guestPet : mockPet),
      isNewUser: false,
      isMock: isMockSession.value,
      mode,
    }
  }

  loading.value = true
  error.value = ''

  try {
    if (mode === 'guest') {
      return useGuestLogin()
    }

    setAuthMode('wechat')

    if (!isWechatCloudConfigured()) {
      return useMockLogin()
    }

    const result = await callWechatCloudFunction<LoginResult>('login')
    user.value = result.user
    pet.value = result.pet
    isMockSession.value = Boolean(result.isMock)
    writeOnboardingState(Boolean(result.user.onboardingDone))
    return {
      ...result,
      mode: 'wechat',
    }
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'WeChat auto login failed. Please try again.'
    return useMockLogin()
  } finally {
    loading.value = false
  }
}

const syncUserProfile = async (profile: { nickName?: string; avatarUrl?: string; onboardingDone?: boolean; petName?: string }) => {
  if (!user.value) {
    await login(authMode.value ?? 'wechat')
  }

  loading.value = true
  error.value = ''

  try {
    const inGuestMode = authMode.value === 'guest'

    if (inGuestMode || !isWechatCloudConfigured() || isMockSession.value) {
      const nextPetName = profile.petName?.trim()
      user.value = {
        ...(user.value ?? (inGuestMode ? guestUser : mockUser)),
        nickName: profile.nickName?.trim() || user.value?.nickName || (inGuestMode ? guestUser.nickName : mockUser.nickName),
        avatarUrl: profile.avatarUrl || user.value?.avatarUrl || '',
        onboardingDone: inGuestMode ? true : profile.onboardingDone ?? user.value?.onboardingDone ?? false,
      }
      pet.value = {
        ...(pet.value ?? (inGuestMode ? guestPet : mockPet)),
        name: inGuestMode ? GUEST_PET_NAME : nextPetName || pet.value?.name || mockPet.name,
      }

      if (inGuestMode) {
        writeOnboardingState(true)
      } else if (profile.onboardingDone !== undefined) {
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
    const nextPetName = profile.petName?.trim()
    const inGuestMode = authMode.value === 'guest'

    user.value = {
      ...(user.value ?? (inGuestMode ? guestUser : mockUser)),
      nickName: profile.nickName?.trim() || user.value?.nickName || (inGuestMode ? guestUser.nickName : mockUser.nickName),
      avatarUrl: profile.avatarUrl || user.value?.avatarUrl || '',
      onboardingDone: inGuestMode ? true : user.value?.onboardingDone,
    }

    if (inGuestMode) {
      pet.value = {
        ...(pet.value ?? guestPet),
        name: GUEST_PET_NAME,
      }
      writeOnboardingState(true)
    } else if (nextPetName) {
      pet.value = {
        ...(pet.value ?? mockPet),
        name: nextPetName,
      }
    }
  } finally {
    loading.value = false
  }
}

const importWechatProfile = async (profile: { nickName?: string; avatarFilePath?: string }) => {
  if (authMode.value === 'guest') {
    return
  }

  if (!user.value) {
    await login(authMode.value ?? 'wechat')
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
  petName?: string
}) => {
  await login(authMode.value ?? 'wechat')

  if (authMode.value === 'guest') {
    await syncUserProfile({
      onboardingDone: true,
      petName: GUEST_PET_NAME,
    })
    return
  }

  const nextProfile: { nickName?: string; avatarUrl?: string; onboardingDone?: boolean } = {
    onboardingDone: true,
  }
  const petName = options?.petName?.trim() || pet.value?.name?.trim() || '可可'

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

  await syncUserProfile({
    ...nextProfile,
    petName,
  })
}

const logout = async () => {
  clearAuthStorage()
  user.value = null
  pet.value = null
  loading.value = false
  error.value = ''
  isMockSession.value = false
  authMode.value = null
  hasCompletedOnboarding.value = false
}

export const useAuth = () => ({
  user,
  pet,
  loading,
  error,
  authMode,
  isMockSession,
  isGuestSession: computed(() => authMode.value === 'guest'),
  isLoggedIn: computed(() => Boolean(user.value)),
  hasCompletedOnboarding,
  login,
  logout,
  syncUserProfile,
  importWechatProfile,
  completeOnboarding,
  refreshOnboardingState: () => {
    hasCompletedOnboarding.value = authMode.value === 'guest' ? true : readWechatOnboardingState()
  },
})
