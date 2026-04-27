<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

interface BubbleItem {
  id: string
  left: number
  bottom: number
  speed: number
  size: number
}

const { applyMiniGameReward } = useKokoState()
const { t } = useLanguage()

const isRunning = ref(false)
const score = ref(0)
const timeLeft = ref(20)
const bubbles = ref<BubbleItem[]>([])
const summary = ref(t.value.game.bubbleStart)

let spawnTimer: ReturnType<typeof setInterval> | undefined
let moveTimer: ReturnType<typeof setInterval> | undefined
let countdownTimer: ReturnType<typeof setInterval> | undefined

const clearTimers = () => {
  if (spawnTimer) clearInterval(spawnTimer)
  if (moveTimer) clearInterval(moveTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  spawnTimer = undefined
  moveTimer = undefined
  countdownTimer = undefined
}

const finishGame = () => {
  clearTimers()
  isRunning.value = false
  applyMiniGameReward({
    gameType: 'bubble',
    score: score.value,
    bonusMood: score.value >= 18 ? 5 : 0,
    bonusClean: score.value >= 12 ? 2 : 0,
  })
  summary.value = score.value >= 18 ? t.value.game.bubbleSuccess : t.value.game.bubbleEnd
}

const startGame = () => {
  clearTimers()
  isRunning.value = true
  score.value = 0
  timeLeft.value = 20
  bubbles.value = []
  summary.value = t.value.game.bubbleRunning

  spawnTimer = setInterval(() => {
    bubbles.value = [
      ...bubbles.value,
      {
        id: `bubble-${Math.random().toString(36).slice(2, 8)}`,
        left: Math.floor(Math.random() * 72) + 8,
        bottom: 18,
        speed: 4 + Math.random() * 2,
        size: 62 + Math.floor(Math.random() * 18),
      },
    ].slice(-12)
  }, 550)

  moveTimer = setInterval(() => {
    bubbles.value = bubbles.value
      .map((item) => ({ ...item, bottom: item.bottom + item.speed }))
      .filter((item) => item.bottom < 92)
  }, 140)

  countdownTimer = setInterval(() => {
    timeLeft.value -= 1
    if (timeLeft.value <= 0) {
      finishGame()
    }
  }, 1000)
}

const popBubble = (id: string) => {
  if (!isRunning.value) return
  bubbles.value = bubbles.value.filter((item) => item.id !== id)
  score.value += 1
}

const goBack = () => {
  uni.navigateBack()
}

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <view class="pet-game-page">
    <view class="pet-game-page__head">
      <view>
        <view class="pet-game-page__eyebrow">{{ t.game.eyebrow }}</view>
        <view class="pet-game-page__title">{{ t.game.bubbleTitle }}</view>
      </view>
      <view class="pet-game-page__time">{{ timeLeft }}s</view>
    </view>

    <view class="pet-game-page__scorebar">
      <view class="pet-game-page__scorecard">
        <view>{{ t.game.currentScore }}</view>
        <view>{{ score }}</view>
      </view>
      <view class="pet-game-page__scorecard">
        <view>{{ t.game.goal }}</view>
        <view>18+</view>
      </view>
    </view>

    <view class="pet-game-stage pet-game-stage--bubble">
      <button
        v-for="bubble in bubbles"
        :key="bubble.id"
        class="pet-game-bubble"
        :style="{ left: `${bubble.left}%`, bottom: `${bubble.bottom}%`, width: `${bubble.size}rpx`, height: `${bubble.size}rpx` }"
        @click="popBubble(bubble.id)"
      />
      <view class="pet-game-pet" />
    </view>

    <view class="pet-game-summary">{{ summary }}</view>

    <view class="pet-game-page__actions">
      <button class="pet-game-page__primary" @click="startGame">{{ isRunning ? t.game.restart : t.game.start }}</button>
      <button class="pet-game-page__ghost" @click="goBack">{{ t.game.backHome }}</button>
    </view>
  </view>
</template>

<style scoped>
.pet-game-page {
  background: linear-gradient(180deg, #e5f8ff 0%, #eefbe8 100%);
  min-height: 100vh;
  padding: calc(32rpx + env(safe-area-inset-top)) 28rpx 40rpx;
}

.pet-game-page__head,
.pet-game-page__scorebar,
.pet-game-page__actions {
  display: flex;
}

.pet-game-page__head,
.pet-game-page__actions {
  align-items: center;
  justify-content: space-between;
}

.pet-game-page__eyebrow {
  color: #6b99a8;
  font-size: 22rpx;
  letter-spacing: 3rpx;
}

.pet-game-page__title {
  color: #234555;
  font-size: 38rpx;
  font-weight: 700;
  margin-top: 8rpx;
}

.pet-game-page__time {
  color: #30586a;
  font-size: 32rpx;
  font-weight: 700;
}

.pet-game-page__scorebar {
  gap: 18rpx;
  margin: 28rpx 0 22rpx;
}

.pet-game-page__scorecard {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 28rpx;
  color: #31586b;
  flex: 1;
  font-size: 24rpx;
  padding: 22rpx;
}

.pet-game-page__scorecard view:last-child {
  font-size: 36rpx;
  font-weight: 700;
  margin-top: 10rpx;
}

.pet-game-stage {
  background: linear-gradient(180deg, #def4ff 0%, #ddf0ff 44%, #cdeec7 100%);
  border-radius: 32rpx;
  height: 560rpx;
  overflow: hidden;
  position: relative;
}

.pet-game-bubble,
.pet-game-page__primary,
.pet-game-page__ghost {
  border: none;
  margin: 0;
  padding: 0;
}

.pet-game-bubble::after,
.pet-game-page__primary::after,
.pet-game-page__ghost::after {
  border: none;
}

.pet-game-bubble {
  background: radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.98), rgba(177, 241, 255, 0.68) 52%, rgba(89, 195, 228, 0.44) 100%);
  border-radius: 50%;
  box-shadow: inset -6rpx -6rpx 14rpx rgba(72, 166, 196, 0.16), 0 12rpx 22rpx rgba(78, 167, 203, 0.18);
  position: absolute;
}

.pet-game-pet {
  background: linear-gradient(180deg, #fffdf0 0%, #ffe3af 100%);
  border-radius: 46% 46% 42% 42%;
  bottom: 44rpx;
  height: 138rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 126rpx;
}

.pet-game-summary {
  color: #355d71;
  font-size: 26rpx;
  line-height: 1.65;
  margin-top: 22rpx;
  min-height: 84rpx;
}

.pet-game-page__actions {
  gap: 16rpx;
  margin-top: 24rpx;
}

.pet-game-page__primary,
.pet-game-page__ghost {
  border-radius: 999rpx;
  flex: 1;
  font-size: 28rpx;
  padding: 22rpx 0;
}

.pet-game-page__primary {
  background: linear-gradient(135deg, #8adfb0, #66c6de);
  color: #173949;
  font-weight: 700;
}

.pet-game-page__ghost {
  background: rgba(255, 255, 255, 0.78);
  color: #4b6f84;
}
</style>
