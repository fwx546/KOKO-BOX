<script lang="ts">
import { WECHAT_CLOUD_ENV_ID, isWechatCloudConfigured } from './src/config/cloud'
import { useAuth } from './src/composables/useAuth'
import { useKokoState } from './src/composables/useKokoState'

const { authMode, hasCompletedOnboarding, login } = useAuth()
const { syncPetFromAuth, syncCourseScheduleFromCloud, syncTasksFromCloud } = useKokoState()

const syncSessionPetFromCloud = async () => {
  const mode = authMode.value

  if (!mode) {
    return
  }

  try {
    const result = await login(mode)
    syncPetFromAuth(result.pet)
    if (mode !== 'guest' && !result.isMock) {
      await syncTasksFromCloud()
      await syncCourseScheduleFromCloud()
    }
  } catch {
    // Keep app startup stable even if cloud sync fails.
  }
}

const ensureEntryGate = () => {
  if (authMode.value && hasCompletedOnboarding.value) {
    return
  }

  if (typeof getCurrentPages !== 'function') {
    return
  }

  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as { route?: string } | undefined
  const route = current?.route

  if (route && route !== 'pages/index/index') {
    uni.reLaunch({
      url: '/pages/index/index',
    })
  }
}

export default {
  onLaunch() {
    // #ifdef MP-WEIXIN
    const wxApi = (globalThis as { wx?: { cloud?: { init?: (options: unknown) => void } } }).wx

    if (isWechatCloudConfigured() && wxApi?.cloud?.init) {
      wxApi.cloud.init({
        env: WECHAT_CLOUD_ENV_ID,
        traceUser: true,
      })
    }
    // #endif

    void syncSessionPetFromCloud().finally(() => {
      ensureEntryGate()
    })
  },
  onShow() {
    void syncSessionPetFromCloud().finally(() => {
      ensureEntryGate()
    })
  },
}
</script>

<style>
@import './src/styles/main.css';
</style>
