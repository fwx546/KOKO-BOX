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

const callWechatCloudFunction = async <T>(name: string, data?: Record<string, unknown>) => {
  const wxApi = (globalThis as { wx?: { cloud?: { callFunction?: (options: unknown) => Promise<{ result: T }> } } }).wx

  if (!wxApi?.cloud?.callFunction) {
    throw new Error('WeChat cloud is not available in this environment.')
  }

  const response = await wxApi.cloud.callFunction({
    name,
    data,
  })

  return response.result
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
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'WeChat auto login failed. Please try again.'
  } finally {
    loading.value = false
  }
}

const syncUserProfile = async (profile: { nickName?: string; avatarUrl?: string }) => {
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
      }
      return
    }

    const result = await callWechatCloudFunction<LoginResult>('login', {
      action: 'syncUserProfile',
      profile,
    })
    user.value = result.user
    pet.value = result.pet
  } catch (caughtError) {
    error.value = caughtError instanceof Error ? caughtError.message : 'Profile sync failed. Please try again.'
  } finally {
    loading.value = false
  }
}

export const useAuth = () => ({
  user,
  pet,
  loading,
  error,
  isMockSession,
  isLoggedIn: computed(() => Boolean(user.value)),
  login,
  syncUserProfile,
})
