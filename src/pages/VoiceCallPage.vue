<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import PetLottieAvatar from '../components/PetLottieAvatar.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

type CallPhase = 'idle' | 'recording' | 'thinking' | 'playing' | 'error'
type RecorderState = 'idle' | 'starting' | 'recording' | 'stopping'

const { t } = useLanguage()
const { pet, sendVoiceChatTurn } = useKokoState()

const phase = ref<CallPhase>('idle')
const transcript = ref('')
const reply = ref('')
const errorMessage = ref('')
const muted = ref(false)
const speakerOn = ref(true)
const elapsedSeconds = ref(0)

let recorder: any
let audio: any
let timer: ReturnType<typeof setInterval> | undefined
let recorderState: RecorderState = 'idle'
let recordStartedAt = 0
let pendingStopAfterStart = false
let talkPressing = false
let tapRecordingMode = false
let touchStartedAt = 0
let suppressNextTapUntil = 0
let startGuardTimer: ReturnType<typeof setTimeout> | undefined
let holdStartTimer: ReturnType<typeof setTimeout> | undefined

const isRecorderBusyError = (message = '') =>
  message.includes('is recording or paused') ||
  message.includes('operateRecorder:fail') ||
  message.includes('recorder is recording')

const statusText = computed(() => {
  if (phase.value === 'recording') return t.value.voiceCall.listening
  if (phase.value === 'thinking') return t.value.voiceCall.thinking
  if (phase.value === 'playing') return t.value.voiceCall.playing
  if (phase.value === 'error') return errorMessage.value || t.value.voiceCall.failed
  return t.value.voiceCall.holdToTalk
})

const elapsedLabel = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const stopTimer = () => {
  if (timer) clearInterval(timer)
  timer = undefined
}

const clearStartGuard = () => {
  if (startGuardTimer) clearTimeout(startGuardTimer)
  startGuardTimer = undefined
}

const clearHoldStartTimer = () => {
  if (holdStartTimer) clearTimeout(holdStartTimer)
  holdStartTimer = undefined
}

const getErrorText = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'errMsg' in error) {
    const errMsg = (error as { errMsg?: unknown }).errMsg
    return typeof errMsg === 'string' ? errMsg : ''
  }
  return ''
}

const getNativeWechatApi = () => (globalThis as { wx?: any }).wx

const getPlatformApi = () => {
  const uniApi = uni as unknown as Record<string, any>
  const wxApi = getNativeWechatApi()

  return {
    getSetting: typeof uniApi.getSetting === 'function' ? uniApi.getSetting : wxApi?.getSetting,
    authorize: typeof uniApi.authorize === 'function' ? uniApi.authorize : wxApi?.authorize,
    openSetting: typeof uniApi.openSetting === 'function' ? uniApi.openSetting : wxApi?.openSetting,
    getRecorderManager: typeof uniApi.getRecorderManager === 'function' ? uniApi.getRecorderManager : wxApi?.getRecorderManager,
    createInnerAudioContext: typeof uniApi.createInnerAudioContext === 'function' ? uniApi.createInnerAudioContext : wxApi?.createInnerAudioContext,
  }
}

const openRecordSettings = () => {
  const platformApi = getPlatformApi()

  uni.showModal({
    title: t.value.voiceCall.permissionTitle,
    content: t.value.voiceCall.permissionDenied,
    showCancel: true,
    cancelText: t.value.voiceCall.permissionCancel,
    confirmText: t.value.voiceCall.permissionSettings,
    success: (result) => {
      if (result.confirm && typeof platformApi.openSetting === 'function') {
        platformApi.openSetting({ fail: () => undefined })
      }
    },
  })
}

const ensureRecordPermission = () =>
  new Promise<boolean>((resolve) => {
    const platformApi = getPlatformApi()

    if (typeof platformApi.getSetting !== 'function' || typeof platformApi.authorize !== 'function') {
      resolve(true)
      return
    }

    platformApi.getSetting({
      success: (setting) => {
        const authSetting = (setting.authSetting ?? {}) as Record<string, boolean | undefined>

        if (authSetting['scope.record'] === true) {
          resolve(true)
          return
        }

        if (authSetting['scope.record'] === false) {
          openRecordSettings()
          resolve(false)
          return
        }

        platformApi.authorize({
          scope: 'scope.record',
          success: () => resolve(true),
          fail: () => {
            openRecordSettings()
            resolve(false)
          },
        })
      },
      fail: () => resolve(true),
    })
  })

const ensureRecorder = () => {
  if (recorder) return recorder

  const platformApi = getPlatformApi()
  if (typeof platformApi.getRecorderManager !== 'function') return recorder

  recorder = platformApi.getRecorderManager()
  recorder.onStart(() => {
    clearStartGuard()
    recorderState = 'recording'
    recordStartedAt = Date.now()

    if (pendingStopAfterStart) {
      pendingStopAfterStart = false
      setTimeout(() => {
        stopRecord()
      }, 360)
    }
  })
  recorder.onStop(async (result: { tempFilePath?: string }) => {
    const durationMs = Date.now() - recordStartedAt
    clearStartGuard()
    recorderState = 'idle'
    recordStartedAt = 0
    pendingStopAfterStart = false
    tapRecordingMode = false

    if (!result.tempFilePath || muted.value || durationMs < 350) {
      phase.value = 'idle'
      if (durationMs > 0 && durationMs < 350) {
        uni.showToast({ title: t.value.voiceCall.shortRecording, icon: 'none' })
      }
      return
    }

    phase.value = 'thinking'
    errorMessage.value = ''
    try {
      const turn = await sendVoiceChatTurn(result.tempFilePath)
      transcript.value = turn.transcript
      reply.value = turn.reply
      if (turn.coinReward.awarded) {
        uni.showToast({ title: `+${turn.coinReward.amount}`, icon: 'none' })
      }
      await playReply(turn.audioTempUrl)
    } catch (caughtError) {
      phase.value = 'error'
      errorMessage.value = getErrorText(caughtError) || t.value.voiceCall.failed
    }
  })
  recorder.onError((error: { errMsg?: string }) => {
    const message = error?.errMsg || ''
    clearStartGuard()

    if (isRecorderBusyError(message)) {
      recorderState = 'idle'
      recordStartedAt = 0
      pendingStopAfterStart = false
      tapRecordingMode = false
      phase.value = 'idle'
      return
    }

    recorderState = 'idle'
    recordStartedAt = 0
    phase.value = 'error'
    errorMessage.value = message || t.value.voiceCall.permissionDenied
  })

  return recorder
}

const ensureAudio = () => {
  if (audio) return audio

  const platformApi = getPlatformApi()
  if (typeof platformApi.createInnerAudioContext !== 'function') return audio

  audio = platformApi.createInnerAudioContext()
  audio.onEnded(() => {
    phase.value = 'idle'
  })
  audio.onError(() => {
    phase.value = 'idle'
  })

  return audio
}

const playReply = async (audioTempUrl?: string) => {
  if (!audioTempUrl || !speakerOn.value) {
    phase.value = 'idle'
    return
  }

  const player = ensureAudio()
  if (!player) {
    phase.value = 'idle'
    return
  }

  phase.value = 'playing'
  player.stop()
  player.src = audioTempUrl
  player.play()
}

const startRecord = async () => {
  if (phase.value === 'thinking' || phase.value === 'playing') return
  if (phase.value === 'recording' || recorderState !== 'idle') return
  if (muted.value) {
    uni.showToast({ title: t.value.voiceCall.mutedHint, icon: 'none' })
    return
  }

  const hasPermission = await ensureRecordPermission()
  if (!hasPermission || !talkPressing) {
    phase.value = hasPermission ? 'idle' : 'error'
    errorMessage.value = hasPermission ? '' : t.value.voiceCall.permissionDenied
    return
  }

  const activeRecorder = ensureRecorder()
  if (!activeRecorder) {
    phase.value = 'error'
    errorMessage.value = t.value.voiceCall.unsupported
    return
  }

  transcript.value = ''
  reply.value = ''
  errorMessage.value = ''
  phase.value = 'recording'
  recorderState = 'starting'
  pendingStopAfterStart = false
  audio?.stop()

  try {
    activeRecorder.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
    })
    clearStartGuard()
    startGuardTimer = setTimeout(() => {
      if (recorderState !== 'starting') return
      recorderState = 'idle'
      pendingStopAfterStart = false
      phase.value = 'error'
      errorMessage.value = t.value.voiceCall.permissionDenied
    }, 1800)
  } catch (caughtError) {
    const message = getErrorText(caughtError)
    recorderState = 'idle'
    recordStartedAt = 0
    phase.value = isRecorderBusyError(message) ? 'idle' : 'error'
    errorMessage.value = isRecorderBusyError(message) ? '' : message || t.value.voiceCall.failed
  }
}

const stopRecord = () => {
  if (recorderState === 'starting') {
    pendingStopAfterStart = true
    return
  }
  if (phase.value !== 'recording' || recorderState !== 'recording') return
  recorderState = 'stopping'
  clearStartGuard()
  try {
    recorder?.stop()
  } catch (caughtError) {
    const message = getErrorText(caughtError)
    recorderState = 'idle'
    recordStartedAt = 0
    if (!isRecorderBusyError(message)) {
      phase.value = 'error'
      errorMessage.value = message || t.value.voiceCall.failed
      return
    }
    phase.value = 'idle'
  }
}

const beginTalk = () => {
  if (tapRecordingMode) return
  talkPressing = true
  touchStartedAt = Date.now()
  clearHoldStartTimer()
  holdStartTimer = setTimeout(() => {
    if (!talkPressing || tapRecordingMode) return
    void startRecord()
  }, 180)
}

const endTalk = () => {
  const touchDurationMs = touchStartedAt ? Date.now() - touchStartedAt : 0
  touchStartedAt = 0
  clearHoldStartTimer()

  if (tapRecordingMode) return
  if (touchDurationMs >= 180) {
    suppressNextTapUntil = Date.now() + 420
  }
  talkPressing = false
  stopRecord()
}

const toggleTapRecord = () => {
  if (Date.now() < suppressNextTapUntil) return

  if (phase.value === 'recording' || recorderState === 'starting' || recorderState === 'recording') {
    tapRecordingMode = false
    talkPressing = false
    stopRecord()
    return
  }

  if (phase.value === 'thinking' || phase.value === 'playing') return

  tapRecordingMode = true
  talkPressing = true
  void startRecord()
}

const toggleMuted = () => {
  muted.value = !muted.value
  if (muted.value && phase.value === 'recording') stopRecord()
}

const toggleSpeaker = () => {
  speakerOn.value = !speakerOn.value
  if (!speakerOn.value) audio?.stop()
}

const endCall = () => {
  tapRecordingMode = false
  talkPressing = false
  if (phase.value === 'recording') stopRecord()
  audio?.stop()
  uni.navigateBack()
}

onMounted(() => {
  timer = setInterval(() => {
    elapsedSeconds.value += 1
  }, 1000)
  ensureRecorder()
  ensureAudio()
})

onBeforeUnmount(() => {
  stopTimer()
  clearStartGuard()
  clearHoldStartTimer()
  if (phase.value === 'recording') stopRecord()
  audio?.destroy?.()
})
</script>

<template>
  <view class="voice-call">
    <view class="voice-call__top">
      <button class="voice-call__back" @click="endCall">‹</button>
      <view>
        <view class="voice-call__name">{{ pet.name }}</view>
        <view class="voice-call__time">{{ elapsedLabel }}</view>
      </view>
      <view class="voice-call__top-spacer" />
    </view>

    <view class="voice-call__stage" :class="`voice-call__stage--${phase}`">
      <view class="voice-orbit voice-orbit--one" />
      <view class="voice-orbit voice-orbit--two" />
      <view class="voice-orbit voice-orbit--three" />
      <view class="voice-call__avatar">
        <PetLottieAvatar :size-rpx="320" />
      </view>
    </view>

    <view class="voice-call__status">{{ statusText }}</view>

    <view class="voice-call__captions">
      <view class="voice-call__caption-label">{{ t.voiceCall.you }}</view>
      <view class="voice-call__caption">{{ transcript || t.voiceCall.emptyTranscript }}</view>
      <view class="voice-call__caption-label voice-call__caption-label--reply">{{ pet.name }}</view>
      <view class="voice-call__caption voice-call__caption--reply">{{ reply || t.voiceCall.emptyReply }}</view>
    </view>

    <view class="voice-call__controls">
      <button class="voice-control" :class="{ 'voice-control--active': muted }" @click="toggleMuted">
        <view class="voice-control__icon voice-control__icon--mute" />
        <text>{{ muted ? t.voiceCall.unmute : t.voiceCall.mute }}</text>
      </button>
      <button
        class="voice-control voice-control--talk"
        :class="{ 'voice-control--recording': phase === 'recording' }"
        @touchstart.stop="beginTalk"
        @touchend.stop="endTalk"
        @touchcancel.stop="endTalk"
        @tap.stop="toggleTapRecord"
      >
        <view class="voice-control__icon voice-control__icon--mic" />
        <text>{{ phase === 'recording' ? t.voiceCall.releaseToSend : t.voiceCall.hold }}</text>
      </button>
      <button class="voice-control" :class="{ 'voice-control--active': speakerOn }" @click="toggleSpeaker">
        <view class="voice-control__icon voice-control__icon--speaker" />
        <text>{{ t.voiceCall.speaker }}</text>
      </button>
    </view>

    <button class="voice-call__end" @click="endCall">{{ t.voiceCall.end }}</button>
  </view>
</template>

<style scoped>
.voice-call {
  background:
    radial-gradient(circle at 50% 20%, rgba(255, 240, 176, 0.52), rgba(255, 240, 176, 0) 34%),
    linear-gradient(180deg, #eef9f5 0%, #fff8ec 58%, #f4fbef 100%);
  box-sizing: border-box;
  color: #253047;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  padding: calc(88rpx + env(safe-area-inset-top)) 28rpx calc(24rpx + env(safe-area-inset-bottom));
}

.voice-call__top {
  align-items: center;
  display: grid;
  grid-template-columns: 80rpx 1fr 80rpx;
  text-align: center;
}

.voice-call__back {
  background: rgba(255, 253, 248, 0.72);
  border: none;
  border-radius: 50%;
  color: #365f56;
  font-size: 54rpx;
  height: 70rpx;
  line-height: 62rpx;
  margin: 0;
  padding: 0;
  width: 70rpx;
}

.voice-call__back::after,
.voice-control::after,
.voice-call__end::after {
  border: none;
}

.voice-call__name {
  font-size: 36rpx;
  font-weight: 800;
}

.voice-call__time {
  color: #789185;
  font-size: 23rpx;
  margin-top: 8rpx;
}

.voice-call__stage {
  align-items: center;
  display: flex;
  flex: 0 0 500rpx;
  justify-content: center;
  min-height: 380rpx;
  position: relative;
}

.voice-orbit {
  border: 3rpx solid rgba(95, 199, 168, 0.18);
  border-radius: 50%;
  position: absolute;
}

.voice-orbit--one {
  height: 300rpx;
  width: 300rpx;
}

.voice-orbit--two {
  height: 390rpx;
  width: 390rpx;
}

.voice-orbit--three {
  height: 486rpx;
  width: 486rpx;
}

.voice-call__stage--recording .voice-orbit,
.voice-call__stage--thinking .voice-orbit,
.voice-call__stage--playing .voice-orbit {
  animation: voice-pulse 1.5s ease-in-out infinite;
}

.voice-call__stage--thinking .voice-orbit {
  border-color: rgba(240, 185, 74, 0.24);
}

.voice-call__stage--playing .voice-orbit {
  border-color: rgba(107, 212, 199, 0.28);
}

.voice-call__avatar {
  align-items: center;
  background: rgba(255, 253, 248, 0.76);
  border: 2rpx solid rgba(176, 143, 102, 0.12);
  border-radius: 50%;
  box-shadow: 0 28rpx 70rpx rgba(95, 199, 168, 0.16);
  display: flex;
  height: 320rpx;
  justify-content: center;
  overflow: hidden;
  width: 320rpx;
  z-index: 2;
}

.voice-call__status {
  color: #365f56;
  font-size: 30rpx;
  font-weight: 800;
  min-height: 44rpx;
  text-align: center;
}

.voice-call__captions {
  background: rgba(255, 253, 248, 0.7);
  border: 2rpx solid rgba(176, 143, 102, 0.12);
  border-radius: 28rpx;
  box-sizing: border-box;
  margin-top: 18rpx;
  padding: 22rpx;
}

.voice-call__caption-label {
  color: #8a7a68;
  font-size: 21rpx;
  font-weight: 700;
}

.voice-call__caption-label--reply {
  margin-top: 18rpx;
}

.voice-call__caption {
  color: #253047;
  font-size: 26rpx;
  line-height: 1.5;
  margin-top: 8rpx;
  min-height: 40rpx;
  word-break: break-word;
}

.voice-call__caption--reply {
  color: #365f56;
  font-weight: 700;
}

.voice-call__controls {
  align-items: center;
  display: grid;
  gap: 20rpx;
  grid-template-columns: 1fr 1.26fr 1fr;
  margin-top: 22rpx;
}

.voice-control {
  align-items: center;
  background: rgba(255, 253, 248, 0.86);
  border: none;
  border-radius: 30rpx;
  box-sizing: border-box;
  color: #365f56;
  display: flex;
  flex-direction: column;
  font-size: 22rpx;
  font-weight: 800;
  gap: 10rpx;
  height: 124rpx;
  justify-content: center;
  line-height: 1;
  margin: 0;
  padding: 0;
}

.voice-control--active {
  background: #e1f7ec;
}

.voice-control--talk {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  color: #173f38;
  height: 150rpx;
}

.voice-control--recording {
  background: linear-gradient(135deg, #ffd587, #ffb199);
}

.voice-control__icon {
  height: 34rpx;
  position: relative;
  width: 34rpx;
}

.voice-control__icon--mic {
  border: 5rpx solid currentColor;
  border-radius: 18rpx;
  box-sizing: border-box;
  height: 36rpx;
  width: 24rpx;
}

.voice-control__icon--mute::before,
.voice-control__icon--speaker::before {
  background: currentColor;
  border-radius: 8rpx;
  content: '';
  height: 28rpx;
  left: 6rpx;
  position: absolute;
  top: 3rpx;
  width: 14rpx;
}

.voice-control__icon--mute::after {
  background: currentColor;
  content: '';
  height: 5rpx;
  left: 3rpx;
  position: absolute;
  top: 15rpx;
  transform: rotate(-38deg);
  width: 32rpx;
}

.voice-control__icon--speaker::after {
  border: 4rpx solid currentColor;
  border-bottom-color: transparent;
  border-left-color: transparent;
  border-radius: 50%;
  border-top-color: transparent;
  content: '';
  height: 26rpx;
  position: absolute;
  right: 0;
  top: 2rpx;
  width: 26rpx;
}

.voice-call__end {
  background: #ff7f7f;
  border: none;
  border-radius: 999rpx;
  color: #fff;
  font-size: 28rpx;
  font-weight: 800;
  height: 82rpx;
  line-height: 82rpx;
  margin: 18rpx 0 0;
  padding: 0;
}

@keyframes voice-pulse {
  0%,
  100% {
    opacity: 0.42;
    transform: scale(0.98);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}
</style>
