<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'

interface FallingBall {
  id: string
  left: number
  top: number
  speed: number
}

const { applyMiniGameReward } = useKokoState()

const isRunning = ref(false)
const score = ref(0)
const timeLeft = ref(25)
const balls = ref<FallingBall[]>([])
const summary = ref('点击开始，帮宠物把落下来的球接住。')

let spawnTimer: ReturnType<typeof setInterval> | undefined
let moveTimer: ReturnType<typeof setInterval> | undefined
let countdownTimer: ReturnType<typeof setInterval> | undefined

const stageStyle = computed(() => ({ height: '520rpx' }))

const createId = () => `ball-${Math.random().toString(36).slice(2, 8)}`

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
  summary.value = score.value >= 14 ? '接得很稳，Koko 开心得想转圈。' : '这一局结束啦，再来一轮会更熟练。'
}

const goBack = () => {
  uni.navigateBack()
}

const tickBalls = () => {
  balls.value = balls.value
    .map((ball) => ({ ...ball, top: ball.top + ball.speed }))
    .filter((ball) => ball.top < 88)
}

const startGame = () => {
  clearTimers()
  isRunning.value = true
  score.value = 0
  timeLeft.value = 25
  balls.value = []
  summary.value = '快点点住下落的小球，帮 Koko 接住它们。'

  spawnTimer = setInterval(() => {
    balls.value = [
      ...balls.value,
      {
        id: createId(),
        left: Math.floor(Math.random() * 76) + 4,
        top: 0,
        speed: 4 + Math.random() * 3,
      },
    ].slice(-10)
  }, 650)

  moveTimer = setInterval(() => {
    tickBalls()
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

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <view class="page-view pet-game-page">
    <view class="page-head">
      <view>
        <view class="eyebrow">小游戏</view>
        <view>点击接球</view>
      </view>
      <view>{{ timeLeft }}s</view>
    </view>

    <view class="pet-game-scorebar">
      <view class="pet-game-scorecard">
        <view>当前分数</view>
        <view>{{ score }}</view>
      </view>
      <view class="pet-game-scorecard">
        <view>本局目标</view>
        <view>16+</view>
      </view>
    </view>

    <view class="pet-game-stage pet-game-stage--catch" :style="stageStyle">
      <button
        v-for="ball in balls"
        :key="ball.id"
        class="pet-game-ball"
        :style="{ left: `${ball.left}%`, top: `${ball.top}%` }"
        @click="catchBall(ball.id)"
      />
      <view class="pet-game-pet pet-game-pet--catch" />
    </view>

    <view class="pet-game-summary">{{ summary }}</view>

    <view class="pet-game-actions">
      <button class="quick-action-button" @click="startGame">
        {{ isRunning ? '重新开始' : '开始游戏' }}
      </button>
      <button class="quick-action-button quick-action-button--ghost" @click="goBack">返回首页</button>
    </view>
  </view>
</template>
