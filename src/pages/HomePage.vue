<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PetLottieAvatar from '../components/PetLottieAvatar.vue'
import PetMiniGameDrawer from '../components/PetMiniGameDrawer.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import { miniGameDefinitions } from '../config/miniGames'
import type { MiniGameResult, MiniGameType, PetActionType } from '../types/koko'

type HomeStatKey = 'mood' | 'energy' | 'bond'

const FRAME_COUNT = 16
const STEP_PX = 18
const PET_LOTTIE_SIZE_RPX = 300
const TOWN_HOME_ACTION_STORAGE_KEY = 'koko-town-home-action'
const homeBackgroundCandidates = [
  '/static/home/room-fallback.jpg',
  'static/home/room-fallback.jpg',
  '/static/home/room.webp',
  'static/home/room.webp',
]
const homeBackgroundSrc = ref(homeBackgroundCandidates[0])
let homeBackgroundIndex = 0
const { t } = useLanguage()
const pickChatPromptHint = () => {
  const hints = t.value.home.chatHints
  return hints[Math.floor(Math.random() * hints.length)]
}

const handleHomeBackgroundError = (event: any) => {
  console.error('[HomePage] background image load failed:', homeBackgroundSrc.value, event?.detail?.errMsg ?? event)
  if (homeBackgroundIndex < homeBackgroundCandidates.length - 1) {
    homeBackgroundIndex += 1
    homeBackgroundSrc.value = homeBackgroundCandidates[homeBackgroundIndex]
    console.warn('[HomePage] switch background candidate to:', homeBackgroundSrc.value)
  }
}

const checkImageSource = (src: string) =>
  new Promise<{ ok: boolean; errMsg?: string }>((resolve) => {
    if (typeof uni === 'undefined' || typeof uni.getImageInfo !== 'function') {
      resolve({ ok: true })
      return
    }

    uni.getImageInfo({
      src,
      success: () => resolve({ ok: true }),
      fail: (err) => {
        const errMsg = (err as { errMsg?: string })?.errMsg ?? String(err)
        console.error('[HomePage] getImageInfo failed:', src, errMsg)
        resolve({ ok: false, errMsg })
      },
    })
  })

const ensureHomeBackground = async () => {
  for (let index = 0; index < homeBackgroundCandidates.length; index += 1) {
    const candidate = homeBackgroundCandidates[index]
    const result = await checkImageSource(candidate)
    if (result.ok) {
      homeBackgroundIndex = index
      homeBackgroundSrc.value = candidate
      return
    }
  }
  console.error('[HomePage] all background candidates failed:', homeBackgroundCandidates.join(', '))
}

const {
  pet,
  getCareResource,
  useCareResource,
  canUseCareAction,
  getPetQuickReply,
  getDigestStatus,
  messages,
  economy,
  sendChatMessage,
  settings,
  setPetRotationFrame,
  ensureCoinLogIntegrity,
} = useKokoState()

const petAction = ref<PetActionType>('idle')
const petBubble = ref('')
const showBubble = ref(false)
const chatDraft = ref('')
const chatPromptHint = ref(pickChatPromptHint())
const sending = ref(false)
const petEmotion = ref<'happy' | 'angry'>('happy')
const gameDrawerOpen = ref(false)
const careResourcePanelOpen = ref(false)
const activeCareResourceAction = ref<'feedMeal' | 'feedWater' | 'clean' | null>(null)
const activeGame = ref<MiniGameType>('catch')
const activeStatKey = ref<HomeStatKey | null>(null)
const nowMs = ref(Date.now())
const rotationFrame = ref(pet.value.rotationFrame ?? 0)
const dragging = ref(false)
const TAP_WINDOW_MS = 320

let tapTimer: ReturnType<typeof setTimeout> | undefined
let bubbleTimer: ReturnType<typeof setTimeout> | undefined
let actionTimer: ReturnType<typeof setTimeout> | undefined
let emotionTimer: ReturnType<typeof setTimeout> | undefined
let digestTimer: ReturnType<typeof setInterval> | undefined
let tapCount = 0
let dragStartX = 0
let movedDistance = 0
let carryDistance = 0

const digestStatus = computed(() => getDigestStatus(pet.value, nowMs.value))

const statLevelLabel = (value: number, isZh: boolean) => {
  if (value >= 75) return isZh ? '状态很好' : 'Strong'
  if (value >= 45) return isZh ? '稳定维持' : 'Steady'
  return isZh ? '需要关注' : 'Needs care'
}

const statDetails = computed<Record<HomeStatKey, {
  key: HomeStatKey
  label: string
  value: number
  tint: 'sun' | 'leaf' | 'sky'
  level: string
  message: string
  suggestion: string
}>>(() => {
  const isZh = settings.value.language === 'zh'
  const mood = pet.value.mood
  const energy = pet.value.energy
  const bond = pet.value.intimacy

  return {
    mood: {
      key: 'mood',
      label: t.value.home.stats.mood,
      value: mood,
      tint: 'sun',
      level: statLevelLabel(mood, isZh),
      message: mood >= 75
        ? (isZh ? 'Koko 今天很放松，适合安排一点轻松互动。' : 'Koko feels relaxed today and is ready for gentle play.')
        : mood >= 45
          ? (isZh ? '情绪整体稳定，完成一个小任务会更有成就感。' : 'Mood is steady. A small completed task can lift it further.')
          : (isZh ? 'Koko 有点低落，建议先聊天、喂水或玩一个短游戏。' : 'Koko feels low. Try chatting, water, or a short game first.'),
      suggestion: isZh ? '建议：陪伴 3 分钟，或完成一个今日待办。' : 'Tip: spend 3 minutes together or complete one plan.',
    },
    energy: {
      key: 'energy',
      label: t.value.home.stats.energy,
      value: energy,
      tint: 'leaf',
      level: statLevelLabel(energy, isZh),
      message: energy >= 75
        ? (isZh ? '精力充足，可以进入接球、跳绳这类稍活跃的游戏。' : 'Energy is high. Catch or jump-rope games are a good fit.')
        : energy >= 45
          ? (isZh ? '精力够用，适合轻量互动，不建议连续高强度玩耍。' : 'Energy is usable. Keep interactions light and paced.')
          : (isZh ? 'Koko 有点累，先休息、补水或做安静陪伴更合适。' : 'Koko is tired. Rest, water, or quiet company is better now.'),
      suggestion: isZh ? '建议：玩耍后观察精力变化，低于 40 时减少连续游戏。' : 'Tip: watch energy after play; avoid back-to-back games under 40.',
    },
    bond: {
      key: 'bond',
      label: t.value.home.stats.bond,
      value: bond,
      tint: 'sky',
      level: statLevelLabel(bond, isZh),
      message: bond >= 75
        ? (isZh ? '你们已经很熟悉了，Koko 会更积极回应互动。' : 'Your bond is close, so Koko responds more warmly.')
        : bond >= 45
          ? (isZh ? '亲密度正在升温，稳定完成任务和小游戏会继续提升。' : 'Bond is warming up. Tasks and mini games will keep building it.')
          : (isZh ? '亲密度还在建立中，多点触摸、聊天和游戏会更快靠近。' : 'Bond is still forming. Taps, chats, and games help it grow.'),
      suggestion: isZh ? '建议：每天至少一次聊天或小游戏，让关系曲线持续上升。' : 'Tip: one chat or mini game daily keeps the relationship growing.',
    },
  }
})

const compactStats = computed(() => [statDetails.value.mood, statDetails.value.energy, statDetails.value.bond])
const activeStatDetail = computed(() => (activeStatKey.value ? statDetails.value[activeStatKey.value] : null))

const lastAssistantMessage = computed(() => {
  const assistant = [...messages.value].reverse().find((item) => item.role === 'assistant')
  return assistant?.content ?? t.value.home.assistantFallback
})

const petBubbleSizeClass = computed(() => ({
  'pet-bubble--medium': petBubble.value.length > 28,
  'pet-bubble--long': petBubble.value.length > 54,
}))

const overlayChatCollapsed = computed(() => gameDrawerOpen.value || careResourcePanelOpen.value)
const shouldShowPetLottie = computed(() => !gameDrawerOpen.value && !careResourcePanelOpen.value)
const petFacingMirrored = computed(() => rotationFrame.value > 7)
const selectedCareResource = computed(() =>
  activeCareResourceAction.value ? getCareResource(activeCareResourceAction.value) : null,
)
const careResourcePanelCopy = computed(() => {
  const isZh = settings.value.language === 'zh'
  return {
    title: isZh ? '使用资源' : 'Use resource',
    available: isZh ? '可用数量' : 'Available',
    use: isZh ? '使用' : 'Use',
    cancel: isZh ? '取消' : 'Cancel',
    coinCost: isZh ? '金豆消耗' : 'Coin cost',
    empty: isZh ? '库存不足，请前往小镇商店兑换。' : 'Out of stock. Redeem more in the town shop.',
    digesting: isZh ? 'Koko 还在消化，稍后再喂食。' : 'Koko is still digesting. Feed later.',
  }
})

const careActions: Array<{
  key: 'feedMeal' | 'feedWater' | 'play' | 'clean'
  label: string
  action: PetActionType
}> = [
  { key: 'feedMeal', label: '', action: 'munch' },
  { key: 'feedWater', label: '', action: 'sip' },
  { key: 'play', label: '', action: 'sparkle' },
  { key: 'clean', label: '', action: 'stretch' },
]

const actionDisplayLabel = (action: (typeof careActions)[number]) => t.value.home.care[action.key]

const careActionDisabled = (_action: (typeof careActions)[number]) => false

const clearTimers = () => {
  if (tapTimer) clearTimeout(tapTimer)
  if (bubbleTimer) clearTimeout(bubbleTimer)
  if (actionTimer) clearTimeout(actionTimer)
  if (emotionTimer) clearTimeout(emotionTimer)
  if (digestTimer) clearInterval(digestTimer)
  tapTimer = undefined
  bubbleTimer = undefined
  actionTimer = undefined
  emotionTimer = undefined
  digestTimer = undefined
  tapCount = 0
}

const queueIdleReset = (duration = 1800) => {
  if (actionTimer) clearTimeout(actionTimer)
  actionTimer = setTimeout(() => {
    petAction.value = 'idle'
  }, duration)
}

const showPetBubbleFor = (message: string, duration = 2200) => {
  const normalizedMessage = message.replace(/\s+/g, ' ').trim()
  const readableDuration = Math.min(7000, Math.max(duration, 1800 + normalizedMessage.length * 90))
  petBubble.value = normalizedMessage
  showBubble.value = true
  if (bubbleTimer) clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => {
    showBubble.value = false
  }, readableDuration)
}

const triggerPetAction = (action: PetActionType, message: string, duration = 2200) => {
  petAction.value = action
  showPetBubbleFor(message, duration)
  queueIdleReset(duration)
}

const setPetEmotion = (emotion: 'happy' | 'angry') => {
  petEmotion.value = emotion
  if (emotionTimer) clearTimeout(emotionTimer)
  emotionTimer = undefined
}

const handleSingleTap = async () => {
  const reply = await getPetQuickReply('home-tap')
  triggerPetAction(reply.action === 'idle' ? 'greet' : reply.action, reply.content)
}

const handleDoubleTap = async () => {
  const reply = await getPetQuickReply('home-double-tap-greeting')
  triggerPetAction(reply.action === 'idle' ? 'greet' : reply.action, reply.content, 2400)
}

const handleTripleTap = () => {
  setPetEmotion('angry')
}

const handleAngryComplete = () => {
  setPetEmotion('happy')
}

const finalizeTap = () => {
  const count = tapCount
  tapCount = 0
  tapTimer = undefined
  if (count === 1) {
    void handleSingleTap()
  } else if (count === 2) {
    void handleDoubleTap()
  } else if (count >= 3) {
    handleTripleTap()
  }
}

const handlePetTap = () => {
  tapCount += 1
  if (tapTimer) clearTimeout(tapTimer)
  tapTimer = setTimeout(finalizeTap, TAP_WINDOW_MS)
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
  dragging.value = false
  carryDistance = 0
  const TAP_THRESHOLD_PX = 8
  if (movedDistance < TAP_THRESHOLD_PX) {
    handlePetTap()
  } else {
    handleRotateEnd(rotationFrame.value)
  }
}

const carePreviewMessage = (key: (typeof careActions)[number]['key']) => {
  const isZh = settings.value.language === 'zh'
  const copy: Record<(typeof careActions)[number]['key'], string> = {
    feedMeal: isZh ? 'Koko 闻到饭香，已经凑过来了。' : 'Koko smells the meal and steps closer.',
    feedWater: isZh ? 'Koko 低头等着喝水，耳朵轻轻动了一下。' : 'Koko leans in for water and flicks its ears.',
    play: isZh ? '游戏面板打开啦，Koko 准备进场。' : 'The game panel is open. Koko is ready to join.',
    clean: isZh ? 'Koko 伸了伸爪子，准备清洁。' : 'Koko stretches its paws and gets ready to clean.',
  }
  return copy[key]
}

const performCare = (action: (typeof careActions)[number]) => {
  triggerPetAction(action.action, carePreviewMessage(action.key), 1400)

  if (action.key === 'play') {
    activeGame.value = 'catch'
    gameDrawerOpen.value = true
    return
  }

  activeCareResourceAction.value = action.key
  careResourcePanelOpen.value = true
}

const closeCareResourcePanel = () => {
  careResourcePanelOpen.value = false
}

const confirmUseCareResource = () => {
  const actionKey = activeCareResourceAction.value
  if (!actionKey) return
  const action = careActions.find((item) => item.key === actionKey)
  const result = useCareResource(actionKey)
  triggerPetAction(result.success ? (action?.action ?? 'sparkle') : 'greet', result.message, result.success ? 2200 : 2600)
  if (!result.success) {
    uni.showToast({ title: result.message, icon: 'none' })
    return
  }
  careResourcePanelOpen.value = false
}

const submitChat = async (content: string) => {
  if (!content.trim() || sending.value) return
  sending.value = true
  try {
    const result = await sendChatMessage(content)
    chatPromptHint.value = pickChatPromptHint()
    showPetBubbleFor(lastAssistantMessage.value, 2600)
    if (result?.coinReward.awarded) {
      uni.showToast({
        title: `+${result.coinReward.amount}`,
        icon: 'none',
      })
    }
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

const openVoiceCall = () => {
  uni.navigateTo({ url: '/pages/voice-call/index' })
}

const openChatPage = () => {
  uni.navigateTo({ url: '/pages/chat/index' })
}

const openCoinLog = () => {
  ensureCoinLogIntegrity({ persist: true })
  uni.navigateTo({ url: '/pages/coin-log/index' })
}

const openStatDetail = (key: HomeStatKey) => {
  activeStatKey.value = key
}

const closeStatDetail = () => {
  activeStatKey.value = null
}

const openPlayFromTown = () => {
  activeGame.value = 'catch'
  gameDrawerOpen.value = true
  triggerPetAction('sparkle', t.value.home.gameReady, 2200)
}

const handlePendingTownAction = () => {
  if (typeof uni.getStorageSync !== 'function') return
  const action = uni.getStorageSync(TOWN_HOME_ACTION_STORAGE_KEY)
  if (typeof uni.removeStorageSync === 'function') {
    uni.removeStorageSync(TOWN_HOME_ACTION_STORAGE_KEY)
  }
  if (action === 'play') {
    openPlayFromTown()
  }
}

const handleGameComplete = (result: MiniGameResult) => {
  const definition = miniGameDefinitions[result.gameType] ?? miniGameDefinitions.catch
  const message = settings.value.language === 'zh'
    ? `${definition.title.zh}完成，得分 ${result.score}，Koko 的心情和亲密度都更新了。`
    : `${definition.title.en} complete: ${result.score}. Koko's mood and bond were updated.`
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

onMounted(() => {
  void ensureHomeBackground()
  handlePendingTownAction()
})

onShow(() => {
  handlePendingTownAction()
})
</script>

<template>
  <view class="home-screen">
    <view class="home-screen__background">
      <image class="home-screen__background-image" :src="homeBackgroundSrc" mode="scaleToFill" @error="handleHomeBackgroundError" />
    </view>

    <view class="home-screen__content">
      <view class="home-topbar">
        <view class="home-topbar__title-block">
          <view class="home-topbar__eyebrow">KOKO HOME</view>
          <view class="home-topbar__title">{{ pet.name }}</view>
        </view>
        <view class="home-topbar__actions">
          <button class="home-topbar__coins" hover-class="home-topbar__coins--pressed" @click="openCoinLog">
            <view class="home-coin-icon" />
            <text>{{ economy.coins }}</text>
          </button>
        </view>
      </view>

      <view class="home-stage__progress">
        <button
          v-for="item in compactStats"
          :key="item.key"
          class="home-progress-card"
          hover-class="home-progress-card--pressed"
          @click="openStatDetail(item.key)"
        >
          <view class="home-progress-card__row">
            <view class="home-progress-card__label">{{ item.label }}</view>
            <view class="home-progress-card__value">{{ item.value }}</view>
          </view>
          <view class="home-progress-card__track">
            <view class="home-progress-card__fill" :class="`home-progress-card__fill--${item.tint}`" :style="{ width: `${item.value}%` }" />
          </view>
        </button>
      </view>

      <view class="home-stage">
        <view v-if="showBubble" class="pet-bubble" :class="petBubbleSizeClass">{{ petBubble }}</view>

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
            <view v-if="shouldShowPetLottie" class="pet-lottie-wrap" :class="`pet-lottie-wrap--${petAction}`">
              <PetLottieAvatar
                v-if="petEmotion === 'happy'"
                :size-rpx="PET_LOTTIE_SIZE_RPX"
                :mirror="petFacingMirrored"
                variant="happy"
                :loop="true"
              />
              <PetLottieAvatar
                v-else
                :size-rpx="PET_LOTTIE_SIZE_RPX"
                :mirror="petFacingMirrored"
                variant="angry"
                :loop="false"
                @complete="handleAngryComplete"
              />
            </view>
          </view>
        </view>

        <view class="home-stage__rail">
          <button
            v-for="action in careActions"
            :key="action.key"
            class="home-action-pill"
            :class="{ 'home-action-pill--disabled': careActionDisabled(action) }"
            @click="performCare(action)"
          >
            <view class="home-action-pill__title">{{ actionDisplayLabel(action) }}</view>
          </button>
        </view>

        <view class="home-stage__chat">
          <view class="pet-chat-card" :class="{ 'pet-chat-card--collapsed': overlayChatCollapsed }">
            <view class="pet-chat-card__bar">
              <input
                v-model="chatDraft"
                class="pet-chat-card__field"
                :disabled="overlayChatCollapsed"
                :placeholder="chatPromptHint"
                confirm-type="send"
                @confirm="submitOverlayChat"
              />
              <button class="pet-chat-card__voice" :aria-label="t.home.voiceCall" @click="openVoiceCall">
                <view class="pet-chat-card__mic" />
              </button>
              <button class="pet-chat-card__history" @click="openChatPage">{{ t.home.openChat }}</button>
              <button class="pet-chat-card__send" :disabled="overlayChatCollapsed || sending" @click="submitOverlayChat">
                {{ sending ? t.home.sending : t.home.send }}
              </button>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="activeStatDetail" class="home-stat-layer">
      <view class="home-stat-layer__mask" @click="closeStatDetail" />
      <view class="home-stat-panel">
        <button class="home-stat-panel__close" @click="closeStatDetail">×</button>
        <view class="home-stat-panel__head">
          <view>
            <view class="home-stat-panel__eyebrow">{{ activeStatDetail.level }}</view>
            <view class="home-stat-panel__title">{{ activeStatDetail.label }}</view>
          </view>
          <view class="home-stat-panel__score">{{ activeStatDetail.value }}/100</view>
        </view>
        <view class="home-stat-panel__track">
          <view class="home-stat-panel__fill" :class="`home-progress-card__fill--${activeStatDetail.tint}`" :style="{ width: `${activeStatDetail.value}%` }" />
        </view>
        <view class="home-stat-panel__message">{{ activeStatDetail.message }}</view>
        <view class="home-stat-panel__suggestion">{{ activeStatDetail.suggestion }}</view>
      </view>
    </view>

    <view v-if="careResourcePanelOpen && selectedCareResource" class="care-resource-layer">
      <view class="care-resource-layer__mask" @click="closeCareResourcePanel" />
      <view class="care-resource-panel">
        <view class="care-resource-panel__handle" />
        <view class="care-resource-panel__head">
          <view>
            <view class="care-resource-panel__eyebrow">{{ careResourcePanelCopy.title }}</view>
            <view class="care-resource-panel__title">{{ selectedCareResource.name }}</view>
          </view>
          <view class="care-resource-panel__icon">{{ activeCareResourceAction === 'feedMeal' ? '🍚' : activeCareResourceAction === 'feedWater' ? '💧' : '🧼' }}</view>
        </view>
        <view class="care-resource-panel__meta">
          <view class="care-resource-panel__count">
            <text>{{ careResourcePanelCopy.available }}</text>
            <text>{{ selectedCareResource.count }}</text>
          </view>
          <view class="care-resource-panel__count care-resource-panel__count--cost">
            <text>{{ careResourcePanelCopy.coinCost }}</text>
            <text>-{{ selectedCareResource.coinCost }}</text>
          </view>
          <view class="care-resource-panel__effect">{{ selectedCareResource.effect }}</view>
          <view v-if="activeCareResourceAction === 'feedMeal' && digestStatus.isDigesting" class="care-resource-panel__warning">
            {{ careResourcePanelCopy.digesting }}
          </view>
          <view v-else-if="selectedCareResource.count <= 0" class="care-resource-panel__warning">
            {{ careResourcePanelCopy.empty }}
          </view>
        </view>
        <view class="care-resource-panel__actions">
          <button class="care-resource-panel__ghost" @click="closeCareResourcePanel">{{ careResourcePanelCopy.cancel }}</button>
          <button class="care-resource-panel__primary" :disabled="!canUseCareAction(selectedCareResource.action)" @click="confirmUseCareResource">
            {{ careResourcePanelCopy.use }}
          </button>
        </view>
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
  background: linear-gradient(180deg, #e8f8ff 0%, #fff8ec 52%, #f3f9eb 100%);
  box-sizing: border-box;
  height: 100vh;
  left: 0;
  overflow: hidden;
  position: fixed;
  right: 0;
  top: 0;
}

.home-screen__background {
  bottom: 0;
  left: 0;
  overflow: hidden;
  position: absolute;
  right: 0;
  top: 0;
  z-index: 0;
}

.home-screen__background-image {
  display: block;
  height: 100%;
  width: 100%;
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
  color: #253047;
}

.home-topbar__eyebrow {
  color: #5f8c78;
  font-size: 22rpx;
  letter-spacing: 4rpx;
}

.home-topbar__title {
  font-size: 44rpx;
  font-weight: 700;
  margin-top: 6rpx;
}

.home-topbar__actions {
  align-items: center;
  display: flex;
  gap: 12rpx;
}

.home-topbar__coins {
  align-items: center;
  background: rgba(255, 253, 248, 0.88);
  border: 2rpx solid rgba(240, 185, 74, 0.32);
  border-radius: 999rpx;
  box-shadow: 0 12rpx 24rpx rgba(167, 124, 72, 0.12);
  color: #735420;
  display: inline-flex;
  font-size: 25rpx;
  font-weight: 800;
  gap: 10rpx;
  line-height: 1;
  margin: 0;
  padding: 16rpx 22rpx;
}

.home-topbar__coins::after {
  border: 0;
}

.home-topbar__coins--pressed {
  transform: scale(0.96);
}

.home-coin-icon {
  background:
    radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.82) 0, rgba(255, 255, 255, 0.82) 8rpx, transparent 9rpx),
    linear-gradient(135deg, #ffe08a, #f0b94a 62%, #c98624);
  border: 3rpx solid rgba(139, 93, 22, 0.18);
  border-radius: 50%;
  box-shadow: inset 0 -4rpx 0 rgba(130, 88, 20, 0.14), 0 4rpx 8rpx rgba(167, 124, 72, 0.16);
  box-sizing: border-box;
  height: 34rpx;
  position: relative;
  width: 34rpx;
}

.home-coin-icon::after {
  background: rgba(116, 79, 19, 0.24);
  border-radius: 999rpx;
  content: '';
  height: 16rpx;
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 6rpx;
}

.home-stage {
  flex: 1;
  margin-top: 10rpx;
  min-height: 0;
  position: relative;
}

.pet-bubble {
  align-items: flex-start;
  background: rgba(255, 253, 248, 0.94);
  border: 2rpx solid rgba(176, 143, 102, 0.14);
  border-radius: 30rpx;
  box-shadow: 0 18rpx 42rpx rgba(167, 124, 72, 0.14);
  color: #253047;
  display: inline-flex;
  font-size: 24rpx;
  height: auto;
  left: 18rpx;
  line-height: 1.5;
  max-width: calc(100% - 168rpx);
  min-height: 0;
  min-width: 180rpx;
  overflow: visible;
  padding: 18rpx 22rpx;
  position: absolute;
  text-align: left;
  top: 128rpx;
  white-space: normal;
  word-break: break-word;
  word-wrap: break-word;
  z-index: 6;
}

.pet-bubble--medium {
  max-width: calc(100% - 144rpx);
  min-width: 300rpx;
}

.pet-bubble--long {
  left: 12rpx;
  max-width: calc(100% - 138rpx);
  min-width: 420rpx;
  top: 104rpx;
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

.home-stage__progress {
  display: grid;
  gap: 12rpx;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18rpx;
  position: relative;
  z-index: 4;
}

.home-progress-card {
  backdrop-filter: blur(10rpx);
  background: rgba(255, 253, 248, 0.74);
  border: 2rpx solid rgba(176, 143, 102, 0.12);
  border-radius: 22rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1;
  margin: 0;
  min-height: 124rpx;
  overflow: visible;
  padding: 18rpx 16rpx 18rpx;
  text-align: left;
  width: 100%;
}

.home-progress-card::after,
.home-stat-panel__close::after {
  border: none;
}

.home-progress-card--pressed {
  transform: scale(0.97);
}

.home-progress-card__row {
  align-items: center;
  display: flex;
  gap: 8rpx;
  justify-content: space-between;
  width: 100%;
}

.home-progress-card__label {
  color: #8a7a68;
  font-size: 20rpx;
}

.home-progress-card__value {
  color: #253047;
  font-size: 23rpx;
  font-weight: 900;
}

.home-progress-card__track {
  background: rgba(180, 215, 203, 0.42);
  border: 2rpx solid rgba(255, 255, 255, 0.72);
  border-radius: 999rpx;
  box-sizing: border-box;
  display: block;
  flex: 0 0 auto;
  height: 20rpx;
  margin-top: 16rpx;
  overflow: hidden;
  width: 100%;
}

.home-progress-card__fill {
  display: block;
  border-radius: inherit;
  height: 100%;
  min-width: 10rpx;
  transition: width 0.22s ease;
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

.home-stat-layer {
  bottom: 0;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 48;
}

.home-stat-layer__mask {
  background: rgba(19, 37, 49, 0.24);
  bottom: 0;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.home-stat-panel {
  background: linear-gradient(180deg, #fffdf8 0%, #f5fbf1 100%);
  border-radius: 32rpx 32rpx 0 0;
  bottom: 0;
  box-shadow: 0 -18rpx 56rpx rgba(167, 124, 72, 0.18);
  box-sizing: border-box;
  left: 0;
  padding: 26rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  position: absolute;
  right: 0;
}

.home-stat-panel__close {
  align-items: center;
  background: rgba(255, 248, 236, 0.9);
  border: 2rpx solid rgba(176, 143, 102, 0.14);
  border-radius: 50%;
  color: #365f56;
  display: flex;
  font-size: 28rpx;
  font-weight: 900;
  height: 58rpx;
  justify-content: center;
  line-height: 1;
  margin: 0;
  padding: 0;
  position: absolute;
  right: 24rpx;
  top: 22rpx;
  width: 58rpx;
}

.home-stat-panel__head {
  align-items: flex-start;
  display: flex;
  gap: 22rpx;
  justify-content: space-between;
  padding-right: 72rpx;
}

.home-stat-panel__eyebrow {
  color: #5f8c78;
  font-size: 22rpx;
  font-weight: 900;
}

.home-stat-panel__title {
  color: #253047;
  font-size: 38rpx;
  font-weight: 900;
  margin-top: 6rpx;
}

.home-stat-panel__score {
  color: #253047;
  flex: 0 0 auto;
  font-size: 36rpx;
  font-weight: 900;
}

.home-stat-panel__track {
  background: rgba(180, 215, 203, 0.42);
  border-radius: 999rpx;
  height: 20rpx;
  margin-top: 26rpx;
  overflow: hidden;
}

.home-stat-panel__fill {
  border-radius: inherit;
  height: 100%;
}

.home-stat-panel__message,
.home-stat-panel__suggestion {
  color: #365f56;
  font-size: 27rpx;
  font-weight: 800;
  line-height: 1.55;
  margin-top: 22rpx;
}

.home-stat-panel__suggestion {
  background: rgba(255, 248, 236, 0.74);
  border: 2rpx solid rgba(176, 143, 102, 0.12);
  border-radius: 22rpx;
  color: #7d8a74;
  padding: 18rpx 20rpx;
}

.home-stage__model {
  bottom: 154rpx;
  left: 0;
  min-height: 420rpx;
  overflow: hidden;
  position: absolute;
  right: 144rpx;
  top: 42rpx;
  z-index: 3;
}

.home-stage__rail {
  display: grid;
  gap: 14rpx;
  justify-items: center;
  position: absolute;
  right: 0;
  top: 20rpx;
  width: 120rpx;
  z-index: 8;
}

.home-action-pill {
  align-items: center;
  background: rgba(255, 253, 248, 0.9);
  border: none;
  border-radius: 50%;
  border: 2rpx solid rgba(95, 199, 168, 0.18);
  box-shadow: 0 16rpx 30rpx rgba(95, 199, 168, 0.14);
  color: #365f56;
  display: flex;
  height: 110rpx;
  justify-content: center;
  padding: 0;
  width: 110rpx;
}

.home-action-pill::after,
.pet-chat-card__voice::after,
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
  bottom: calc(42rpx + env(safe-area-inset-bottom));
  left: 10rpx;
  position: absolute;
  right: 10rpx;
  z-index: 9;
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

.pet-lottie-wrap {
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  margin-top: 18rpx;
  overflow: hidden;
  width: 100%;
  z-index: 2;
}

.pet-lottie-wrap--greet,
.pet-lottie-wrap--sparkle,
.pet-lottie-wrap--pounce {
  animation: home-dog-hop 0.68s ease-in-out infinite alternate;
}

.pet-lottie-wrap--munch,
.pet-lottie-wrap--sip {
  animation: home-dog-nod 0.82s ease-in-out infinite;
}

.pet-lottie-wrap--stretch {
  animation: home-dog-stretch 0.9s ease-in-out infinite alternate;
}

.pet-lottie {
  height: 600rpx;
  position: relative;
  width: 600rpx;
}

@keyframes home-dog-hop {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-16rpx);
  }
}

@keyframes home-dog-nod {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(8rpx) scale(0.98);
  }
}

@keyframes home-dog-stretch {
  from {
    transform: scaleY(1);
  }
  to {
    transform: scaleY(1.04);
  }
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
  display: flex;
  justify-content: center;
  position: relative;
}

.pet-chat-card--collapsed {
  opacity: 0.34;
  transform: scale(0.98);
}

.pet-chat-card__bar {
  align-items: center;
  backdrop-filter: blur(24rpx);
  background:
    linear-gradient(180deg, rgba(255, 253, 248, 0.62), rgba(255, 248, 236, 0.4)),
    rgba(255, 253, 248, 0.28);
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 999rpx;
  display: flex;
  gap: 0;
  justify-content: center;
  max-width: 680rpx;
  padding: 8rpx;
  width: 100%;
}

.pet-chat-card__field {
  background: transparent;
  border: none;
  border-radius: 999rpx;
  color: #253047;
  flex: 1;
  font-size: 27rpx;
  height: 94rpx;
  min-width: 0;
  padding: 0 28rpx;
}

.pet-chat-card__voice,
.pet-chat-card__history,
.pet-chat-card__send {
  align-items: center;
  backdrop-filter: blur(12rpx);
  background: rgba(255, 255, 255, 0.68);
  border: none;
  border-left: 2rpx solid rgba(176, 143, 102, 0.14);
  border-radius: 0;
  color: #365f56;
  display: flex;
  font-size: 24rpx;
  font-weight: 700;
  height: 94rpx;
  justify-content: center;
  min-width: 94rpx;
  padding: 0 12rpx;
}

.pet-chat-card__voice {
  min-width: 86rpx;
  padding: 0;
}

.pet-chat-card__mic {
  border: 5rpx solid #365f56;
  border-radius: 18rpx;
  border-top-width: 7rpx;
  box-sizing: border-box;
  height: 34rpx;
  position: relative;
  width: 22rpx;
}

.pet-chat-card__mic::before {
  border: 4rpx solid #365f56;
  border-left: 0;
  border-radius: 0 0 18rpx 18rpx;
  border-right: 0;
  border-top: 0;
  bottom: -12rpx;
  content: '';
  height: 13rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 34rpx;
}

.pet-chat-card__mic::after {
  background: #365f56;
  border-radius: 999rpx;
  bottom: -18rpx;
  content: '';
  height: 10rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 5rpx;
}

.pet-chat-card__history,
.pet-chat-card__send {
  min-width: 88rpx;
}

.pet-chat-card__send {
  border-radius: 0 999rpx 999rpx 0;
}

.care-resource-layer {
  bottom: 0;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 42;
}

.care-resource-layer__mask {
  background: rgba(19, 37, 49, 0.24);
  bottom: 0;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.care-resource-panel {
  background: linear-gradient(180deg, #fffdf8 0%, #fff8ec 100%);
  border-radius: 32rpx 32rpx 0 0;
  bottom: 0;
  box-shadow: 0 -18rpx 56rpx rgba(167, 124, 72, 0.18);
  box-sizing: border-box;
  left: 0;
  padding: 18rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  position: absolute;
  right: 0;
}

.care-resource-panel__handle {
  background: rgba(138, 122, 104, 0.22);
  border-radius: 999rpx;
  height: 8rpx;
  margin: 0 auto 22rpx;
  width: 82rpx;
}

.care-resource-panel__head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.care-resource-panel__eyebrow {
  color: #5f8c78;
  font-size: 21rpx;
  letter-spacing: 3rpx;
}

.care-resource-panel__title {
  color: #253047;
  font-size: 34rpx;
  font-weight: 800;
  margin-top: 6rpx;
}

.care-resource-panel__icon {
  align-items: center;
  background: rgba(255, 232, 173, 0.66);
  border-radius: 50%;
  display: flex;
  font-size: 42rpx;
  height: 88rpx;
  justify-content: center;
  width: 88rpx;
}

.care-resource-panel__meta {
  margin-top: 22rpx;
}

.care-resource-panel__count {
  align-items: center;
  background: rgba(245, 250, 238, 0.82);
  border: 2rpx solid rgba(95, 199, 168, 0.16);
  border-radius: 22rpx;
  color: #365f56;
  display: flex;
  font-size: 27rpx;
  font-weight: 800;
  justify-content: space-between;
  padding: 20rpx 22rpx;
}

.care-resource-panel__count + .care-resource-panel__count {
  margin-top: 12rpx;
}

.care-resource-panel__count--cost {
  background: rgba(255, 248, 223, 0.82);
  border-color: rgba(217, 137, 74, 0.2);
  color: #9a6633;
}

.care-resource-panel__effect,
.care-resource-panel__warning {
  color: #7d8a74;
  font-size: 25rpx;
  line-height: 1.5;
  margin-top: 16rpx;
}

.care-resource-panel__warning {
  color: #b86b3d;
  font-weight: 700;
}

.care-resource-panel__actions {
  display: grid;
  gap: 16rpx;
  grid-template-columns: 1fr 1fr;
  margin-top: 24rpx;
}

.care-resource-panel__ghost,
.care-resource-panel__primary {
  border: none;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 800;
  height: 84rpx;
  line-height: 84rpx;
}

.care-resource-panel__ghost {
  background: rgba(255, 255, 255, 0.82);
  color: #365f56;
}

.care-resource-panel__primary {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  color: #173f38;
}

.care-resource-panel__primary[disabled] {
  opacity: 0.48;
}

.care-resource-panel__ghost::after,
.care-resource-panel__primary::after {
  border: none;
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
