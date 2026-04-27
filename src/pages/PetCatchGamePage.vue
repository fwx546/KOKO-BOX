<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

interface FallingBall {
  id: string
  left: number
  top: number
  speed: number
}

const { applyMiniGameReward } = useKokoState()
const { t } = useLanguage()

const isRunning = ref(false)
const score = ref(0)
const timeLeft = ref(25)
const balls = ref<FallingBall[]>([])
const summary = ref(t.value.game.catchStart)

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
    gameType: 'catch',
    score: score.value,
    bonusMood: score.value >= 16 ? 4 : 0,
    bonusIntimacy: score.value >= 12 ? 3 : 0,
  })
  summary.value = score.value >= 14 ? t.value.game.catchSuccess : t.value.game.catchEnd
}

const startGame = () => {
  clearTimers()
  isRunning.value = true
  score.value = 0
  timeLeft.value = 25
  balls.value = []
  summary.value = t.value.game.catchRunning

  spawnTimer = setInterval(() => {
    balls.value = [
      ...balls.value,
      {
        id: `ball-${Math.random().toString(36).slice(2, 8)}`,
        left: Math.floor(Math.random() * 76) + 4,
        top: 0,
        speed: 4 + Math.random() * 3,
      },
    ].slice(-10)
  }, 650)

  moveTimer = setInterval(() => {
    balls.value = balls.value
      .map((ball) => ({ ...ball, top: ball.top + ball.speed }))
      .filter((ball) => ball.top < 88)
  }, 120)

  countdownTimer = setInterval(() => {
    timeLeft.value -= 1
    if (timeLeft.value <= 0) {
      finishGame()
    }
  }, 1000)
}

const catchBall = (id: string) => {
  if (!isRunning.value) return
  balls.value = balls.value.filter((ball) => ball.id !== id)
  score.value += 2
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
        <view class="pet-game-page__title">{{ t.game.catchTitle }}</view>
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
        <view>16+</view>
      </view>
    </view>

    <view class="pet-game-stage">
      <button
        v-for="ball in balls"
        :key="ball.id"
        class="pet-game-ball"
        :style="{ left: `${ball.left}%`, top: `${ball.top}%` }"
        @click="catchBall(ball.id)"
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
  background: linear-gradient(180deg, #e5f7ff 0%, #edfbe6 100%);
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
  background: linear-gradient(180deg, #dff4ff 0%, #dff5da 70%, #bde7ad 100%);
  border-radius: 32rpx;
  height: 560rpx;
  overflow: hidden;
  position: relative;
}

.pet-game-ball,
.pet-game-page__primary,
.pet-game-page__ghost {
  border: none;
  margin: 0;
  padding: 0;
}

.pet-game-ball::after,
.pet-game-page__primary::after,
.pet-game-page__ghost::after {
  border: none;
}

.pet-game-ball {
  background: radial-gradient(circle at 30% 30%, #fff, #fff6e4 22%, #ffbf72 56%, #ff9658 100%);
  border-radius: 50%;
  box-shadow: 0 10rpx 18rpx rgba(236, 132, 69, 0.28);
  height: 46rpx;
  position: absolute;
  width: 46rpx;
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
  background: linear-gradient(135deg, #f8cc67, #ff9d64);
  color: #4d3219;
  font-weight: 700;
}

.pet-game-page__ghost {
  background: rgba(255, 255, 255, 0.78);
  color: #4b6f84;
}
</style>
