<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import PetLottieAvatar from '../components/PetLottieAvatar.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

type CallPhase = 'idle' | 'recording' | 'thinking' | 'playing' | 'error'
type RecorderState = 'idle' | 'recording' | 'stopping'

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

const ensureRecorder = () => {
  if (recorder || typeof uni.getRecorderManager !== 'function') return recorder

  recorder = uni.getRecorderManager()
  recorder.onStop(async (result: { tempFilePath?: string }) => {
    const durationMs = Date.now() - recordStartedAt
    recorderState = 'idle'
    recordStartedAt = 0

    if (!result.tempFilePath || muted.value || durationMs < 350) {
      phase.value = 'idle'
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
      errorMessage.value = caughtError instanceof Error ? caughtError.message : t.value.voiceCall.failed
    }
  })
  recorder.onError((error: { errMsg?: string }) => {
    const message = error?.errMsg || ''

    if (isRecorderBusyError(message) && (recorderState === 'recording' || recorderState === 'stopping')) {
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
  if (audio || typeof uni.createInnerAudioContext !== 'function') return audio

  audio = uni.createInnerAudioContext()
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

const startRecord = () => {
  if (phase.value === 'thinking' || phase.value === 'playing') return
  if (phase.value === 'recording' || recorderState !== 'idle') return
  if (muted.value) {
    uni.showToast({ title: t.value.voiceCall.mutedHint, icon: 'none' })
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
  recorderState = 'recording'
  recordStartedAt = Date.now()
  audio?.stop()

  try {
    activeRecorder.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
    })
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
    recorderState = 'idle'
    recordStartedAt = 0
    phase.value = isRecorderBusyError(message) ? 'idle' : 'error'
    errorMessage.value = isRecorderBusyError(message) ? '' : message || t.value.voiceCall.failed
  }
}

const stopRecord = () => {
  if (phase.value !== 'recording' || recorderState !== 'recording') return
  recorderState = 'stopping'
  try {
    recorder?.stop()
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
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

const toggleMuted = () => {
  muted.value = !muted.value
  if (muted.value && phase.value === 'recording') stopRecord()
}

const toggleSpeaker = () => {
  speakerOn.value = !speakerOn.value
  if (!speakerOn.value) audio?.stop()
}

const endCall = () => {
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
        <PetLottieAvatar :size-rpx="360" />
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
        @touchstart.prevent="startRecord"
        @touchend.prevent="stopRecord"
        @touchcancel.prevent="stopRecord"
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
  padding: calc(108rpx + env(safe-area-inset-top)) 28rpx calc(28rpx + env(safe-area-inset-bottom));
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
  flex: 1;
  justify-content: center;
  min-height: 430rpx;
  position: relative;
}

.voice-orbit {
  border: 3rpx solid rgba(95, 199, 168, 0.18);
  border-radius: 50%;
  position: absolute;
}

.voice-orbit--one {
  height: 330rpx;
  width: 330rpx;
}

.voice-orbit--two {
  height: 430rpx;
  width: 430rpx;
}

.voice-orbit--three {
  height: 540rpx;
  width: 540rpx;
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
  height: 360rpx;
  justify-content: center;
  overflow: hidden;
  width: 360rpx;
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
  margin-top: 24rpx;
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
  margin-top: 34rpx;
}

.voice-control {
  align-items: center;
  background: rgba(255, 253, 248, 0.86);
  border: none;
  border-radius: 30rpx;
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
  margin: 24rpx 0 0;
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
