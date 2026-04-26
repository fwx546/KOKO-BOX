<script lang="ts">
import { WECHAT_CLOUD_ENV_ID, isWechatCloudConfigured } from './src/config/cloud'
import { useAuth } from './src/composables/useAuth'
import { useKokoState } from './src/composables/useKokoState'

const { authMode, login } = useAuth()
const { syncPetFromAuth } = useKokoState()

const syncSessionPetFromCloud = async () => {
  const mode = authMode.value

  if (!mode) {
    return
  }

  try {
    const result = await login(mode)
    syncPetFromAuth(result.pet)
  } catch {
    // Keep app startup stable even if cloud sync fails.
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

    void syncSessionPetFromCloud()
  },
  onShow() {
    void syncSessionPetFromCloud()
  },
}
</script>

<style>
@import './src/styles/main.css';
</style>
