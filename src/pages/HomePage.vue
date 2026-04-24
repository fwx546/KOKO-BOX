<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PetMiniGameDrawer from '../components/PetMiniGameDrawer.vue'
import { useKokoState } from '../composables/useKokoState'
import type { MiniGameResult, PetActionType } from '../types/koko'

const FRAME_COUNT = 16
const STEP_PX = 18

const {
  pet,
  carePet,
  getPetQuickReply,
  getDigestStatus,
  metrics,
  messages,
  sendChatMessage,
  clearMessages,
  settings,
  setPetRotationFrame,
} = useKokoState()

const petAction = ref<PetActionType>('idle')
const petBubble = ref('')
const showBubble = ref(false)
const chatDraft = ref('')
const sending = ref(false)
const gameDrawerOpen = ref(false)
const historyOpen = ref(false)
const activeGame = ref<'catch' | 'bubble'>('catch')
const nowMs = ref(Date.now())
const rotationFrame = ref(pet.value.rotationFrame ?? 0)
const dragging = ref(false)

let tapTimer: ReturnType<typeof setTimeout> | undefined
let bubbleTimer: ReturnType<typeof setTimeout> | undefined
let actionTimer: ReturnType<typeof setTimeout> | undefined
let digestTimer: ReturnType<typeof setInterval> | undefined
let dragStartX = 0
let movedDistance = 0
let carryDistance = 0

const moodLabel = computed(() => {
  if (pet.value.mood >= 85) return 'Feeling great'
  if (pet.value.mood >= 65) return 'Relaxed'
  if (pet.value.mood >= 45) return 'Needs company'
  return 'Needs care'
})

const sceneStatusLabel = computed(() => {
  if (pet.value.state === 'hungry') return `${pet.value.name} wants food`
  if (pet.value.state === 'tired') return `${pet.value.name} needs rest`
  if (pet.value.state === 'low') return `${pet.value.name} needs comfort`
  if (pet.value.state === 'sick') return `${pet.value.name} needs attention`
  if (pet.value.state === 'resting') return `${pet.value.name} is resting`
  return 'Stable and ready to play'
})

const digestStatus = computed(() => getDigestStatus(pet.value, nowMs.value))
const feedStatusLabel = computed(() =>
  digestStatus.value.isDigesting ? `Digesting ${digestStatus.value.digestCountdownLabel}` : 'Can feed now',
)

const compactStats = computed(() => [
  { label: 'Mood', value: pet.value.mood, tint: 'sun' },
  { label: 'Energy', value: pet.value.energy, tint: 'leaf' },
  { label: 'Bond', value: pet.value.intimacy, tint: 'sky' },
])

const stageFacts = computed(() => [
  `${pet.value.stage}`,
  `${pet.value.facingDirection ?? 'front'} view`,
  `${metrics.value.interactions} taps`,
])

const recentMessages = computed(() =>
  messages.value.slice(-18).map((item) => ({
    ...item,
    displayContent: settings.value.hideChats && item.role === 'user' ? 'Hidden user message' : item.content,
  })),
)

const lastAssistantMessage = computed(() => {
  const assistant = [...messages.value].reverse().find((item) => item.role === 'assistant')
  return assistant?.content ?? 'Stay with me for a while.'
})

const overlayChatCollapsed = computed(() => historyOpen.value || gameDrawerOpen.value)
const petFacingScale = computed(() => (rotationFrame.value > 7 ? -1 : 1))

const careActions: Array<{
  key: 'feedMeal' | 'feedWater' | 'play' | 'clean'
  label: string
  action: PetActionType
}> = [
  { key: 'feedMeal', label: 'Feed', action: 'munch' },
  { key: 'feedWater', label: 'Water', action: 'sip' },
  { key: 'play', label: 'Play', action: 'sparkle' },
  { key: 'clean', label: 'Clean', action: 'stretch' },
]

const interactiveActions: Array<{ action: PetActionType; bubble: string }> = [
  { action: 'pounce', bubble: 'I am in a playful mood.' },
  { action: 'spin', bubble: 'Look at me turn around.' },
  { action: 'nuzzle', bubble: 'Stay close to me a little longer.' },
  { action: 'chase', bubble: 'I almost caught my tail.' },
  { action: 'stretch', bubble: 'That stretch feels good.' },
]

const clearTimers = () => {
  if (tapTimer) clearTimeout(tapTimer)
  if (bubbleTimer) clearTimeout(bubbleTimer)
  if (actionTimer) clearTimeout(actionTimer)
  if (digestTimer) clearInterval(digestTimer)
  tapTimer = undefined
  bubbleTimer = undefined
  actionTimer = undefined
  digestTimer = undefined
}

const queueIdleReset = (duration = 1800) => {
  if (actionTimer) clearTimeout(actionTimer)
  actionTimer = setTimeout(() => {
    petAction.value = 'idle'
  }, duration)
}

const showPetBubbleFor = (message: string, duration = 2200) => {
  petBubble.value = message
  showBubble.value = true
  if (bubbleTimer) clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => {
    showBubble.value = false
  }, duration)
}

const triggerPetAction = (action: PetActionType, message: string, duration = 2200) => {
  petAction.value = action
  showPetBubbleFor(message, duration)
  queueIdleReset(duration)
}

const handleSingleTap = async () => {
  const reply = await getPetQuickReply('home-tap')
  triggerPetAction(reply.action === 'idle' ? 'greet' : reply.action, reply.content)
}

const handleDoubleTap = () => {
  const next = interactiveActions[Math.floor(Math.random() * interactiveActions.length)]
  triggerPetAction(next.action, next.bubble, 2400)
}

const handlePetTap = () => {
  if (tapTimer) {
    clearTimeout(tapTimer)
    tapTimer = undefined
    handleDoubleTap()
    return
  }

  tapTimer = setTimeout(() => {
    tapTimer = undefined
    void handleSingleTap()
  }, 220)
}

const handleRotate = (frame: number) => {
  rotationFrame.value = frame
}

const handleRotateEnd = (frame: number) => {
  rotationFrame.value = frame
  setPetRotationFrame(frame)
}

const normalizeFrame = (value: number) => ((Math.round(value) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT

const applyRotationDelta = (deltaX: number) => {
  carryDistance += deltaX
  const steps = carryDistance > 0 ? Math.floor(carryDistance / STEP_PX) : Math.ceil(carryDistance / STEP_PX)
  if (steps === 0) return
  carryDistance -= steps * STEP_PX
  handleRotate(normalizeFrame(rotationFrame.value + steps))
}

const touchX = (event: any) => event?.touches?.[0]?.pageX ?? event?.changedTouches?.[0]?.pageX ?? 0

const beginPetDrag = (event: any) => {
  dragging.value = true
  dragStartX = touchX(event)
  movedDistance = 0
  carryDistance = 0
}

const movePetDrag = (event: any) => {
  if (!dragging.value) return
  const nextX = touchX(event)
  const delta = nextX - dragStartX
  dragStartX = nextX
  movedDistance += Math.abs(delta)
  applyRotationDelta(delta)
}

const endPetDrag = () => {
  if (!dragging.value) return
  const wasTap = movedDistance < 10
  dragging.value = false
  carryDistance = 0
  if (wasTap) handlePetTap()
  handleRotateEnd(rotationFrame.value)
}

const performCare = (action: (typeof careActions)[number]) => {
  if (action.key === 'play') {
    activeGame.value = 'catch'
    gameDrawerOpen.value = true
    triggerPetAction(action.action, 'Game time is ready.', 2200)
    return
  }

  const result = carePet(action.key)
  triggerPetAction(result.success ? action.action : 'greet', result.message, result.success ? 2200 : 2600)
}

const submitChat = async (content: string) => {
  if (!content.trim() || sending.value) return
  sending.value = true
  try {
    await sendChatMessage(content)
    showPetBubbleFor(lastAssistantMessage.value, 2600)
  } finally {
    sending.value = false
  }
}

const submitOverlayChat = async () => {
  const value = chatDraft.value.trim()
  if (!value || sending.value) return
  chatDraft.value = ''
  await submitChat(value)
}

const handleGameComplete = (result: MiniGameResult) => {
  const message =
    result.gameType === 'catch'
      ? `Catch score ${result.score}. Nice teamwork.`
      : `Bubble score ${result.score}. I had fun.`
  triggerPetAction('sparkle', message, 2600)
}

watch(
  () => pet.value.rotationFrame,
  (value) => {
    rotationFrame.value = value ?? 0
  },
  { immediate: true },
)

digestTimer = setInterval(() => {
  nowMs.value = Date.now()
}, 1000)

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <view class="home-screen">
    <view class="home-screen__background">
      <view class="sky-glow sky-glow--left" />
      <view class="sky-glow sky-glow--right" />
      <view class="cloud cloud--one" />
      <view class="cloud cloud--two" />
      <view class="mountain mountain--back" />
      <view class="mountain mountain--front" />
      <view class="tree tree--left">
        <view class="tree__crown" />
        <view class="tree__trunk" />
      </view>
      <view class="tree tree--right">
        <view class="tree__crown" />
        <view class="tree__trunk" />
      </view>
      <view class="hill hill--one" />
      <view class="hill hill--two" />
      <view class="flowers flowers--left" />
      <view class="flowers flowers--right" />
    </view>

    <view class="home-screen__content">
      <view class="home-topbar">
        <view class="home-topbar__title-block">
          <view class="home-topbar__eyebrow">PET HOME</view>
          <view class="home-topbar__title">{{ pet.name }}</view>
          <view class="home-topbar__subtitle">{{ sceneStatusLabel }}</view>
        </view>

        <view class="home-topbar__chips">
          <view class="home-chip">{{ moodLabel }}</view>
          <view class="home-chip home-chip--soft">{{ feedStatusLabel }}</view>
        </view>
      </view>

      <view class="home-status-panel">
        <view class="home-status-panel__head">
          <view>Today</view>
          <view>{{ stageFacts.join(' - ') }}</view>
        </view>
        <view class="home-status-panel__bar">
          <view
            class="home-status-panel__fill"
            :style="{ width: `${Math.max(18, Math.round((pet.hunger + pet.mood + pet.energy) / 3))}%` }"
          />
        </view>
      </view>

      <view class="home-stage">
        <view v-if="showBubble" class="pet-bubble">{{ petBubble }}</view>

        <view v-if="digestStatus.isDigesting" class="home-stage__digest">
          {{ `Digesting ${digestStatus.digestCountdownLabel}` }}
        </view>

        <view class="home-stage__progress">
          <view v-for="item in compactStats" :key="item.label" class="home-progress-card">
            <view class="home-progress-card__label">{{ item.label }}</view>
            <view class="home-progress-card__track">
              <view class="home-progress-card__fill" :class="`home-progress-card__fill--${item.tint}`" :style="{ width: `${item.value}%` }" />
            </view>
          </view>
        </view>

        <view class="home-stage__model">
          <view
            class="pet-model-stage"
            @touchstart.stop="beginPetDrag($event)"
            @touchmove.stop.prevent="movePetDrag($event)"
            @touchend.stop="endPetDrag"
            @touchcancel.stop="endPetDrag"
          >
            <view class="pet-model-stage__halo" />
            <view class="pet-model-stage__platform" />
            <view class="pet-model-stage__hint">{{ dragging ? 'Drag' : 'Swipe' }}</view>

            <view class="pet-cat" :class="`pet-cat--${petAction}`" :style="{ transform: `scaleX(${petFacingScale})` }">
              <view class="pet-cat__tail" />
              <view class="pet-cat__body">
                <view class="pet-cat__belly" />
                <view class="pet-cat__paw pet-cat__paw--left" />
                <view class="pet-cat__paw pet-cat__paw--right" />
              </view>
              <view class="pet-cat__head">
                <view class="pet-cat__ear pet-cat__ear--left">
                  <view class="pet-cat__ear-inner" />
                </view>
                <view class="pet-cat__ear pet-cat__ear--right">
                  <view class="pet-cat__ear-inner" />
                </view>
                <view class="pet-cat__patch pet-cat__patch--left" />
                <view class="pet-cat__patch pet-cat__patch--right" />
                <view class="pet-cat__eye pet-cat__eye--left" />
                <view class="pet-cat__eye pet-cat__eye--right" />
                <view class="pet-cat__blush pet-cat__blush--left" />
                <view class="pet-cat__blush pet-cat__blush--right" />
                <view class="pet-cat__nose" />
                <view class="pet-cat__mouth" />
                <view class="pet-cat__whiskers pet-cat__whiskers--left" />
                <view class="pet-cat__whiskers pet-cat__whiskers--right" />
              </view>
              <view class="pet-cat__collar">
                <view class="pet-cat__bell" />
              </view>
            </view>
          </view>
        </view>

        <view class="home-stage__rail">
          <button
            v-for="action in careActions"
            :key="action.key"
            class="home-action-pill"
            :class="{ 'home-action-pill--disabled': action.key === 'feedMeal' && !digestStatus.canFeedMeal }"
            @click="performCare(action)"
          >
            <view class="home-action-pill__title">{{ action.label }}</view>
          </button>
        </view>

        <view class="home-stage__chat">
          <view class="pet-chat-card" :class="{ 'pet-chat-card--collapsed': overlayChatCollapsed }">
            <view class="pet-chat-card__bar">
              <input
                v-model="chatDraft"
                class="pet-chat-card__field"
                :disabled="overlayChatCollapsed"
                :placeholder="lastAssistantMessage"
                confirm-type="send"
                @confirm="submitOverlayChat"
              />
              <button class="pet-chat-card__history" @click="historyOpen = true">Log</button>
              <button class="pet-chat-card__send" :disabled="overlayChatCollapsed || sending" @click="submitOverlayChat">
                {{ sending ? 'Sending' : 'Send' }}
              </button>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="historyOpen" class="chat-history-layer">
      <view class="chat-history-layer__mask" @click="historyOpen = false" />
      <view class="chat-history-layer__panel">
        <view class="chat-history-layer__head">
          <view>
            <view class="chat-history-layer__eyebrow">CHAT LOG</view>
            <view class="chat-history-layer__title">Messages with {{ pet.name }}</view>
          </view>
          <view class="chat-history-layer__actions">
            <button class="chat-history-layer__ghost" @click="clearMessages">Clear</button>
            <button class="chat-history-layer__ghost" @click="historyOpen = false">Close</button>
          </view>
        </view>

        <scroll-view scroll-y class="chat-history-layer__body">
          <view
            v-for="message in recentMessages"
            :key="message.id"
            class="chat-history-layer__bubble"
            :class="message.role === 'assistant' ? 'chat-history-layer__bubble--assistant' : 'chat-history-layer__bubble--user'"
          >
            <view class="chat-history-layer__role">{{ message.role === 'assistant' ? pet.name : 'You' }}</view>
            <view class="chat-history-layer__content">{{ message.displayContent }}</view>
          </view>
        </scroll-view>
      </view>
    </view>

    <PetMiniGameDrawer
      v-model="gameDrawerOpen"
      :default-game="activeGame"
      @complete="handleGameComplete"
    />
  </view>
</template>

<style scoped>
.home-screen {
  background: linear-gradient(180deg, #dff5ff 0%, #dff5fd 42%, #f3f9eb 100%);
  box-sizing: border-box;
  height: 100vh;
  left: 0;
  overflow: hidden;
  position: fixed;
  right: 0;
  top: 0;
}

.home-screen__background {
  inset: 0;
  overflow: hidden;
  position: absolute;
}

.home-screen__content {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: calc(24rpx + env(safe-area-inset-top)) 24rpx 18rpx;
  position: relative;
  z-index: 1;
}

.sky-glow,
.cloud,
.mountain,
.tree,
.hill,
.flowers {
  position: absolute;
}

.sky-glow {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0));
  border-radius: 50%;
  height: 340rpx;
  top: 10rpx;
  width: 340rpx;
}

.sky-glow--left {
  left: -40rpx;
}

.sky-glow--right {
  right: -20rpx;
  top: 80rpx;
}

.cloud {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999rpx;
  height: 48rpx;
  width: 170rpx;
}

.cloud::before,
.cloud::after {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  content: '';
  position: absolute;
}

.cloud::before {
  height: 70rpx;
  left: 22rpx;
  top: -26rpx;
  width: 70rpx;
}

.cloud::after {
  height: 62rpx;
  right: 20rpx;
  top: -18rpx;
  width: 62rpx;
}

.cloud--one {
  left: 70rpx;
  top: 120rpx;
}

.cloud--two {
  right: 56rpx;
  top: 172rpx;
}

.mountain {
  background: linear-gradient(180deg, #b7e2da, #90ccc2);
  border-radius: 44% 44% 0 0;
  bottom: 400rpx;
}

.mountain--back {
  height: 280rpx;
  left: -40rpx;
  width: 480rpx;
}

.mountain--front {
  background: linear-gradient(180deg, #cbeec1, #a6dc8a);
  bottom: 350rpx;
  height: 250rpx;
  right: -100rpx;
  width: 540rpx;
}

.tree {
  bottom: 318rpx;
}

.tree__crown {
  background: radial-gradient(circle at 38% 30%, #8ae18f, #5abb66 64%, #479f55 100%);
  border-radius: 50%;
  box-shadow: 0 12rpx 28rpx rgba(80, 156, 88, 0.16);
  height: 130rpx;
  width: 138rpx;
}

.tree__trunk {
  background: linear-gradient(180deg, #9b6b41, #7a5333);
  border-radius: 20rpx;
  height: 82rpx;
  left: 54rpx;
  position: absolute;
  top: 100rpx;
  width: 26rpx;
}

.tree--left {
  left: 48rpx;
}

.tree--right {
  bottom: 298rpx;
  right: 60rpx;
  transform: scale(1.1);
}

.hill {
  background: linear-gradient(180deg, #97dd88, #74c969);
  border-radius: 50% 50% 0 0;
  bottom: -36rpx;
  height: 360rpx;
}

.hill--one {
  left: -40rpx;
  width: 450rpx;
}

.hill--two {
  background: linear-gradient(180deg, #aae18f, #84d26d);
  right: -70rpx;
  width: 500rpx;
}

.flowers {
  background:
    radial-gradient(circle at 20% 40%, #ffd86b 0, #ffd86b 14rpx, transparent 15rpx),
    radial-gradient(circle at 50% 30%, #ff8ba2 0, #ff8ba2 12rpx, transparent 13rpx),
    radial-gradient(circle at 82% 45%, #8ad8ff 0, #8ad8ff 13rpx, transparent 14rpx);
  bottom: 180rpx;
  height: 90rpx;
  width: 160rpx;
}

.flowers--left {
  left: 24rpx;
}

.flowers--right {
  right: 34rpx;
}

.home-topbar {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
}

.home-topbar__title-block {
  color: #1e3945;
}

.home-topbar__eyebrow {
  color: #5c8a78;
  font-size: 22rpx;
  letter-spacing: 4rpx;
}

.home-topbar__title {
  font-size: 44rpx;
  font-weight: 700;
  margin-top: 6rpx;
}

.home-topbar__subtitle {
  color: rgba(30, 57, 69, 0.72);
  font-size: 24rpx;
  margin-top: 6rpx;
}

.home-topbar__chips {
  display: grid;
  gap: 10rpx;
}

.home-chip {
  background: rgba(255, 255, 255, 0.84);
  border: 2rpx solid rgba(164, 213, 178, 0.55);
  border-radius: 999rpx;
  color: #356050;
  font-size: 22rpx;
  padding: 12rpx 20rpx;
  text-align: center;
}

.home-chip--soft {
  border-color: rgba(116, 194, 220, 0.42);
  color: #35657e;
}

.home-status-panel {
  backdrop-filter: blur(12rpx);
  background: rgba(255, 255, 255, 0.62);
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 26rpx;
  box-shadow: 0 16rpx 34rpx rgba(98, 150, 126, 0.12);
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
}

.home-status-panel__head {
  align-items: center;
  color: #3d6070;
  display: flex;
  font-size: 22rpx;
  justify-content: space-between;
}

.home-status-panel__bar {
  background: rgba(179, 220, 193, 0.48);
  border-radius: 999rpx;
  height: 14rpx;
  margin-top: 12rpx;
  overflow: hidden;
}

.home-status-panel__fill {
  background: linear-gradient(90deg, #f5c95d, #88d681, #68c7df);
  border-radius: inherit;
  height: 100%;
}

.home-stage {
  flex: 1;
  margin-top: 14rpx;
  min-height: 0;
  position: relative;
}

.pet-bubble {
  background: rgba(255, 255, 255, 0.94);
  border-radius: 28rpx;
  color: #305163;
  font-size: 24rpx;
  left: 12rpx;
  line-height: 1.5;
  max-width: 390rpx;
  padding: 18rpx 22rpx;
  position: absolute;
  top: 0;
  z-index: 6;
}

.pet-bubble::after {
  border-color: rgba(255, 255, 255, 0.94) transparent transparent;
  border-style: solid;
  border-width: 18rpx 16rpx 0;
  content: '';
  left: 40rpx;
  position: absolute;
  top: 100%;
}

.home-stage__digest {
  backdrop-filter: blur(10rpx);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999rpx;
  color: #cc7b3e;
  font-size: 21rpx;
  left: 12rpx;
  padding: 12rpx 20rpx;
  position: absolute;
  top: 94rpx;
  z-index: 5;
}

.home-stage__progress {
  display: grid;
  gap: 12rpx;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  left: 0;
  position: absolute;
  right: 154rpx;
  top: 94rpx;
  z-index: 4;
}

.home-progress-card {
  backdrop-filter: blur(10rpx);
  background: rgba(255, 255, 255, 0.7);
  border-radius: 22rpx;
  padding: 14rpx 16rpx 16rpx;
}

.home-progress-card__label {
  color: #54707a;
  font-size: 20rpx;
}

.home-progress-card__track {
  background: rgba(180, 215, 203, 0.42);
  border-radius: 999rpx;
  height: 14rpx;
  margin-top: 12rpx;
  overflow: hidden;
}

.home-progress-card__fill {
  border-radius: inherit;
  height: 100%;
}

.home-progress-card__fill--sun {
  background: linear-gradient(90deg, #f8cb64, #f0b94a);
}

.home-progress-card__fill--leaf {
  background: linear-gradient(90deg, #8bd682, #5cc483);
}

.home-progress-card__fill--sky {
  background: linear-gradient(90deg, #7fd4ed, #61b8f0);
}

.home-stage__model {
  bottom: 154rpx;
  left: 0;
  min-height: 420rpx;
  position: absolute;
  right: 144rpx;
  top: 166rpx;
  z-index: 3;
}

.home-stage__rail {
  display: grid;
  gap: 14rpx;
  justify-items: center;
  position: absolute;
  right: 0;
  top: 102rpx;
  width: 120rpx;
  z-index: 4;
}

.home-action-pill {
  align-items: center;
  background: rgba(255, 255, 255, 0.86);
  border: none;
  border-radius: 50%;
  box-shadow: 0 16rpx 30rpx rgba(84, 143, 110, 0.12);
  color: #31586b;
  display: flex;
  height: 110rpx;
  justify-content: center;
  padding: 0;
  width: 110rpx;
}

.home-action-pill::after,
.chat-history-layer__ghost::after,
.pet-chat-card__history::after,
.pet-chat-card__send::after {
  border: none;
}

.home-action-pill--disabled {
  opacity: 0.72;
}

.home-action-pill__title {
  font-size: 26rpx;
  font-weight: 700;
}

.home-stage__chat {
  bottom: calc(18rpx + env(safe-area-inset-bottom));
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 470rpx;
  z-index: 6;
}

.pet-model-stage {
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.pet-model-stage__halo {
  background: radial-gradient(circle, rgba(255, 245, 197, 0.72), rgba(255, 245, 197, 0));
  border-radius: 50%;
  height: 420rpx;
  position: absolute;
  width: 420rpx;
}

.pet-model-stage__platform {
  background: radial-gradient(circle, rgba(81, 138, 77, 0.16), rgba(81, 138, 77, 0));
  border-radius: 50%;
  bottom: 84rpx;
  height: 64rpx;
  position: absolute;
  width: 250rpx;
}

.pet-model-stage__hint {
  background: rgba(255, 255, 255, 0.78);
  border-radius: 999rpx;
  bottom: 18rpx;
  color: #47667a;
  font-size: 20rpx;
  left: 50%;
  padding: 10rpx 18rpx;
  position: absolute;
  transform: translateX(-50%);
}

.pet-cat {
  height: 420rpx;
  position: relative;
  width: 280rpx;
}

.pet-cat__tail {
  background: linear-gradient(180deg, #ffd98d, #f0bf65);
  border-radius: 999rpx;
  height: 124rpx;
  left: 204rpx;
  position: absolute;
  top: 148rpx;
  transform: rotate(34deg);
  width: 38rpx;
}

.pet-cat__body {
  background: linear-gradient(180deg, #fff5d7 0%, #ffe7af 100%);
  border-radius: 44% 44% 40% 40%;
  bottom: 42rpx;
  box-shadow: 0 10rpx 34rpx rgba(255, 196, 107, 0.22);
  height: 220rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 190rpx;
}

.pet-cat__belly {
  background: rgba(255, 250, 238, 0.92);
  border-radius: 44% 44% 38% 38%;
  bottom: 24rpx;
  height: 118rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 110rpx;
}

.pet-cat__paw {
  background: linear-gradient(180deg, #ffe3a5, #f6ca77);
  border-radius: 28rpx;
  bottom: -6rpx;
  height: 70rpx;
  position: absolute;
  width: 34rpx;
}

.pet-cat__paw--left {
  left: 54rpx;
}

.pet-cat__paw--right {
  right: 54rpx;
}

.pet-cat__head {
  background: linear-gradient(180deg, #fff9e6 0%, #ffeab8 100%);
  border-radius: 44% 44% 42% 42%;
  box-shadow: 0 10rpx 28rpx rgba(255, 210, 133, 0.18);
  height: 164rpx;
  left: 50%;
  position: absolute;
  top: 72rpx;
  transform: translateX(-50%);
  width: 176rpx;
}

.pet-cat__ear {
  background: linear-gradient(180deg, #ffeab8, #ffd584);
  border-radius: 34rpx 34rpx 12rpx 12rpx;
  height: 64rpx;
  position: absolute;
  top: -24rpx;
  width: 42rpx;
}

.pet-cat__ear--left {
  left: 28rpx;
  transform: rotate(-10deg);
}

.pet-cat__ear--right {
  right: 28rpx;
  transform: rotate(10deg);
}

.pet-cat__ear-inner {
  background: rgba(255, 183, 183, 0.72);
  border-radius: 26rpx;
  bottom: 12rpx;
  left: 9rpx;
  position: absolute;
  right: 9rpx;
  top: 12rpx;
}

.pet-cat__patch {
  background: linear-gradient(180deg, #ffcc8b, #f3b262);
  border-radius: 22rpx;
  height: 34rpx;
  position: absolute;
  top: 14rpx;
  width: 30rpx;
}

.pet-cat__patch--left {
  left: 26rpx;
  transform: rotate(-20deg);
}

.pet-cat__patch--right {
  right: 26rpx;
  transform: rotate(20deg);
}

.pet-cat__eye {
  background: #6d665a;
  border-radius: 999rpx;
  height: 22rpx;
  position: absolute;
  top: 64rpx;
  width: 14rpx;
}

.pet-cat__eye--left {
  left: 58rpx;
}

.pet-cat__eye--right {
  right: 58rpx;
}

.pet-cat__blush {
  background: rgba(255, 179, 179, 0.52);
  border-radius: 50%;
  height: 24rpx;
  position: absolute;
  top: 88rpx;
  width: 30rpx;
}

.pet-cat__blush--left {
  left: 30rpx;
}

.pet-cat__blush--right {
  right: 30rpx;
}

.pet-cat__nose {
  background: #ffbb94;
  border-radius: 12rpx;
  height: 16rpx;
  left: 50%;
  position: absolute;
  top: 92rpx;
  transform: translateX(-50%);
  width: 18rpx;
}

.pet-cat__mouth {
  border-bottom: 4rpx solid #9d7b63;
  border-radius: 0 0 36rpx 36rpx;
  height: 18rpx;
  left: 50%;
  position: absolute;
  top: 110rpx;
  transform: translateX(-50%);
  width: 36rpx;
}

.pet-cat__whiskers {
  border-top: 3rpx solid rgba(113, 95, 83, 0.32);
  position: absolute;
  top: 108rpx;
  width: 34rpx;
}

.pet-cat__whiskers--left {
  left: 10rpx;
  transform: rotate(4deg);
}

.pet-cat__whiskers--right {
  right: 10rpx;
  transform: rotate(-4deg);
}

.pet-cat__collar {
  background: linear-gradient(90deg, #86d9f6, #5ab9ec);
  border-radius: 999rpx;
  bottom: 134rpx;
  height: 22rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 98rpx;
}

.pet-cat__bell {
  background: linear-gradient(180deg, #ffd86f, #f9a742);
  border-radius: 50%;
  height: 24rpx;
  left: 50%;
  position: absolute;
  top: 10rpx;
  transform: translateX(-50%);
  width: 24rpx;
}

.pet-cat--idle .pet-cat__body,
.pet-cat--idle .pet-cat__head {
  animation: pet-float 2.8s ease-in-out infinite;
}

.pet-cat--idle .pet-cat__tail,
.pet-cat--chase .pet-cat__tail {
  animation: pet-tail 1.2s ease-in-out infinite;
}

.pet-cat--greet .pet-cat__head,
.pet-cat--nuzzle .pet-cat__head {
  animation: pet-nuzzle 0.7s ease-in-out infinite alternate;
}

.pet-cat--pounce {
  animation: pet-bounce 0.5s ease-in-out infinite alternate;
}

.pet-cat--spin {
  animation: pet-spin 0.9s ease-in-out 1;
}

.pet-cat--stretch .pet-cat__body {
  animation: pet-stretch 0.8s ease-in-out infinite alternate;
}

.pet-cat--munch .pet-cat__mouth {
  animation: pet-mouth 0.34s ease-in-out infinite;
}

.pet-cat--sip .pet-cat__head {
  animation: pet-sip 0.82s ease-in-out infinite;
}

.pet-cat--sparkle .pet-cat__body,
.pet-cat--sparkle .pet-cat__head {
  animation: pet-float 1.2s ease-in-out infinite;
}

.pet-chat-card {
  background: transparent;
  position: relative;
}

.pet-chat-card--collapsed {
  opacity: 0.34;
  transform: scale(0.98);
}

.pet-chat-card__bar {
  align-items: center;
  display: flex;
  gap: 12rpx;
}

.pet-chat-card__field {
  backdrop-filter: blur(24rpx);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(238, 249, 255, 0.2)),
    rgba(255, 255, 255, 0.12);
  border: 2rpx solid rgba(208, 240, 255, 0.55);
  border-radius: 999rpx;
  color: #244456;
  flex: 1;
  font-size: 23rpx;
  height: 76rpx;
  padding: 0 24rpx;
}

.pet-chat-card__history,
.pet-chat-card__send {
  align-items: center;
  backdrop-filter: blur(18rpx);
  background: rgba(255, 255, 255, 0.34);
  border: none;
  border-radius: 999rpx;
  color: #315b74;
  display: flex;
  font-size: 22rpx;
  font-weight: 700;
  height: 76rpx;
  justify-content: center;
  min-width: 92rpx;
  padding: 0 22rpx;
}

.chat-history-layer {
  inset: 0;
  position: fixed;
  z-index: 40;
}

.chat-history-layer__mask {
  background: rgba(19, 37, 49, 0.28);
  inset: 0;
  position: absolute;
}

.chat-history-layer__panel {
  background: linear-gradient(180deg, #f8fcff 0%, #eef7ff 100%);
  border-radius: 32rpx 32rpx 0 0;
  bottom: 0;
  box-shadow: 0 -18rpx 56rpx rgba(56, 99, 138, 0.24);
  left: 0;
  max-height: 70vh;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  position: absolute;
  right: 0;
}

.chat-history-layer__head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.chat-history-layer__eyebrow {
  color: #6b98b3;
  font-size: 21rpx;
  letter-spacing: 3rpx;
}

.chat-history-layer__title {
  color: #213e52;
  font-size: 32rpx;
  font-weight: 700;
  margin-top: 4rpx;
}

.chat-history-layer__actions {
  display: flex;
  gap: 12rpx;
}

.chat-history-layer__ghost {
  background: rgba(255, 255, 255, 0.78);
  border: none;
  border-radius: 999rpx;
  color: #4b7591;
  font-size: 24rpx;
  padding: 14rpx 22rpx;
}

.chat-history-layer__body {
  max-height: 52vh;
}

.chat-history-layer__bubble {
  border-radius: 26rpx;
  margin-bottom: 16rpx;
  padding: 18rpx 20rpx;
}

.chat-history-layer__bubble--assistant {
  background: rgba(255, 255, 255, 0.9);
}

.chat-history-layer__bubble--user {
  background: rgba(110, 205, 255, 0.14);
}

.chat-history-layer__role {
  color: #64849b;
  font-size: 21rpx;
}

.chat-history-layer__content {
  color: #26485b;
  font-size: 25rpx;
  line-height: 1.6;
  margin-top: 8rpx;
}

@keyframes pet-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10rpx);
  }
}

@keyframes pet-tail {
  0%,
  100% {
    transform: rotate(24deg);
  }
  50% {
    transform: rotate(40deg);
  }
}

@keyframes pet-nuzzle {
  from {
    transform: translateX(-6rpx);
  }
  to {
    transform: translateX(6rpx);
  }
}

@keyframes pet-bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-20rpx);
  }
}

@keyframes pet-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pet-stretch {
  from {
    transform: scaleY(1);
  }
  to {
    transform: scaleY(1.04);
  }
}

@keyframes pet-mouth {
  0%,
  100% {
    transform: translateX(-50%) scaleX(1);
  }
  50% {
    transform: translateX(-50%) scaleX(0.7);
  }
}

@keyframes pet-sip {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(8rpx);
  }
}
</style>
