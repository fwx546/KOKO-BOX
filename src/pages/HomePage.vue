<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import type { PetActionType } from '../types/koko'

const { pet, carePet, getPetQuickReply, metrics } = useKokoState()

const petAction = ref<PetActionType>('idle')
const petBubble = ref('')
const showBubble = ref(false)

let tapTimer: ReturnType<typeof setTimeout> | undefined
let bubbleTimer: ReturnType<typeof setTimeout> | undefined
let actionTimer: ReturnType<typeof setTimeout> | undefined

const moodLabel = computed(() => {
  if (pet.value.mood >= 80) return '超开心'
  if (pet.value.mood >= 60) return '放松中'
  if (pet.value.mood >= 40) return '想陪你'
  return '需要抱抱'
})

const compactStats = computed(() => [
  { label: '心情', value: pet.value.mood },
  { label: '体力', value: pet.value.energy },
  { label: '亲密', value: pet.value.intimacy },
])

const stageFacts = computed(() => [
  `${pet.value.stage}阶段`,
  `已互动 ${metrics.value.interactions} 次`,
])

const interactiveActions: Array<{ action: PetActionType; bubble: string }> = [
  { action: 'pounce', bubble: '看我扑一下，今天状态不错。' },
  { action: 'spin', bubble: '转个圈给你看，尾巴都晃起来了。' },
  { action: 'nuzzle', bubble: '让我蹭蹭你，今天想要更多陪伴。' },
  { action: 'chase', bubble: '我刚刚追了一下尾巴，厉害吧。' },
  { action: 'stretch', bubble: '先伸个懒腰，再继续和你玩。' },
]

const careActions: Array<{
  key: 'feedMeal' | 'feedWater' | 'play' | 'clean'
  label: string
  hint: string
  action: PetActionType
  bubble: string
}> = [
  { key: 'feedMeal', label: '喂食', hint: '补充饱腹', action: 'munch', bubble: '啊呜啊呜，今天的这份刚刚好。' },
  { key: 'feedWater', label: '喂水', hint: '补水舒缓', action: 'sip', bubble: '咕噜咕噜，喝完就精神一点了。' },
  { key: 'play', label: '玩耍', hint: '提升亲密', action: 'sparkle', bubble: '陪我玩一会儿，我会记很久。' },
  { key: 'clean', label: '清洁', hint: '整理状态', action: 'stretch', bubble: '清清爽爽，毛毛也更蓬了。' },
]

const openPage = (url: string) => {
  uni.navigateTo({ url })
}

const clearTimers = () => {
  if (tapTimer) clearTimeout(tapTimer)
  if (bubbleTimer) clearTimeout(bubbleTimer)
  if (actionTimer) clearTimeout(actionTimer)
  tapTimer = undefined
  bubbleTimer = undefined
  actionTimer = undefined
}

const queueIdleReset = (duration = 1800) => {
  if (actionTimer) {
    clearTimeout(actionTimer)
  }

  actionTimer = setTimeout(() => {
    petAction.value = 'idle'
  }, duration)
}

const showPetBubble = (message: string, duration = 2200) => {
  petBubble.value = message
  showBubble.value = true

  if (bubbleTimer) {
    clearTimeout(bubbleTimer)
  }

  bubbleTimer = setTimeout(() => {
    showBubble.value = false
  }, duration)
}

const triggerPetAction = (action: PetActionType, message: string, duration = 2000) => {
  petAction.value = action
  showPetBubble(message, duration)
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

const performCare = (action: (typeof careActions)[number]) => {
  carePet(action.key)
  triggerPetAction(action.action, action.bubble)
}

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <view class="page-view home-stage-page">
    <view class="home-stage-topbar">
      <view>
        <view class="eyebrow">宠物首页</view>
        <view class="home-stage-title">{{ pet.name }}</view>
      </view>
      <view class="home-stage-tools">
        <view class="home-stage-chip">{{ moodLabel }}</view>
        <button class="home-stage-link" @click="openPage('/pages/chat/index')">聊天</button>
      </view>
    </view>

    <view class="home-stage-layout">
      <view class="home-side-rail home-side-rail--left">
        <button class="home-rail-bubble" @click="openPage('/pages/pet-game-catch/index')">
          <view>接球</view>
          <view>小游戏</view>
        </button>
        <button class="home-rail-bubble" @click="openPage('/pages/pet-game-bubble/index')">
          <view>泡泡</view>
          <view>小游戏</view>
        </button>
      </view>

      <view class="pet-stage-shell">
        <view v-if="showBubble" class="pet-speech-pop">
          {{ petBubble }}
        </view>

        <view class="pet-stage-copy">
          <view>{{ pet.state }}</view>
          <view>{{ stageFacts.join(' · ') }}</view>
        </view>

        <view class="pet-stage-center" @click="handlePetTap">
          <view class="pet-model" :class="`pet-model--${petAction}`">
            <view class="pet-model__shadow" />
            <view class="pet-model__tail" />
            <view class="pet-model__body">
              <view class="pet-model__back-paw pet-model__back-paw--left" />
              <view class="pet-model__back-paw pet-model__back-paw--right" />
              <view class="pet-model__belly" />
              <view class="pet-model__front-paw pet-model__front-paw--left" />
              <view class="pet-model__front-paw pet-model__front-paw--right" />
              <view class="pet-model__head">
                <view class="pet-model__ear pet-model__ear--left">
                  <view class="pet-model__ear-inner" />
                </view>
                <view class="pet-model__ear pet-model__ear--right">
                  <view class="pet-model__ear-inner" />
                </view>
                <view class="pet-model__tuft" />
                <view class="pet-model__face">
                  <view class="pet-model__eye pet-model__eye--left" />
                  <view class="pet-model__eye pet-model__eye--right" />
                  <view class="pet-model__blush pet-model__blush--left" />
                  <view class="pet-model__blush pet-model__blush--right" />
                  <view class="pet-model__nose" />
                  <view class="pet-model__mouth" />
                  <view class="pet-model__whiskers pet-model__whiskers--left" />
                  <view class="pet-model__whiskers pet-model__whiskers--right" />
                </view>
                <view class="pet-model__collar">
                  <view class="pet-model__bell" />
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="home-stage-hint">
          单击宠物弹出对话，双击会随机展示互动动作。
        </view>

        <view class="home-stage-stats">
          <view v-for="item in compactStats" :key="item.label" class="home-stage-stat">
            <view>{{ item.label }}</view>
            <view>{{ item.value }}</view>
          </view>
        </view>
      </view>

      <view class="home-side-rail home-side-rail--right">
        <button v-for="action in careActions" :key="action.key" class="home-grow-bubble" @click="performCare(action)">
          <view>{{ action.label }}</view>
          <view>{{ action.hint }}</view>
        </button>
      </view>
    </view>
  </view>
</template>
