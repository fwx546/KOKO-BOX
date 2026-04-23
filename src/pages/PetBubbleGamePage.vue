<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'

interface BubbleItem {
  id: string
  left: number
  bottom: number
  speed: number
  size: number
}

const { applyMiniGameReward } = useKokoState()

const isRunning = ref(false)
const score = ref(0)
const timeLeft = ref(20)
const bubbles = ref<BubbleItem[]>([])
const summary = ref('点开始后，戳破 Koko 吐出来的泡泡。')

let spawnTimer: ReturnType<typeof setInterval> | undefined
let moveTimer: ReturnType<typeof setInterval> | undefined
let countdownTimer: ReturnType<typeof setInterval> | undefined

const createId = () => `bubble-${Math.random().toString(36).slice(2, 8)}`

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
  summary.value = score.value >= 18 ? '泡泡全都被你戳破了，Koko 兴奋得直摇尾巴。' : '这一轮已经结束，下一局可以再快一点。'
}

const goBack = () => {
  uni.navigateBack()
}

const startGame = () => {
  clearTimers()
  isRunning.value = true
  score.value = 0
  timeLeft.value = 20
  bubbles.value = []
  summary.value = '快点点泡泡，越靠上消失得越快。'

  spawnTimer = setInterval(() => {
    bubbles.value = [
      ...bubbles.value,
      {
        id: createId(),
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

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <view class="page-view pet-game-page">
    <view class="page-head">
      <view>
        <view class="eyebrow">小游戏</view>
        <view>戳泡泡</view>
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
        <view>18+</view>
      </view>
    </view>

    <view class="pet-game-stage pet-game-stage--bubble">
      <button
        v-for="bubble in bubbles"
        :key="bubble.id"
        class="pet-game-bubble-button"
        :style="{ left: `${bubble.left}%`, bottom: `${bubble.bottom}%`, width: `${bubble.size}rpx`, height: `${bubble.size}rpx` }"
        @click="popBubble(bubble.id)"
      />
      <view class="pet-game-pet pet-game-pet--bubble" />
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
