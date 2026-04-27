<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { MiniGameResult, MiniGameType } from '../types/koko'

interface FallingBall {
  id: string
  left: number
  top: number
  speed: number
}

interface BubbleItem {
  id: string
  left: number
  bottom: number
  speed: number
  size: number
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    defaultGame?: MiniGameType
  }>(),
  {
    defaultGame: 'catch',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  complete: [result: MiniGameResult]
}>()

const { applyMiniGameReward, setActiveMiniGame } = useKokoState()
const { t } = useLanguage()

const activeGame = ref<MiniGameType>(props.defaultGame)
const isRunning = ref(false)
const score = ref(0)
const timeLeft = ref(0)
const summary = ref('')
const balls = ref<FallingBall[]>([])
const bubbles = ref<BubbleItem[]>([])

let spawnTimer: ReturnType<typeof setInterval> | undefined
let moveTimer: ReturnType<typeof setInterval> | undefined
let countdownTimer: ReturnType<typeof setInterval> | undefined

const gameCopy = computed(() =>
  activeGame.value === 'catch'
    ? {
        title: t.value.game.catchTitle,
        target: '16+',
        startHint: t.value.game.catchStart,
        runningHint: t.value.game.catchRunning,
      }
    : {
        title: t.value.game.bubbleTitle,
        target: '18+',
        startHint: t.value.game.bubbleStart,
        runningHint: t.value.game.bubbleRunning,
      },
)

const clearTimers = () => {
  if (spawnTimer) clearInterval(spawnTimer)
  if (moveTimer) clearInterval(moveTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  spawnTimer = undefined
  moveTimer = undefined
  countdownTimer = undefined
}

const resetBoard = () => {
  clearTimers()
  isRunning.value = false
  score.value = 0
  timeLeft.value = activeGame.value === 'catch' ? 25 : 20
  balls.value = []
  bubbles.value = []
  summary.value = gameCopy.value.startHint
}

const close = () => {
  clearTimers()
  setActiveMiniGame(null)
  emit('update:modelValue', false)
}

const finishGame = () => {
  clearTimers()
  isRunning.value = false

  const result: MiniGameResult =
    activeGame.value === 'catch'
      ? {
          gameType: 'catch',
          score: score.value,
          bonusMood: score.value >= 16 ? 4 : 0,
          bonusIntimacy: score.value >= 12 ? 3 : 0,
        }
      : {
          gameType: 'bubble',
          score: score.value,
          bonusMood: score.value >= 18 ? 5 : 0,
          bonusClean: score.value >= 12 ? 2 : 0,
        }

  applyMiniGameReward(result)
  emit('complete', result)
  summary.value =
    activeGame.value === 'catch'
      ? score.value >= 14
        ? t.value.game.catchSuccess
        : t.value.game.catchEnd
      : score.value >= 18
        ? t.value.game.bubbleSuccess
        : t.value.game.bubbleEnd
}

const startGame = () => {
  clearTimers()
  isRunning.value = true
  score.value = 0
  timeLeft.value = activeGame.value === 'catch' ? 25 : 20
  balls.value = []
  bubbles.value = []
  summary.value = gameCopy.value.runningHint
  setActiveMiniGame(activeGame.value)

  if (activeGame.value === 'catch') {
    spawnTimer = setInterval(() => {
      balls.value = [
        ...balls.value,
        {
          id: `ball-${Date.now()}-${Math.random()}`,
          left: 8 + Math.random() * 78,
          top: -8,
          speed: 1.8 + Math.random() * 2.1,
        },
      ].slice(-10)
    }, 620)

    moveTimer = setInterval(() => {
      balls.value = balls.value
        .map((ball) => ({ ...ball, top: ball.top + ball.speed }))
        .filter((ball) => ball.top < 96)
    }, 80)
  } else {
    spawnTimer = setInterval(() => {
      bubbles.value = [
        ...bubbles.value,
        {
          id: `bubble-${Date.now()}-${Math.random()}`,
          left: 8 + Math.random() * 78,
          bottom: -8,
          speed: 1.2 + Math.random() * 1.6,
          size: 46 + Math.round(Math.random() * 34),
        },
      ].slice(-12)
    }, 520)

    moveTimer = setInterval(() => {
      bubbles.value = bubbles.value
        .map((bubble) => ({ ...bubble, bottom: bubble.bottom + bubble.speed }))
        .filter((bubble) => bubble.bottom < 96)
    }, 80)
  }

  countdownTimer = setInterval(() => {
    timeLeft.value -= 1
    if (timeLeft.value <= 0) {
      finishGame()
    }
  }, 1000)
}

const hitCatch = (id: string) => {
  if (!isRunning.value || activeGame.value !== 'catch') return
  balls.value = balls.value.filter((ball) => ball.id !== id)
  score.value += 1
}

const hitBubble = (id: string) => {
  if (!isRunning.value || activeGame.value !== 'bubble') return
  bubbles.value = bubbles.value.filter((bubble) => bubble.id !== id)
  score.value += 1
}

const switchGame = (game: MiniGameType) => {
  if (activeGame.value === game) return
  activeGame.value = game
  resetBoard()
  setActiveMiniGame(game)
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      activeGame.value = props.defaultGame
      resetBoard()
      setActiveMiniGame(props.defaultGame)
    } else {
      clearTimers()
      setActiveMiniGame(null)
    }
  },
)

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <view class="mini-game-drawer" :class="{ 'mini-game-drawer--open': modelValue }">
    <view class="mini-game-drawer__backdrop" @click="close" />
    <view class="mini-game-drawer__panel">
      <view class="mini-game-drawer__handle" />
      <view class="mini-game-drawer__head">
        <view>
          <view class="mini-game-drawer__eyebrow">{{ t.game.playTime }}</view>
          <view class="mini-game-drawer__title">{{ gameCopy.title }}</view>
        </view>
        <button class="mini-game-drawer__close" @click="close">{{ t.game.collapse }}</button>
      </view>

      <view class="mini-game-tabs">
        <button
          class="mini-game-tabs__item"
          :class="{ 'mini-game-tabs__item--active': activeGame === 'catch' }"
          @click="switchGame('catch')"
        >
          {{ t.game.catchTab }}
        </button>
        <button
          class="mini-game-tabs__item"
          :class="{ 'mini-game-tabs__item--active': activeGame === 'bubble' }"
          @click="switchGame('bubble')"
        >
          {{ t.game.bubbleTab }}
        </button>
      </view>

      <view class="mini-game-scorebar">
        <view class="mini-game-scorecard">
          <view class="mini-game-scorecard__label">{{ t.game.currentScore }}</view>
          <view class="mini-game-scorecard__value">{{ score }}</view>
        </view>
        <view class="mini-game-scorecard">
          <view class="mini-game-scorecard__label">{{ t.game.countdown }}</view>
          <view class="mini-game-scorecard__value">{{ timeLeft }}s</view>
        </view>
        <view class="mini-game-scorecard">
          <view class="mini-game-scorecard__label">{{ t.game.goal }}</view>
          <view class="mini-game-scorecard__value">{{ gameCopy.target }}</view>
        </view>
      </view>

      <view v-if="activeGame === 'catch'" class="mini-game-stage mini-game-stage--catch">
        <button
          v-for="ball in balls"
          :key="ball.id"
          class="mini-game-ball"
          :style="{ left: `${ball.left}%`, top: `${ball.top}%` }"
          @click="hitCatch(ball.id)"
        />
        <view class="mini-game-pet mini-game-pet--catch" />
      </view>

      <view v-else class="mini-game-stage mini-game-stage--bubble">
        <button
          v-for="bubble in bubbles"
          :key="bubble.id"
          class="mini-game-bubble"
          :style="{ left: `${bubble.left}%`, bottom: `${bubble.bottom}%`, width: `${bubble.size}rpx`, height: `${bubble.size}rpx` }"
          @click="hitBubble(bubble.id)"
        />
        <view class="mini-game-pet mini-game-pet--bubble" />
      </view>

      <view class="mini-game-summary">{{ summary }}</view>

      <view class="mini-game-actions">
        <button class="mini-game-actions__primary" @click="startGame">
          {{ isRunning ? t.game.restart : t.game.start }}
        </button>
        <button class="mini-game-actions__ghost" @click="close">{{ t.game.backHome }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.mini-game-drawer {
  inset: 0;
  opacity: 0;
  pointer-events: none;
  position: fixed;
  transition: opacity 0.28s ease;
  z-index: 40;
}

.mini-game-drawer--open {
  opacity: 1;
  pointer-events: auto;
}

.mini-game-drawer__backdrop {
  background: rgba(47, 67, 58, 0.22);
  inset: 0;
  position: absolute;
}

.mini-game-drawer__panel {
  background: linear-gradient(180deg, #fffdf8 0%, #fff8ec 100%);
  border: 2rpx solid rgba(176, 143, 102, 0.16);
  border-radius: 32rpx 32rpx 0 0;
  bottom: 0;
  box-shadow: 0 -20rpx 48rpx rgba(167, 124, 72, 0.18);
  box-sizing: border-box;
  left: 0;
  padding: 14rpx 22rpx calc(22rpx + env(safe-area-inset-bottom));
  position: absolute;
  right: 0;
}

.mini-game-drawer__handle {
  background: rgba(176, 143, 102, 0.3);
  border-radius: 999rpx;
  height: 6rpx;
  margin: 0 auto 16rpx;
  width: 56rpx;
}

.mini-game-drawer__head,
.mini-game-tabs,
.mini-game-scorebar,
.mini-game-actions {
  align-items: center;
  display: flex;
}

.mini-game-drawer__head {
  justify-content: space-between;
}

.mini-game-drawer__eyebrow {
  color: #5f8c78;
  font-size: 22rpx;
  font-weight: 800;
}

.mini-game-drawer__title {
  color: #253047;
  font-size: 34rpx;
  font-weight: 900;
  margin-top: 4rpx;
}

.mini-game-drawer__close,
.mini-game-tabs__item,
.mini-game-actions__primary,
.mini-game-actions__ghost {
  border: 0;
  border-radius: 999rpx;
  font-weight: 800;
  margin: 0;
}

.mini-game-drawer__close {
  background: rgba(255, 255, 255, 0.78);
  color: #8a7a68;
  font-size: 24rpx;
  padding: 12rpx 22rpx;
}

.mini-game-tabs {
  background: rgba(255, 255, 255, 0.62);
  border-radius: 999rpx;
  gap: 8rpx;
  margin-top: 18rpx;
  padding: 8rpx;
}

.mini-game-tabs__item {
  background: transparent;
  color: #8a7a68;
  flex: 1;
  font-size: 25rpx;
  padding: 14rpx 0;
}

.mini-game-tabs__item--active {
  background: #e8f7ef;
  color: #365f56;
}

.mini-game-scorebar {
  gap: 12rpx;
  margin-top: 16rpx;
}

.mini-game-scorecard {
  background: rgba(255, 255, 255, 0.8);
  border: 2rpx solid rgba(176, 143, 102, 0.12);
  border-radius: 22rpx;
  flex: 1;
  padding: 16rpx;
}

.mini-game-scorecard__label {
  color: #8a7a68;
  font-size: 21rpx;
}

.mini-game-scorecard__value {
  color: #253047;
  font-size: 34rpx;
  font-weight: 900;
  margin-top: 6rpx;
}

.mini-game-stage {
  border-radius: 30rpx;
  height: 430rpx;
  margin-top: 16rpx;
  overflow: hidden;
  position: relative;
}

.mini-game-stage--catch {
  background: linear-gradient(180deg, #e6f7ff 0%, #edf9de 100%);
}

.mini-game-stage--bubble {
  background: linear-gradient(180deg, #e8f8ff 0%, #fff2cf 100%);
}

.mini-game-ball,
.mini-game-bubble {
  border: 0;
  margin: 0;
  padding: 0;
  position: absolute;
}

.mini-game-ball {
  background: radial-gradient(circle at 30% 30%, #ffffff 0%, #fff5d3 24%, #ffbc68 62%, #ff9163 100%);
  border-radius: 50%;
  box-shadow: 0 10rpx 22rpx rgba(231, 153, 77, 0.22);
  height: 56rpx;
  width: 56rpx;
}

.mini-game-bubble {
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.98), rgba(177, 241, 255, 0.7) 54%, rgba(95, 199, 168, 0.4) 100%);
  border-radius: 50%;
  box-shadow: 0 8rpx 20rpx rgba(95, 199, 168, 0.18);
}

.mini-game-pet {
  background: linear-gradient(180deg, #fffdf0 0%, #ffe3af 100%);
  border-radius: 46% 46% 42% 42%;
  bottom: 26rpx;
  height: 108rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 148rpx;
}

.mini-game-summary {
  color: #6f7c72;
  font-size: 25rpx;
  line-height: 1.55;
  margin-top: 16rpx;
}

.mini-game-actions {
  gap: 14rpx;
  margin-top: 16rpx;
}

.mini-game-actions__primary,
.mini-game-actions__ghost {
  flex: 1;
  font-size: 27rpx;
  padding: 18rpx 0;
}

.mini-game-actions__primary {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  color: #173f38;
}

.mini-game-actions__ghost {
  background: rgba(255, 255, 255, 0.76);
  color: #8a7a68;
}
</style>
