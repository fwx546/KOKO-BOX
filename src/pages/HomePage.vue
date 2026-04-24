<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import FloatingPetChatCard from '../components/FloatingPetChatCard.vue'
import PetMiniGameDrawer from '../components/PetMiniGameDrawer.vue'
import PetModelStage from '../components/PetModelStage.vue'
import { useKokoState } from '../composables/useKokoState'
import type { MiniGameResult, PetActionType } from '../types/koko'

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
const sending = ref(false)
const gameDrawerOpen = ref(false)
const historyOpen = ref(false)
const activeGame = ref<'catch' | 'bubble'>('catch')
const nowMs = ref(Date.now())
const rotationFrame = ref(pet.value.rotationFrame ?? 0)

let tapTimer: ReturnType<typeof setTimeout> | undefined
let bubbleTimer: ReturnType<typeof setTimeout> | undefined
let actionTimer: ReturnType<typeof setTimeout> | undefined
let digestTimer: ReturnType<typeof setInterval> | undefined

const moodLabel = computed(() => {
  if (pet.value.mood >= 85) return '元气满满'
  if (pet.value.mood >= 65) return '轻松开心'
  if (pet.value.mood >= 45) return '想要陪伴'
  return '需要关注'
})

const sceneStatusLabel = computed(() => {
  if (pet.value.state === 'hungry') return '可可有点想吃东西'
  if (pet.value.state === 'tired') return '可可想趴下来休息一下'
  if (pet.value.state === 'low') return '今天需要多一点温柔陪伴'
  if (pet.value.state === 'sick') return '今天要细心照顾它'
  if (pet.value.state === 'resting') return '正在安心休息中'
  return '今天状态很稳定'
})

const digestStatus = computed(() => getDigestStatus(pet.value, nowMs.value))
const feedStatusLabel = computed(() =>
  digestStatus.value.isDigesting ? `消化中 ${digestStatus.value.digestCountdownLabel}` : '可以喂食',
)

const compactStats = computed(() => [
  { label: '心情', value: pet.value.mood, tint: 'sun' },
  { label: '体力', value: pet.value.energy, tint: 'leaf' },
  { label: '亲密', value: pet.value.intimacy, tint: 'sky' },
])

const stageFacts = computed(() => [
  `${pet.value.stage}阶段`,
  `${pet.value.facingDirection ?? 'front'}视角`,
  `互动${metrics.value.interactions}次`,
])

const recentMessages = computed(() =>
  messages.value.slice(-18).map((item) => ({
    ...item,
    displayContent: settings.value.hideChats && item.role === 'user' ? '当前用户消息已隐藏' : item.content,
  })),
)

const lastAssistantMessage = computed(() => {
  const assistant = [...messages.value].reverse().find((item) => item.role === 'assistant')
  return assistant?.content ?? '今天先从一件小事开始吧。'
})

const overlayChatCollapsed = computed(() => historyOpen.value || gameDrawerOpen.value)

const careActions: Array<{
  key: 'feedMeal' | 'feedWater' | 'play' | 'clean'
  label: string
  hint: string
  action: PetActionType
}> = [
  { key: 'feedMeal', label: '喂食', hint: '半小时消化', action: 'munch' },
  { key: 'feedWater', label: '喂水', hint: '补水舒缓', action: 'sip' },
  { key: 'play', label: '玩耍', hint: '打开小游戏', action: 'sparkle' },
  { key: 'clean', label: '清洁', hint: '整理状态', action: 'stretch' },
]

const interactiveActions: Array<{ action: PetActionType; bubble: string }> = [
  { action: 'pounce', bubble: '看我扑一下，今天状态不错。' },
  { action: 'spin', bubble: '转个圈给你看，尾巴都开心起来了。' },
  { action: 'nuzzle', bubble: '让我蹭蹭你，今天想要更多陪伴。' },
  { action: 'chase', bubble: '刚刚追了一下尾巴，应该很帅吧。' },
  { action: 'stretch', bubble: '先伸个懒腰，再继续和你一起玩。' },
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

const performCare = (action: (typeof careActions)[number]) => {
  if (action.key === 'play') {
    activeGame.value = 'catch'
    gameDrawerOpen.value = true
    triggerPetAction(action.action, '一起玩吧，我已经准备好了。', 2200)
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

const handleGameComplete = (result: MiniGameResult) => {
  const message =
    result.gameType === 'catch'
      ? `接球得了${result.score}分，今天配合真默契。`
      : `泡泡戳了${result.score}分，可可开心得直摇尾巴。`
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
  <page-meta page-style="overflow:hidden;" />

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
          <view class="home-topbar__eyebrow">宠物庄园</view>
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
          <view>今日状态</view>
          <view>{{ stageFacts.join(' · ') }}</view>
        </view>
        <view class="home-status-panel__bar">
          <view
            class="home-status-panel__fill"
            :style="{ width: `${Math.max(18, Math.round((pet.hunger + pet.mood + pet.energy) / 3))}%` }"
          />
        </view>
        <view class="home-status-panel__meta">
          <view>{{ digestStatus.isDigesting ? '正在消化中' : '状态稳定，适合继续互动' }}</view>
          <view>{{ digestStatus.isDigesting ? digestStatus.digestCountdownLabel : '已准备好' }}</view>
        </view>
      </view>

      <view class="home-stage">
        <view v-if="showBubble" class="pet-bubble">{{ petBubble }}</view>

        <view class="home-stage__digest" :class="{ 'home-stage__digest--active': digestStatus.isDigesting }">
          {{ digestStatus.isDigesting ? `消化中 ${digestStatus.digestCountdownLabel}` : '小肚子空出来了，可以继续喂食' }}
        </view>

        <view class="home-stage__stats">
          <view v-for="item in compactStats" :key="item.label" class="home-stage__stat" :class="`home-stage__stat--${item.tint}`">
            <view class="home-stage__stat-label">{{ item.label }}</view>
            <view class="home-stage__stat-value">{{ item.value }}</view>
          </view>
        </view>

        <view class="home-stage__model">
          <PetModelStage
            class="home-stage__pet-view"
            :initial-frame="rotationFrame"
            :action="petAction"
            :pet-name="pet.name"
            @rotate="handleRotate"
            @pettap="handlePetTap"
            @dragend="handleRotateEnd"
          />
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
            <view class="home-action-pill__hint">
              {{ action.key === 'feedMeal' && !digestStatus.canFeedMeal ? digestStatus.digestCountdownLabel : action.hint }}
            </view>
          </button>
        </view>

        <view class="home-stage__chat">
          <FloatingPetChatCard
            class="home-stage__chat-card"
            :collapsed="overlayChatCollapsed"
            :latest-message="lastAssistantMessage"
            :sending="sending"
            @send="submitChat"
            @open-history="historyOpen = true"
          />
        </view>
      </view>
    </view>

    <view v-if="historyOpen" class="chat-history-layer">
      <view class="chat-history-layer__mask" @click="historyOpen = false" />
      <view class="chat-history-layer__panel">
        <view class="chat-history-layer__head">
          <view>
            <view class="chat-history-layer__eyebrow">聊天记录</view>
            <view class="chat-history-layer__title">和 {{ pet.name }} 的对话</view>
          </view>
          <view class="chat-history-layer__actions">
            <button class="chat-history-layer__ghost" @click="clearMessages">清空</button>
            <button class="chat-history-layer__ghost" @click="historyOpen = false">关闭</button>
          </view>
        </view>

        <scroll-view scroll-y class="chat-history-layer__body">
          <view
            v-for="message in recentMessages"
            :key="message.id"
            class="chat-history-layer__bubble"
            :class="message.role === 'assistant' ? 'chat-history-layer__bubble--assistant' : 'chat-history-layer__bubble--user'"
          >
            <view class="chat-history-layer__role">{{ message.role === 'assistant' ? pet.name : '你' }}</view>
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
  background: rgba(255, 255, 255, 0.64);
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 26rpx;
  box-shadow: 0 16rpx 34rpx rgba(98, 150, 126, 0.12);
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
}

.home-status-panel__head,
.home-status-panel__meta {
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
  margin: 12rpx 0 10rpx;
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
  z-index: 5;
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
  background: rgba(255, 255, 255, 0.72);
  border-radius: 999rpx;
  color: #4c6f5c;
  font-size: 21rpx;
  left: 12rpx;
  padding: 12rpx 20rpx;
  position: absolute;
  top: 96rpx;
  z-index: 4;
}

.home-stage__digest--active {
  background: rgba(255, 255, 255, 0.9);
  color: #cc7b3e;
}

.home-stage__stats {
  display: grid;
  gap: 12rpx;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  left: 0;
  position: absolute;
  right: 160rpx;
  top: 140rpx;
  z-index: 4;
}

.home-stage__stat {
  backdrop-filter: blur(10rpx);
  background: rgba(255, 255, 255, 0.72);
  border-radius: 22rpx;
  padding: 14rpx 16rpx;
}

.home-stage__stat--sun {
  box-shadow: inset 0 0 0 2rpx rgba(250, 207, 99, 0.22);
}

.home-stage__stat--leaf {
  box-shadow: inset 0 0 0 2rpx rgba(126, 208, 128, 0.22);
}

.home-stage__stat--sky {
  box-shadow: inset 0 0 0 2rpx rgba(102, 199, 225, 0.22);
}

.home-stage__stat-label {
  color: #54707a;
  font-size: 20rpx;
}

.home-stage__stat-value {
  color: #264851;
  font-size: 30rpx;
  font-weight: 700;
  margin-top: 6rpx;
}

.home-stage__model {
  bottom: 166rpx;
  left: 0;
  min-height: 420rpx;
  position: absolute;
  right: 144rpx;
  top: 188rpx;
}

.home-stage__pet-view {
  display: block;
  height: 100%;
  min-height: 420rpx;
  width: 100%;
}

.home-stage__rail {
  display: grid;
  gap: 14rpx;
  position: absolute;
  right: 0;
  top: 116rpx;
  width: 132rpx;
  z-index: 4;
}

.home-action-pill {
  align-items: center;
  background: rgba(255, 255, 255, 0.84);
  border: none;
  border-radius: 999rpx;
  box-shadow: 0 16rpx 30rpx rgba(84, 143, 110, 0.12);
  color: #31586b;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  justify-content: center;
  min-height: 114rpx;
  padding: 0 10rpx;
}

.home-action-pill::after,
.chat-history-layer__ghost::after {
  border: none;
}

.home-action-pill--disabled {
  opacity: 0.82;
}

.home-action-pill__title {
  font-size: 27rpx;
  font-weight: 700;
}

.home-action-pill__hint {
  color: rgba(49, 88, 107, 0.76);
  font-size: 19rpx;
  text-align: center;
}

.home-stage__chat {
  bottom: calc(6rpx + env(safe-area-inset-bottom));
  left: 0;
  position: absolute;
  right: 146rpx;
  z-index: 4;
}

.home-stage__chat-card {
  display: block;
  width: 100%;
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
</style>
