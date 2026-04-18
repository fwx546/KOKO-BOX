<script lang="ts">
import { WECHAT_CLOUD_ENV_ID, isWechatCloudConfigured } from './src/config/cloud'

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
  },
}
</script>

<style>
@import './src/styles/main.css';
</style>
