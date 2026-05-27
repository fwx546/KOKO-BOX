<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PetLottieAvatar from './PetLottieAvatar.vue'
import { miniGameDefinitions, miniGameOrder } from '../config/miniGames'
import { useKokoState } from '../composables/useKokoState'
import type { MiniGameAnimationState, MiniGameResult, MiniGameType, UserSettings } from '../types/koko'

type LocalizedText = Record<UserSettings['language'], string>
type M5Button = 'BtnA' | 'BtnB'
type CatchPetReaction = 'perk' | 'tail' | 'bow'
type BubbleTone = 'soap' | 'star' | 'heart'
type HideSceneId = 'garden' | 'picnic' | 'camp'
type HideSpotTone = 'bench' | 'shrub' | 'box' | 'curtain' | 'mailbox' | 'basket' | 'tent' | 'log' | 'flower'

const GAME_RULE_STORAGE_PREFIX = 'koko-game-rules-seen-v1'

interface BubbleItem {
  id: string
  left: number
  bottom: number
  speed: number
  size: number
  drift: number
  tone: BubbleTone
  value: number
  wobble: number
}

interface BubblePopEffect {
  id: string
  left: number
  bottom: number
  text: string
  tone: BubbleTone
}

interface HideSpot {
  id: string
  label: LocalizedText
  left: number
  top: number
  tone: HideSpotTone
}

interface HideScene {
  id: HideSceneId
  label: LocalizedText
  stageClass: string
  spots: HideSpot[]
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

const {
  applyMiniGameReward,
  setActiveMiniGame,
  triggerHardwareAction,
  receiveHardwareInput,
  settings,
} = useKokoState()

const drawerCopy = {
  en: {
    playTime: 'Play time',
    collapse: 'Close',
    score: 'Score',
    countdown: 'Time',
    combo: 'Combo',
    goal: 'Goal',
    rules: 'Rules',
    start: 'Start game',
    restart: 'Restart',
    pause: 'Pause game',
    resume: 'Resume game',
    paused: 'Game paused. Tap Resume to continue.',
    backHome: 'Back home',
    ready: 'Choose a game and start when Koko is ready.',
    enteringHardware: 'Koko is entering the hardware scene...',
    hardwareReady: 'Hardware link ready. Throw first, then whistle to fetch the ball.',
    throwing: 'Ball thrown. Koko stays in place for the next whistle.',
    fetching: 'Koko is running out to fetch the ball.',
    returning: 'Koko is coming back with the ball.',
    returned: 'Ball returned. Throw again to keep playing.',
    perfectFetch: 'Perfect whistle. Koko made a fast return.',
    steadyFetch: 'Good whistle. Koko brought it back steadily.',
    catchRulesTitle: 'Fetch Ball Rules',
    catchRules: [
      'Tap Start and wait for the M5StickS3 simulation to become ready.',
      'Tap Whistle once. The whistle throws the ball signal and tells Koko to fetch.',
      'Koko runs out, brings the ball back, then waits for your next whistle.',
      'Reach the target before time runs out to gain mood, intimacy, and coins.',
    ],
    hardwareTitle: 'M5StickS3 link',
    hardwareStatus: 'Software simulation',
    hardwareBtnA: 'BtnA Whistle',
    hardwareBtnB: 'BtnB Rules',
    rhythm: 'Whistle timing',
    closeRules: 'Got it',
    bubbleRulesTitle: 'Bubble Pop Rules',
    bubbleRules: [
      'Tap Start to fill the bathroom with floating bubbles.',
      'Tap soap, star, and heart bubbles before they drift away. Special bubbles score more.',
      'Every 5-hit combo gives extra score, pop effects, and improves the final reward.',
      'Pop enough bubbles before time runs out to gain mood, clean, and coins.',
    ],
    jumpRulesTitle: 'Jump Rope Rules',
    jumpRules: [
      'Tap Start to spin the rope outdoors.',
      'Tap Jump when the rhythm needle enters the green zone. The gold center is a perfect jump.',
      'Good timing adds score and combo. Consecutive jumps light up the streak meter.',
      'Three misses end the round early, so keep a calm rhythm.',
    ],
    hideRulesTitle: 'Hide and Seek Rules',
    hideRules: [
      'Pick a scene first, then tap Start and Koko will hide behind one of its props.',
      'Tap a prop to search. Wrong picks now leave clues and mark checked places.',
      'After each find, Koko hides in a new place.',
      'Find Koko 3 times before time runs out to gain intimacy and coins.',
    ],
    bubbleCombo: 'Combo',
    bubbleEscaped: 'A bubble escaped. Combo reset.',
    jumpGood: 'Nice rhythm. Koko cleared the rope.',
    jumpMiss: 'Mistimed jump. Koko tumbled and reset.',
    seekRight: 'Found Koko. It will hide again.',
    seekWrong: 'Nothing there. Keep exploring.',
  },
  zh: {
    playTime: '玩耍时间',
    collapse: '关闭',
    score: '得分',
    countdown: '时间',
    combo: '连击',
    goal: '目标',
    rules: '规则',
    start: '开始游戏',
    restart: '重新开始',
    pause: '暂停游戏',
    resume: '继续游戏',
    paused: '游戏已暂停，点击继续游戏可回到当前进度。',
    backHome: '回首页',
    ready: '选择一个小游戏，等 Koko 准备好就开始。',
    enteringHardware: 'Koko 正在进入硬件场景...',
    hardwareReady: '硬件联动已就绪，先抛球，再吹口哨接球。',
    throwing: '小球抛出去了，Koko 先停在原地等你吹口哨。',
    fetching: 'Koko 跑过去捡球啦。',
    returning: 'Koko 正叼着球返回。',
    returned: '小球成功带回，再抛一次继续。',
    perfectFetch: '完美口哨，Koko 飞快把球带回来了。',
    steadyFetch: '口哨命中，Koko 稳稳把球带回来了。',
    catchRulesTitle: '接球游戏规则',
    catchRules: [
      '点击开始后，等待 M5StickS3 软件模拟准备完成。',
      '点击一次“吹口哨”，口哨会同步发出抛球信号，并告诉 Koko 去捡球。',
      'Koko 会跑出去把球捡回，然后回到草坪中间等待下一次口哨。',
      '倒计时结束前达到目标，可提升心情、亲密度并获得金币。',
    ],
    hardwareTitle: 'M5StickS3 联动',
    hardwareStatus: '软件模拟中',
    hardwareBtnA: 'BtnA 吹口哨',
    hardwareBtnB: 'BtnB 看规则',
    rhythm: '口哨时机',
    closeRules: '知道了',
    bubbleRulesTitle: '戳泡泡游戏规则',
    bubbleRules: [
      '点击开始后，浴室里会不断飘出泡泡。',
      '泡泡飞走前点击戳破；星星泡泡和爱心泡泡分数更高。',
      '每 5 连击会触发额外得分、戳破特效，并提高结算奖励。',
      '倒计时结束前戳破足够泡泡，可提升心情、清洁度并获得金币。',
    ],
    jumpRulesTitle: '跳绳游戏规则',
    jumpRules: [
      '点击开始后，Koko 会在户外开始跳绳。',
      '节奏指针进入绿色区域时点击跳跃；金色中心区是完美起跳。',
      '连续跳跃会点亮连跳灯，完美起跳可获得更高分。',
      '累计 3 次失误会提前结束，所以要保持稳定节奏。',
    ],
    hideRulesTitle: '捉迷藏游戏规则',
    hideRules: [
      '可以先选择花园、野餐或露营场景；点击开始后，Koko 会随机藏在该场景的物体后面。',
      '点击物体进行寻找；找错会留下线索，并标记已检查地点。',
      '每次找到后，Koko 会换一个地方继续藏。',
      '倒计时结束前找到 Koko 3 次，可提升亲密度并获得金币。',
    ],
    bubbleCombo: '连击',
    bubbleEscaped: '有泡泡飞走了，连击已重置。',
    jumpGood: '节奏命中，Koko 顺利跳过绳子。',
    jumpMiss: '节奏没踩准，Koko 摔倒后重新站好。',
    seekRight: '找到 Koko 了，它会换个地方继续藏。',
    seekWrong: '这里没有 Koko，继续探索别的地方。',
  },
} as const

const hideScenes: HideScene[] = [
  {
    id: 'garden',
    label: { en: 'Garden', zh: '花园' },
    stageClass: 'mini-game-stage--hide-garden',
    spots: [
      { id: 'bench', label: { en: 'Bench', zh: '长椅' }, left: 16, top: 68, tone: 'bench' },
      { id: 'shrub', label: { en: 'Shrub', zh: '灌木' }, left: 61, top: 66, tone: 'shrub' },
      { id: 'box', label: { en: 'Box', zh: '木箱' }, left: 24, top: 42, tone: 'box' },
      { id: 'mailbox', label: { en: 'Mailbox', zh: '邮箱' }, left: 78, top: 64, tone: 'mailbox' },
      { id: 'flower', label: { en: 'Flower Bed', zh: '花丛' }, left: 45, top: 50, tone: 'flower' },
    ],
  },
  {
    id: 'picnic',
    label: { en: 'Picnic', zh: '野餐' },
    stageClass: 'mini-game-stage--hide-picnic',
    spots: [
      { id: 'basket', label: { en: 'Basket', zh: '篮子' }, left: 18, top: 63, tone: 'basket' },
      { id: 'curtain', label: { en: 'Awning', zh: '遮阳布' }, left: 75, top: 36, tone: 'curtain' },
      { id: 'box', label: { en: 'Snack Box', zh: '点心箱' }, left: 36, top: 70, tone: 'box' },
      { id: 'shrub', label: { en: 'Berry Bush', zh: '浆果丛' }, left: 64, top: 67, tone: 'shrub' },
      { id: 'flower', label: { en: 'Daisy Patch', zh: '雏菊丛' }, left: 48, top: 47, tone: 'flower' },
    ],
  },
  {
    id: 'camp',
    label: { en: 'Camp', zh: '露营' },
    stageClass: 'mini-game-stage--hide-camp',
    spots: [
      { id: 'tent', label: { en: 'Tent', zh: '帐篷' }, left: 23, top: 58, tone: 'tent' },
      { id: 'log', label: { en: 'Log Pile', zh: '木桩' }, left: 53, top: 70, tone: 'log' },
      { id: 'basket', label: { en: 'Camp Bag', zh: '背包' }, left: 76, top: 66, tone: 'basket' },
      { id: 'shrub', label: { en: 'Night Bush', zh: '夜灌木' }, left: 42, top: 47, tone: 'shrub' },
      { id: 'box', label: { en: 'Supply Box', zh: '补给箱' }, left: 71, top: 41, tone: 'box' },
    ],
  },
]

const activeGame = ref<MiniGameType>(props.defaultGame)
const isRunning = ref(false)
const isPaused = ref(false)
const gameCompleted = ref(false)
const score = ref(0)
const timeLeft = ref(0)
const combo = ref(0)
const maxCombo = ref(0)
const summary = ref('')
const animationState = ref<MiniGameAnimationState>('idle')
const bubbles = ref<BubbleItem[]>([])
const bubblePopEffects = ref<BubblePopEffect[]>([])
const catchRhythm = ref(0)
const catchPerfects = ref(0)
const catchQuality = ref<'ready' | 'perfect' | 'steady'>('ready')
const catchReadyToThrow = ref(false)
const catchPendingPerfect = ref(false)
const catchPetReacting = ref(false)
const catchPetReaction = ref<CatchPetReaction>('perk')
const catchPetTapIndex = ref(-1)
const ropePhase = ref(0)
const jumpPerfects = ref(0)
const missCount = ref(0)
const activeHideScene = ref<HideSceneId>('garden')
const hiddenSpot = ref(hideScenes[0].spots[0].id)
const foundSpot = ref<string | null>(null)
const hideWrongSpots = ref<string[]>([])
const hideClue = ref('')
const hardwareEntering = ref(false)
const showGameRules = ref(false)
const gameRulesSeenInSession = ref<Record<MiniGameType, boolean>>({
  catch: false,
  bubble: false,
  jumpRope: false,
  hideSeek: false,
})

let spawnTimer: ReturnType<typeof setInterval> | undefined
let moveTimer: ReturnType<typeof setInterval> | undefined
let countdownTimer: ReturnType<typeof setInterval> | undefined
let catchPetReactionTimer: ReturnType<typeof setTimeout> | undefined
let sequenceTimers: ReturnType<typeof setTimeout>[] = []

const language = computed(() => settings.value.language)
const ui = computed(() => drawerCopy[language.value])
const catchCopy = computed(() =>
  language.value === 'zh'
    ? {
        hardwareReady: '硬件联动已就绪，吹口哨就会同步抛球并让 Koko 出发。',
        whistleReady: 'Koko 听到口哨，马上去把球捡回来。',
        whistlePerfect: '完美口哨，Koko 已经锁定小球，飞快出发。',
        tapLines: [
          'Koko 在原地摇了摇尾巴，等你吹口哨。',
          'Koko 用爪子轻轻拍草地，眼睛盯着小球。',
          'Koko 歪头看你：吹口哨，我就去把球带回来。',
          'Koko 小跳了一下，像是在热身。',
          'Koko 靠近球看了看，又乖乖回到草坪中间。',
        ],
      }
    : {
        hardwareReady: 'Hardware link ready. Whistle to throw the ball signal and send Koko out.',
        whistleReady: 'Koko heard the whistle and is fetching the ball.',
        whistlePerfect: 'Perfect whistle. Koko locked onto the ball and sprinted out.',
        tapLines: [
          'Koko wiggles in place and waits for the whistle.',
          'Koko taps the grass, eyes fixed on the ball.',
          'Koko tilts its head: whistle and I will bring the ball back.',
          'Koko gives a tiny practice hop.',
          'Koko checks the ball, then returns to the center of the grass.',
        ],
      },
)
const activeDefinition = computed(() => miniGameDefinitions[activeGame.value] ?? miniGameDefinitions.catch)
const selectorGames = computed(() => miniGameOrder.map((gameId) => miniGameDefinitions[gameId]))
const activeHideSceneConfig = computed(() => hideScenes.find((scene) => scene.id === activeHideScene.value) ?? hideScenes[0])
const activeHideSpots = computed(() => activeHideSceneConfig.value.spots)
const foundHideSpot = computed(() => {
  if (!foundSpot.value) return null
  return activeHideSpots.value.find((spot) => spot.id === foundSpot.value) ?? null
})
const foundPeekPetStyle = computed(() => {
  const spot = foundHideSpot.value
  if (!spot) return {}

  return {
    left: `${spot.left}%`,
    top: `${spot.top}%`,
    transform: 'translate(-50%, -108rpx)',
  }
})
const targetLabel = computed(() => `${score.value}/${activeDefinition.value.targetScore}`)
const primaryActionLabel = computed(() => {
  if (gameCompleted.value) return ui.value.restart
  if (isRunning.value) return isPaused.value ? ui.value.resume : ui.value.pause
  return ui.value.start
})
const stageClass = computed(() => {
  const baseClass = activeDefinition.value.scene_config.backgroundClass
  return activeGame.value === 'hideSeek' ? `${baseClass} ${activeHideSceneConfig.value.stageClass}` : baseClass
})
const petStateClass = computed(() => `mini-game-pet--${animationState.value}`)
const catchBallActive = computed(() => activeGame.value === 'catch' && isRunning.value && animationState.value !== 'idle')
const canWhistle = computed(
  () =>
    isRunning.value &&
    !isPaused.value &&
    !gameCompleted.value &&
    activeGame.value === 'catch' &&
    !hardwareEntering.value &&
    animationState.value === 'idle' &&
    catchReadyToThrow.value,
)
const canUseActionButton = computed(() => {
  if (!isRunning.value || isPaused.value || gameCompleted.value) return false
  if (activeGame.value === 'catch') return canWhistle.value
  if (activeGame.value === 'jumpRope') return animationState.value !== 'fallen'
  return false
})
const catchRhythmInZone = computed(() => catchRhythm.value >= 42 && catchRhythm.value <= 66)
const catchRhythmNeedleStyle = computed(() => ({
  left: `${catchRhythm.value}%`,
}))
const dogMirror = computed(() => activeGame.value === 'catch' && animationState.value === 'returning')
const dogStill = computed(() => showGameRules.value || gameCompleted.value)
const catchFetchCount = computed(() => Math.floor(score.value / 4))
const catchRhythmScoreLabel = computed(() => {
  if (catchQuality.value === 'perfect') return '+5'
  if (catchQuality.value === 'steady') return '+4'
  return `${catchFetchCount.value}/4`
})
const jumpWindowActive = computed(() => ropePhase.value >= 42 && ropePhase.value <= 66)
const jumpPerfectActive = computed(() => ropePhase.value >= 49 && ropePhase.value <= 58)
const jumpStreakLights = computed(() => Math.min(5, Math.max(0, combo.value)))
const ropeStyle = computed(() => ({
  transform: `translate(-50%, -50%) rotate(${ropePhase.value * 3.6}deg)`,
}))
const rhythmNeedleStyle = computed(() => ({
  left: `${ropePhase.value}%`,
}))

const localize = (text: LocalizedText) => text[language.value]

const gameRuleStorageKey = (game: MiniGameType) => `${GAME_RULE_STORAGE_PREFIX}-${game}`

const storageFlag = (key: string) => {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return false
  return Boolean(uni.getStorageSync(key))
}

const setStorageFlag = (key: string) => {
  if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') return
  uni.setStorageSync(key, true)
}

const activeRuleTitle = computed(() => {
  if (activeGame.value === 'catch') return ui.value.catchRulesTitle
  if (activeGame.value === 'bubble') return ui.value.bubbleRulesTitle
  if (activeGame.value === 'jumpRope') return ui.value.jumpRulesTitle
  return ui.value.hideRulesTitle
})

const activeRuleList = computed(() => {
  if (activeGame.value === 'catch') return ui.value.catchRules
  if (activeGame.value === 'bubble') return ui.value.bubbleRules
  if (activeGame.value === 'jumpRope') return ui.value.jumpRules
  return ui.value.hideRules
})

const openGameRules = () => {
  showGameRules.value = true
}

const closeGameRules = () => {
  const game = activeGame.value
  showGameRules.value = false
  gameRulesSeenInSession.value = {
    ...gameRulesSeenInSession.value,
    [game]: true,
  }
  setStorageFlag(gameRuleStorageKey(game))
}

const maybeShowGameRules = () => {
  const game = activeGame.value
  if (gameRulesSeenInSession.value[game] || storageFlag(gameRuleStorageKey(game))) return
  showGameRules.value = true
}

const clearSequenceTimers = () => {
  sequenceTimers.forEach((timer) => clearTimeout(timer))
  sequenceTimers = []
}

const clearTimers = () => {
  if (spawnTimer) clearInterval(spawnTimer)
  if (moveTimer) clearInterval(moveTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  if (catchPetReactionTimer) clearTimeout(catchPetReactionTimer)
  spawnTimer = undefined
  moveTimer = undefined
  countdownTimer = undefined
  catchPetReactionTimer = undefined
  catchPetReacting.value = false
  clearSequenceTimers()
}

const queueSequence = (callback: () => void, delay: number) => {
  const timer = setTimeout(() => {
    sequenceTimers = sequenceTimers.filter((item) => item !== timer)
    if (showGameRules.value || isPaused.value) {
      queueSequence(callback, 250)
      return
    }
    callback()
  }, delay)
  sequenceTimers.push(timer)
}

const chooseHiddenSpot = () => {
  const spots = activeHideSpots.value
  const candidates = spots.filter((spot) => spot.id !== hiddenSpot.value)
  const pool = candidates.length ? candidates : spots
  hiddenSpot.value = pool[Math.floor(Math.random() * pool.length)].id
  foundSpot.value = null
  hideWrongSpots.value = []
  hideClue.value = settings.value.language === 'zh'
    ? 'Koko 藏好了，先看哪个道具有点可疑。'
    : 'Koko is hidden. Look for the prop that feels a little suspicious.'
}

const hideClueForMiss = (spotId: string) => {
  const selected = activeHideSpots.value.find((spot) => spot.id === spotId)
  const hidden = activeHideSpots.value.find((spot) => spot.id === hiddenSpot.value)
  if (!selected || !hidden) return settings.value.language === 'zh' ? '换一个地方试试。' : 'Try another place.'

  const horizontal = selected.left < hidden.left
    ? settings.value.language === 'zh' ? '声音好像在右边一点。' : 'The sound feels a little to the right.'
    : selected.left > hidden.left
      ? settings.value.language === 'zh' ? '声音好像在左边一点。' : 'The sound feels a little to the left.'
      : settings.value.language === 'zh' ? '离得很近，再看上下位置。' : 'Very close. Check above or below.'
  const vertical = selected.top < hidden.top
    ? settings.value.language === 'zh' ? 'Koko 可能藏得更低。' : 'Koko may be hiding lower.'
    : selected.top > hidden.top
      ? settings.value.language === 'zh' ? 'Koko 可能藏得更高。' : 'Koko may be hiding higher.'
      : ''

  return vertical ? `${horizontal} ${vertical}` : horizontal
}

const addBubblePopEffect = (bubble: BubbleItem, points: number) => {
  const effect: BubblePopEffect = {
    id: `pop-${bubble.id}`,
    left: bubble.left,
    bottom: Math.min(88, bubble.bottom + 10),
    text: `+${points}`,
    tone: bubble.tone,
  }
  bubblePopEffects.value = [...bubblePopEffects.value, effect].slice(-8)
  queueSequence(() => {
    bubblePopEffects.value = bubblePopEffects.value.filter((item) => item.id !== effect.id)
  }, 620)
}

const resetBoard = () => {
  clearTimers()
  isRunning.value = false
  isPaused.value = false
  gameCompleted.value = false
  score.value = 0
  combo.value = 0
  maxCombo.value = 0
  timeLeft.value = activeDefinition.value.durationSeconds
  bubbles.value = []
  bubblePopEffects.value = []
  catchRhythm.value = 0
  catchPerfects.value = 0
  catchQuality.value = 'ready'
  catchReadyToThrow.value = false
  catchPendingPerfect.value = false
  catchPetReacting.value = false
  ropePhase.value = 0
  jumpPerfects.value = 0
  missCount.value = 0
  hardwareEntering.value = false
  foundSpot.value = null
  hideWrongSpots.value = []
  hideClue.value = ''
  animationState.value = activeDefinition.value.animation_state
  summary.value = localize(activeDefinition.value.startText)
  if (activeGame.value === 'hideSeek') {
    chooseHiddenSpot()
  }
}

const close = () => {
  clearTimers()
  isPaused.value = false
  showGameRules.value = false
  hardwareEntering.value = false
  catchReadyToThrow.value = false
  catchPendingPerfect.value = false
  animationState.value = activeDefinition.value.animation_state
  setActiveMiniGame(null)
  emit('update:modelValue', false)
}

const finishGame = () => {
  if (gameCompleted.value) return
  gameCompleted.value = true
  clearTimers()
  isRunning.value = false
  isPaused.value = false
  hardwareEntering.value = false
  catchReadyToThrow.value = false
  catchPendingPerfect.value = false

  const definition = activeDefinition.value
  const finalScore = score.value
  const success = finalScore >= definition.targetScore
  const result: MiniGameResult = {
    gameType: activeGame.value,
    score: finalScore,
    combo: maxCombo.value,
    success,
    bonusMood: activeGame.value === 'bubble' ? Math.floor(maxCombo.value / 4) : success ? 2 : 0,
    bonusIntimacy: activeGame.value === 'hideSeek' ? Math.floor(maxCombo.value / 2) : success ? 1 : 0,
    bonusClean: activeGame.value === 'bubble' && maxCombo.value >= 8 ? 2 : 0,
    bonusEnergy: activeGame.value === 'jumpRope' && missCount.value >= 3 ? -2 : 0,
    bonusCoins: maxCombo.value >= 6 ? 2 : 0,
  }

  animationState.value =
    activeGame.value === 'hideSeek'
      ? 'found'
      : activeGame.value === 'bubble'
        ? 'watching'
        : activeGame.value === 'jumpRope' && !success
          ? 'fallen'
          : 'returning'

  applyMiniGameReward(result)
  emit('complete', result)
  summary.value = localize(success ? definition.successText : definition.failText)
  triggerHardwareAction('game-finish', {
    game_id: activeGame.value,
    score: finalScore,
    success,
    combo: maxCombo.value,
  })
  receiveHardwareInput({
    type: 'game-result',
    gameType: activeGame.value,
    payload: {
      score: finalScore,
      success,
      combo: maxCombo.value,
    },
  })
}

const startCountdown = () => {
  countdownTimer = setInterval(() => {
    if (showGameRules.value || isPaused.value) return
    timeLeft.value -= 1
    if (timeLeft.value <= 0) {
      finishGame()
    }
  }, 1000)
}

const spawnBubble = () => {
  const roll = Math.random()
  const tone: BubbleTone = roll > 0.92 ? 'heart' : roll > 0.78 ? 'star' : 'soap'
  const value = tone === 'heart' ? 3 : tone === 'star' ? 2 : 1
  bubbles.value = [
    ...bubbles.value,
    {
      id: `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      left: 8 + Math.random() * 78,
      bottom: -8,
      speed: 1.45 + Math.random() * 1.8 + (tone === 'heart' ? 0.36 : 0),
      size: 48 + Math.round(Math.random() * 36) + (tone === 'heart' ? 8 : 0),
      drift: Math.random() > 0.5 ? 0.24 : -0.24,
      tone,
      value,
      wobble: 0.18 + Math.random() * 0.42,
    },
  ].slice(-14)
}

const startCatchGame = () => {
  animationState.value = 'idle'
  hardwareEntering.value = true
  catchRhythm.value = 0
  catchQuality.value = 'ready'
  catchReadyToThrow.value = false
  catchPendingPerfect.value = false
  summary.value = ui.value.enteringHardware
  triggerHardwareAction('enter-hardware', {
    game_id: 'catch',
    state: 'idle',
  })
  moveTimer = setInterval(() => {
    if (showGameRules.value || isPaused.value) return
    catchRhythm.value = (catchRhythm.value + 4) % 100
  }, 90)
  queueSequence(() => {
    if (!isRunning.value || activeGame.value !== 'catch') return
    hardwareEntering.value = false
    catchReadyToThrow.value = true
    summary.value = catchCopy.value.hardwareReady
    receiveHardwareInput({
      type: 'device-ready',
      gameType: 'catch',
      payload: { state: 'idle' },
    })
  }, 950)
}

const startBubbleGame = () => {
  animationState.value = 'watching'
  spawnBubble()
  spawnTimer = setInterval(() => {
    if (!showGameRules.value && !isPaused.value) spawnBubble()
  }, 460)
  moveTimer = setInterval(() => {
    if (showGameRules.value || isPaused.value) return
    let escaped = false
    bubbles.value = bubbles.value
      .map((bubble) => ({
        ...bubble,
        bottom: bubble.bottom + bubble.speed,
        left: Math.max(4, Math.min(92, bubble.left + bubble.drift + Math.sin(bubble.bottom / 9) * bubble.wobble)),
      }))
      .filter((bubble) => {
        const visible = bubble.bottom < 96
        if (!visible) escaped = true
        return visible
      })

    if (escaped && combo.value > 0) {
      combo.value = 0
      summary.value = ui.value.bubbleEscaped
    }
  }, 80)
}

const startJumpRopeGame = () => {
  animationState.value = 'idle'
  moveTimer = setInterval(() => {
    if (showGameRules.value || isPaused.value) return
    const pace = Math.min(12, 6 + Math.floor(score.value / 8) + Math.floor(combo.value / 4))
    ropePhase.value = (ropePhase.value + pace) % 100
  }, 80)
}

const startHideSeekGame = () => {
  animationState.value = 'hiding'
  chooseHiddenSpot()
}

const startGame = () => {
  clearTimers()
  isRunning.value = true
  isPaused.value = false
  gameCompleted.value = false
  score.value = 0
  combo.value = 0
  maxCombo.value = 0
  timeLeft.value = activeDefinition.value.durationSeconds
  bubbles.value = []
  bubblePopEffects.value = []
  catchRhythm.value = 0
  catchPerfects.value = 0
  catchQuality.value = 'ready'
  catchReadyToThrow.value = false
  catchPendingPerfect.value = false
  catchPetReacting.value = false
  ropePhase.value = 0
  jumpPerfects.value = 0
  missCount.value = 0
  foundSpot.value = null
  hideWrongSpots.value = []
  hideClue.value = ''
  hardwareEntering.value = false
  summary.value = localize(activeDefinition.value.runningText)
  setActiveMiniGame(activeGame.value)
  triggerHardwareAction('game-start', {
    game_id: activeGame.value,
    scene: activeDefinition.value.scene_config.scene,
  })

  if (activeGame.value === 'catch') startCatchGame()
  if (activeGame.value === 'bubble') startBubbleGame()
  if (activeGame.value === 'jumpRope') startJumpRopeGame()
  if (activeGame.value === 'hideSeek') startHideSeekGame()

  startCountdown()
}

const pauseGame = () => {
  if (!isRunning.value || gameCompleted.value || isPaused.value) return
  isPaused.value = true
  summary.value = ui.value.paused
  triggerHardwareAction('game-pause', {
    game_id: activeGame.value,
    timeLeft: timeLeft.value,
    score: score.value,
  })
}

const resumeGame = () => {
  if (!isRunning.value || gameCompleted.value || !isPaused.value) return
  isPaused.value = false
  summary.value = localize(activeDefinition.value.runningText)
  triggerHardwareAction('game-resume', {
    game_id: activeGame.value,
    timeLeft: timeLeft.value,
    score: score.value,
  })
}

const handlePrimaryAction = () => {
  if (!isRunning.value || gameCompleted.value) {
    startGame()
    return
  }

  if (isPaused.value) {
    resumeGame()
    return
  }

  pauseGame()
}

const blowWhistle = () => {
  if (!canWhistle.value || activeGame.value !== 'catch') return

  const perfect = catchRhythmInZone.value
  catchQuality.value = perfect ? 'perfect' : 'steady'
  catchPendingPerfect.value = perfect
  catchReadyToThrow.value = false
  animationState.value = 'throwing'
  catchPetReaction.value = perfect ? 'tail' : 'perk'
  catchPetReacting.value = true
  if (catchPetReactionTimer) clearTimeout(catchPetReactionTimer)
  catchPetReactionTimer = setTimeout(() => {
    catchPetReacting.value = false
    catchPetReactionTimer = undefined
  }, 560)
  summary.value = ui.value.throwing
  triggerHardwareAction('whistle-throw', {
    game_id: 'catch',
    state: 'throwing',
    timing: Math.round(catchRhythm.value),
    perfect,
  })
  receiveHardwareInput({
    type: 'whistle-throw',
    gameType: 'catch',
    payload: { timing: Math.round(catchRhythm.value), perfect },
  })

  queueSequence(() => {
    if (!isRunning.value || activeGame.value !== 'catch') return
    animationState.value = 'fetching'
    summary.value = perfect ? catchCopy.value.whistlePerfect : catchCopy.value.whistleReady
    triggerHardwareAction('pet-fetch-start', {
      game_id: 'catch',
      state: 'fetching',
    })
  }, 360)

  queueSequence(() => {
    if (!isRunning.value || activeGame.value !== 'catch') return
    animationState.value = 'returning'
    summary.value = ui.value.returning
    receiveHardwareInput({
      type: 'pet-returning',
      gameType: 'catch',
      payload: { state: 'returning' },
    })
  }, 1040)

  queueSequence(() => {
    if (!isRunning.value || activeGame.value !== 'catch') return
    score.value += perfect ? 5 : 4
    combo.value = perfect ? combo.value + 1 : 0
    if (perfect) catchPerfects.value += 1
    maxCombo.value = Math.max(maxCombo.value, combo.value)
    animationState.value = 'idle'
    catchPendingPerfect.value = false
    catchReadyToThrow.value = true
    summary.value = perfect ? ui.value.perfectFetch : ui.value.steadyFetch
    receiveHardwareInput({
      type: 'ball-returned',
      gameType: 'catch',
      payload: { score: score.value, combo: combo.value, perfect },
    })
    if (score.value >= activeDefinition.value.targetScore) {
      catchReadyToThrow.value = false
      queueSequence(finishGame, 420)
    }
  }, 1880)
}

const tapCatchDog = () => {
  if (activeGame.value !== 'catch' || showGameRules.value || isPaused.value || hardwareEntering.value) return
  if (animationState.value !== 'idle') return

  const lines = catchCopy.value.tapLines
  const nextIndex =
    lines.length <= 1
      ? 0
      : (catchPetTapIndex.value + 1 + Math.floor(Math.random() * (lines.length - 1))) % lines.length
  const reactions: CatchPetReaction[] = ['perk', 'tail', 'bow']
  catchPetTapIndex.value = nextIndex
  catchPetReaction.value = reactions[Math.floor(Math.random() * reactions.length)]
  catchPetReacting.value = true
  summary.value = lines[nextIndex]
  if (catchPetReactionTimer) clearTimeout(catchPetReactionTimer)
  catchPetReactionTimer = setTimeout(() => {
    catchPetReacting.value = false
    catchPetReactionTimer = undefined
  }, 660)
  triggerHardwareAction('pet-touch', {
    game_id: 'catch',
    reaction: catchPetReaction.value,
    readyToThrow: catchReadyToThrow.value,
  })
}

const simulateHardwareButton = (button: M5Button) => {
  if (activeGame.value !== 'catch') return
  triggerHardwareAction('m5-button', {
    game_id: 'catch',
    button,
    source: 'software-ui',
  })
  receiveHardwareInput({
    type: `m5-${button.toLowerCase()}`,
    gameType: 'catch',
    payload: { button },
  })

  if (button === 'BtnA') {
    blowWhistle()
    return
  }

  openGameRules()
}

const hitBubble = (id: string) => {
  if (!isRunning.value || isPaused.value || activeGame.value !== 'bubble') return
  const target = bubbles.value.find((bubble) => bubble.id === id)
  if (!target) return

  bubbles.value = bubbles.value.filter((bubble) => bubble.id !== id)
  combo.value += 1
  maxCombo.value = Math.max(maxCombo.value, combo.value)
  const comboBonus = combo.value > 0 && combo.value % 5 === 0 ? 2 : 0
  const gainedScore = target.value + comboBonus
  score.value += gainedScore
  animationState.value = 'popping'
  addBubblePopEffect(target, gainedScore)
  summary.value = settings.value.language === 'zh'
    ? `${ui.value.bubbleCombo} x${combo.value}，戳破${target.tone === 'heart' ? '爱心泡泡' : target.tone === 'star' ? '星星泡泡' : '泡泡'} +${gainedScore}`
    : `${ui.value.bubbleCombo} x${combo.value}. ${target.tone === 'heart' ? 'Heart bubble' : target.tone === 'star' ? 'Star bubble' : 'Bubble'} +${gainedScore}`
  triggerHardwareAction('bubble-pop', {
    game_id: 'bubble',
    combo: combo.value,
    tone: target.tone,
    gainedScore,
  })
  queueSequence(() => {
    if (isRunning.value && activeGame.value === 'bubble') animationState.value = 'watching'
  }, 260)

  if (score.value >= activeDefinition.value.targetScore) {
    queueSequence(finishGame, 360)
  }
}

const tapJump = () => {
  if (!canUseActionButton.value || activeGame.value !== 'jumpRope') return

  if (jumpWindowActive.value) {
    const perfect = jumpPerfectActive.value
    const gainedScore = perfect ? 3 : 2
    score.value += gainedScore
    combo.value += 1
    if (perfect) jumpPerfects.value += 1
    maxCombo.value = Math.max(maxCombo.value, combo.value)
    animationState.value = 'jumping'
    summary.value = settings.value.language === 'zh'
      ? `${perfect ? '完美起跳' : ui.value.jumpGood} +${gainedScore}，连跳 ${combo.value}`
      : `${perfect ? 'Perfect jump' : ui.value.jumpGood} +${gainedScore}. Streak ${combo.value}`
    triggerHardwareAction('jump-rope-hit', {
      game_id: 'jumpRope',
      phase: ropePhase.value,
      combo: combo.value,
      perfect,
    })
    receiveHardwareInput({
      type: 'jump-success',
      gameType: 'jumpRope',
      payload: { phase: ropePhase.value, combo: combo.value, perfect },
    })
    queueSequence(() => {
      if (isRunning.value && activeGame.value === 'jumpRope') animationState.value = 'idle'
    }, 360)

    if (score.value >= activeDefinition.value.targetScore) {
      queueSequence(finishGame, 420)
    }
    return
  }

  missCount.value += 1
  combo.value = 0
  animationState.value = 'fallen'
  summary.value = ui.value.jumpMiss
  triggerHardwareAction('jump-rope-miss', {
    game_id: 'jumpRope',
    phase: ropePhase.value,
    misses: missCount.value,
  })
  receiveHardwareInput({
    type: 'jump-failed',
    gameType: 'jumpRope',
    payload: { phase: ropePhase.value, misses: missCount.value },
  })

  if (missCount.value >= 3) {
    queueSequence(finishGame, 760)
    return
  }

  queueSequence(() => {
    if (isRunning.value && activeGame.value === 'jumpRope') animationState.value = 'idle'
  }, 820)
}

const seekSpot = (spotId: string) => {
  if (!isRunning.value || isPaused.value || activeGame.value !== 'hideSeek' || animationState.value === 'found') return

  triggerHardwareAction('seek-spot', {
    game_id: 'hideSeek',
    spot: spotId,
  })

  if (spotId !== hiddenSpot.value) {
    if (!hideWrongSpots.value.includes(spotId)) {
      hideWrongSpots.value = [...hideWrongSpots.value, spotId]
    }
    hideClue.value = hideClueForMiss(spotId)
    combo.value = 0
    missCount.value += 1
    summary.value = `${ui.value.seekWrong} ${hideClue.value}`
    receiveHardwareInput({
      type: 'seek-miss',
      gameType: 'hideSeek',
      payload: { spot: spotId, clue: hideClue.value },
    })
    return
  }

  foundSpot.value = spotId
  hideWrongSpots.value = []
  hideClue.value = settings.value.language === 'zh' ? '找到了！Koko 正在换一个新地方。' : 'Found it. Koko is choosing a new hiding place.'
  animationState.value = 'found'
  score.value += combo.value >= 2 ? 6 : 5
  combo.value += 1
  maxCombo.value = Math.max(maxCombo.value, combo.value)
  summary.value = ui.value.seekRight
  receiveHardwareInput({
    type: 'pet-found',
    gameType: 'hideSeek',
    payload: { spot: spotId, score: score.value },
  })

  if (score.value >= activeDefinition.value.targetScore) {
    queueSequence(finishGame, 700)
    return
  }

  queueSequence(() => {
    if (!isRunning.value || activeGame.value !== 'hideSeek') return
    animationState.value = 'hiding'
    chooseHiddenSpot()
  }, 900)
}

const switchHideScene = (sceneId: HideSceneId) => {
  if (activeHideScene.value === sceneId) return
  if (isRunning.value && !isPaused.value && !gameCompleted.value) return

  activeHideScene.value = sceneId
  resetBoard()
  hideClue.value = settings.value.language === 'zh'
    ? '已切换藏身场景，点击开始让 Koko 躲起来。'
    : 'Scene switched. Tap Start and Koko will hide here.'
}

const switchGame = (game: MiniGameType) => {
  if (activeGame.value === game) return
  activeGame.value = game
  resetBoard()
  setActiveMiniGame(game)
  maybeShowGameRules()
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      activeGame.value = props.defaultGame
      resetBoard()
      setActiveMiniGame(props.defaultGame)
      maybeShowGameRules()
    } else {
      clearTimers()
      isPaused.value = false
      showGameRules.value = false
      catchReadyToThrow.value = false
      catchPendingPerfect.value = false
      setActiveMiniGame(null)
    }
  },
)

watch(
  () => props.defaultGame,
  (value) => {
    if (!props.modelValue) return
    activeGame.value = value
    resetBoard()
    setActiveMiniGame(value)
    maybeShowGameRules()
  },
)

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<template>
  <view v-if="modelValue" class="mini-game-drawer mini-game-drawer--open">
    <view class="mini-game-drawer__backdrop" @click="close" />
    <view class="mini-game-drawer__panel">
      <view class="mini-game-drawer__handle" />
      <view class="mini-game-drawer__head">
        <view>
          <view class="mini-game-drawer__eyebrow">{{ ui.playTime }}</view>
          <view class="mini-game-drawer__title">{{ localize(activeDefinition.title) }}</view>
        </view>
        <view class="mini-game-drawer__head-actions">
          <button class="mini-game-drawer__rule" @click="openGameRules">{{ ui.rules }}</button>
          <button class="mini-game-drawer__close" @click="close">{{ ui.collapse }}</button>
        </view>
      </view>

      <view class="mini-game-selector">
        <button
          v-for="game in selectorGames"
          :key="game.game_id"
          class="mini-game-selector__item"
          :class="{ 'mini-game-selector__item--active': activeGame === game.game_id }"
          @click="switchGame(game.game_id)"
        >
          <view class="mini-game-selector__scene" :class="`mini-game-selector__scene--${game.scene_config.scene}`" />
          <view class="mini-game-selector__text">
            <view class="mini-game-selector__title">{{ localize(game.tabLabel) }}</view>
            <view class="mini-game-selector__goal">{{ localize(game.goal) }}</view>
          </view>
        </button>
      </view>

      <view class="mini-game-scorebar">
        <view class="mini-game-scorecard">
          <view class="mini-game-scorecard__label">{{ ui.score }}</view>
          <view class="mini-game-scorecard__value">{{ score }}</view>
        </view>
        <view class="mini-game-scorecard">
          <view class="mini-game-scorecard__label">{{ ui.countdown }}</view>
          <view class="mini-game-scorecard__value">{{ timeLeft }}s</view>
        </view>
        <view class="mini-game-scorecard">
          <view class="mini-game-scorecard__label">{{ ui.combo }}</view>
          <view class="mini-game-scorecard__value">{{ maxCombo }}</view>
        </view>
        <view class="mini-game-scorecard">
          <view class="mini-game-scorecard__label">{{ ui.goal }}</view>
          <view class="mini-game-scorecard__value">{{ targetLabel }}</view>
        </view>
      </view>

      <view class="mini-game-stage" :class="[stageClass, { 'mini-game-stage--hardware': hardwareEntering, 'mini-game-stage--rules-open': showGameRules, 'mini-game-stage--paused': isPaused }]">
        <template v-if="activeGame === 'catch'">
          <view class="catch-sun" />
          <view class="catch-cloud catch-cloud--one" />
          <view class="catch-cloud catch-cloud--two" />
          <view class="catch-hill catch-hill--back" />
          <view class="catch-hill catch-hill--front" />
          <view class="catch-tree catch-tree--left">
            <view class="catch-tree__crown" />
            <view class="catch-tree__trunk" />
          </view>
          <view class="catch-tree catch-tree--right">
            <view class="catch-tree__crown" />
            <view class="catch-tree__trunk" />
          </view>
          <view class="catch-path" />
          <view class="hardware-portal" :class="{ 'hardware-portal--active': hardwareEntering }">
            <view class="hardware-portal__ring" />
            <view class="hardware-portal__core">M5</view>
          </view>
          <view class="catch-rhythm-card">
            <view class="catch-rhythm-card__head">
              <view>{{ ui.rhythm }}</view>
              <view>{{ catchRhythmScoreLabel }}</view>
            </view>
            <view class="catch-rhythm-track">
              <view class="catch-rhythm-track__zone" />
              <view class="catch-rhythm-track__needle" :class="{ 'catch-rhythm-track__needle--active': catchRhythmInZone }" :style="catchRhythmNeedleStyle" />
            </view>
          </view>
          <view class="m5-panel">
            <view class="m5-panel__title">{{ ui.hardwareTitle }}</view>
            <view class="m5-panel__status">{{ ui.hardwareStatus }}</view>
            <view class="m5-panel__buttons">
              <button class="m5-panel__button" :disabled="!canWhistle" hover-class="none" @tap.stop="simulateHardwareButton('BtnA')">{{ ui.hardwareBtnA }}</button>
              <button class="m5-panel__button" hover-class="none" @tap.stop="simulateHardwareButton('BtnB')">{{ ui.hardwareBtnB }}</button>
            </view>
          </view>
          <view v-if="catchBallActive" class="fetch-ball" :class="`fetch-ball--${animationState}`" />
          <view
            class="mini-game-dog mini-game-dog--catch"
            :class="[
              petStateClass,
              `mini-game-dog--tap-${catchPetReaction}`,
              {
                'mini-game-pet--hardware-enter': hardwareEntering && !showGameRules,
                'mini-game-dog--still': dogStill,
                'mini-game-dog--tap': catchPetReacting,
              },
            ]"
            @tap.stop="tapCatchDog"
          >
            <PetLottieAvatar v-if="!showGameRules" :size-rpx="220" :mirror="dogMirror" />
            <button v-if="!showGameRules" class="mini-game-dog__touch" hover-class="none" @tap.stop="tapCatchDog" />
          </view>
          <view class="catch-command-group">
            <button class="mini-game-command mini-game-command--catch" :disabled="!canWhistle" hover-class="none" @tap.stop="blowWhistle">
              {{ localize(activeDefinition.actionLabel) }}
            </button>
          </view>
        </template>

        <template v-else-if="activeGame === 'bubble'">
          <view class="bubble-window">
            <view class="bubble-window__shine" />
          </view>
          <view class="bubble-shelf">
            <view class="bubble-bottle bubble-bottle--mint" />
            <view class="bubble-bottle bubble-bottle--sun" />
            <view class="bubble-bottle bubble-bottle--rose" />
          </view>
          <view class="bubble-shower">
            <view class="bubble-shower__pipe" />
            <view class="bubble-shower__head" />
            <view class="bubble-shower__drop bubble-shower__drop--one" />
            <view class="bubble-shower__drop bubble-shower__drop--two" />
            <view class="bubble-shower__drop bubble-shower__drop--three" />
          </view>
          <view class="bubble-foam bubble-foam--one" />
          <view class="bubble-foam bubble-foam--two" />
          <view class="bath-tub" />
          <button
            v-for="bubble in bubbles"
            :key="bubble.id"
            class="mini-game-bubble"
            :class="`mini-game-bubble--${bubble.tone}`"
            :style="{ left: `${bubble.left}%`, bottom: `${bubble.bottom}%`, width: `${bubble.size}rpx`, height: `${bubble.size}rpx` }"
            @click="hitBubble(bubble.id)"
          >
            <view v-if="bubble.tone !== 'soap'" class="mini-game-bubble__mark">{{ bubble.tone === 'heart' ? '♥' : '★' }}</view>
          </button>
          <view
            v-for="effect in bubblePopEffects"
            :key="effect.id"
            class="bubble-pop-effect"
            :class="`bubble-pop-effect--${effect.tone}`"
            :style="{ left: `${effect.left}%`, bottom: `${effect.bottom}%` }"
          >
            {{ effect.text }}
          </view>
          <view class="mini-game-dog mini-game-dog--bubble" :class="[petStateClass, { 'mini-game-dog--still': dogStill }]">
            <PetLottieAvatar v-if="!showGameRules" :size-rpx="190" :still="dogStill" />
          </view>
        </template>

        <template v-else-if="activeGame === 'jumpRope'">
          <view class="jump-sun" />
          <view class="jump-cloud jump-cloud--one" />
          <view class="jump-cloud jump-cloud--two" />
          <view class="jump-hill jump-hill--left" />
          <view class="jump-hill jump-hill--right" />
          <view class="jump-fence" />
          <view class="jump-streak">
            <view
              v-for="light in 5"
              :key="light"
              class="jump-streak__light"
              :class="{ 'jump-streak__light--active': light <= jumpStreakLights }"
            />
          </view>
          <view class="jump-rhythm">
            <view class="jump-rhythm__zone" />
            <view class="jump-rhythm__perfect" />
            <view class="jump-rhythm__needle" :style="rhythmNeedleStyle" />
          </view>
          <view class="jump-rope-arc jump-rope-arc--back" :class="{ 'jump-rope-arc--active': jumpWindowActive }" />
          <view class="jump-rope" :class="{ 'jump-rope--window': jumpWindowActive }" :style="ropeStyle">
            <view class="jump-rope__cord" />
          </view>
          <view class="jump-rope-handle jump-rope-handle--left" />
          <view class="jump-rope-handle jump-rope-handle--right" />
          <view class="mini-game-dog mini-game-dog--jump" :class="[petStateClass, { 'mini-game-dog--still': dogStill }]">
            <PetLottieAvatar v-if="!showGameRules" :size-rpx="200" :still="dogStill" />
          </view>
          <view class="jump-rope-arc jump-rope-arc--front" :class="{ 'jump-rope-arc--active': jumpWindowActive }" />
          <button class="mini-game-command mini-game-command--jump" :disabled="!canUseActionButton" @click="tapJump">
            {{ localize(activeDefinition.actionLabel) }}
          </button>
        </template>

        <template v-else>
          <view class="hide-sky-glow" />
          <view class="hide-cloud hide-cloud--one" />
          <view class="hide-cloud hide-cloud--two" />
          <view class="hide-grove hide-grove--left" />
          <view class="hide-grove hide-grove--right" />
          <view class="hide-path" />
          <view class="hide-fence" />
          <view class="hide-flower-patch hide-flower-patch--left" />
          <view class="hide-flower-patch hide-flower-patch--right" />
          <view class="hide-sign" />
          <view class="hide-lamp hide-lamp--left" />
          <view class="hide-lamp hide-lamp--right" />
          <view class="hide-scene-picker">
            <button
              v-for="scene in hideScenes"
              :key="scene.id"
              class="hide-scene-picker__button"
              :class="{ 'hide-scene-picker__button--active': activeHideScene === scene.id }"
              :disabled="isRunning && !isPaused && !gameCompleted"
              @click.stop="switchHideScene(scene.id)"
            >
              {{ localize(scene.label) }}
            </button>
          </view>
          <view class="hide-clue-card">{{ hideClue || localize(activeDefinition.runningText) }}</view>
          <view class="hide-firefly hide-firefly--one" />
          <view class="hide-firefly hide-firefly--two" />
          <view class="hide-firefly hide-firefly--three" />
          <button
            v-for="spot in activeHideSpots"
            :key="spot.id"
            class="hide-spot"
            :class="[`hide-spot--${spot.tone}`, { 'hide-spot--found': foundSpot === spot.id, 'hide-spot--checked': hideWrongSpots.includes(spot.id) }]"
            :style="{ left: `${spot.left}%`, top: `${spot.top}%` }"
            @click="seekSpot(spot.id)"
          >
            <view class="hide-spot__prop" />
            <view class="hide-spot__label">{{ localize(spot.label) }}</view>
          </button>
          <view v-if="foundHideSpot && !showGameRules" class="mini-game-peek-pet mini-game-peek-pet--stage" :style="foundPeekPetStyle">
            <PetLottieAvatar :size-rpx="86" />
          </view>
        </template>
      </view>

      <view class="mini-game-summary">{{ summary || ui.ready }}</view>

      <view class="mini-game-actions">
        <button class="mini-game-actions__primary" :class="{ 'mini-game-actions__primary--paused': isPaused }" @click="handlePrimaryAction">
          {{ primaryActionLabel }}
        </button>
      </view>

      <cover-view v-if="showGameRules" class="catch-rules-layer">
        <cover-view class="catch-rules-layer__mask" @tap="closeGameRules" />
        <cover-view class="catch-rules-card">
          <cover-view class="catch-rules-card__title">{{ activeRuleTitle }}</cover-view>
          <cover-view class="catch-rules-card__list">
            <cover-view v-for="(rule, index) in activeRuleList" :key="rule" class="catch-rules-card__item">
              <cover-view class="catch-rules-card__index">{{ index + 1 }}.</cover-view>
              <cover-view class="catch-rules-card__text">{{ rule }}</cover-view>
            </cover-view>
          </cover-view>
          <cover-view v-if="activeGame === 'catch'" class="catch-rules-card__hardware">
            <cover-view class="catch-rules-card__hardware-name">M5StickS3</cover-view>
            <cover-view>{{ ui.hardwareBtnA }} / {{ ui.hardwareBtnB }}</cover-view>
          </cover-view>
          <cover-view v-else class="catch-rules-card__hardware">
            <cover-view class="catch-rules-card__hardware-name">{{ ui.goal }}</cover-view>
            <cover-view>{{ localize(activeDefinition.goal) }}</cover-view>
          </cover-view>
          <cover-view class="catch-rules-card__button" @tap="closeGameRules">{{ ui.closeRules }}</cover-view>
        </cover-view>
      </cover-view>
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
  background: rgba(27, 42, 39, 0.28);
  inset: 0;
  position: absolute;
}

.mini-game-drawer__panel {
  background: linear-gradient(180deg, #fffdf8 0%, #f5fbf4 100%);
  border: 2rpx solid rgba(83, 122, 108, 0.14);
  bottom: 0;
  box-shadow: 0 -20rpx 48rpx rgba(64, 96, 84, 0.16);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  left: 0;
  padding: calc(18rpx + env(safe-area-inset-top)) 22rpx calc(22rpx + env(safe-area-inset-bottom));
  position: absolute;
  right: 0;
  top: 0;
}

.mini-game-drawer__handle {
  background: rgba(112, 132, 124, 0.32);
  border-radius: 999rpx;
  height: 6rpx;
  margin: 0 auto 16rpx;
  width: 56rpx;
}

.mini-game-drawer__head,
.mini-game-scorebar,
.mini-game-actions {
  align-items: center;
  display: flex;
}

.mini-game-drawer__head {
  justify-content: space-between;
}

.mini-game-drawer__eyebrow {
  color: #4f8777;
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
.mini-game-drawer__rule,
.mini-game-selector__item,
.mini-game-actions__primary,
.mini-game-actions__ghost,
.mini-game-command,
.mini-game-bubble,
.hide-spot,
.m5-panel__button,
.mini-game-dog__touch,
.catch-rules-card__button {
  border: 0;
  margin: 0;
  padding: 0;
}

.mini-game-drawer__close::after,
.mini-game-drawer__rule::after,
.mini-game-selector__item::after,
.mini-game-actions__primary::after,
.mini-game-actions__ghost::after,
.mini-game-command::after,
.mini-game-bubble::after,
.hide-spot::after,
.m5-panel__button::after,
.mini-game-dog__touch::after,
.catch-rules-card__button::after {
  border: 0;
}

.mini-game-drawer__head-actions {
  align-items: center;
  display: flex;
  gap: 10rpx;
}

.mini-game-drawer__close,
.mini-game-drawer__rule {
  background: rgba(255, 255, 255, 0.78);
  border-radius: 999rpx;
  color: #6d7b72;
  font-size: 24rpx;
  font-weight: 800;
  padding: 12rpx 22rpx;
}

.mini-game-drawer__rule {
  background: rgba(229, 247, 239, 0.9);
  color: #2f755f;
}

.mini-game-selector {
  display: grid;
  gap: 12rpx;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 18rpx;
}

.mini-game-selector__item {
  align-items: stretch;
  background: rgba(255, 255, 255, 0.74);
  border: 2rpx solid rgba(85, 126, 111, 0.12);
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  min-height: 148rpx;
  overflow: hidden;
  text-align: left;
}

.mini-game-selector__item--active {
  border-color: rgba(66, 156, 127, 0.54);
  box-shadow: 0 12rpx 24rpx rgba(66, 156, 127, 0.14);
}

.mini-game-selector__scene {
  height: 42rpx;
}

.mini-game-selector__scene--grass {
  background: linear-gradient(180deg, #bfeefe 0%, #8bd16f 100%);
}

.mini-game-selector__scene--bathroom {
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.38) 1rpx, transparent 1rpx),
    linear-gradient(180deg, #dff7ff 0%, #a7dff0 100%);
  background-size: 24rpx 24rpx, auto;
}

.mini-game-selector__scene--outdoor {
  background: linear-gradient(180deg, #d9f4ff 0%, #f7d978 60%, #80c77a 100%);
}

.mini-game-selector__scene--hideout {
  background: linear-gradient(135deg, #cfecb0 0%, #84b882 46%, #c8a16c 100%);
}

.mini-game-selector__text {
  padding: 12rpx 10rpx 14rpx;
}

.mini-game-selector__title {
  color: #253047;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1.2;
}

.mini-game-selector__goal {
  color: #728276;
  font-size: 19rpx;
  line-height: 1.32;
  margin-top: 8rpx;
}

.mini-game-scorebar {
  gap: 10rpx;
  margin-top: 16rpx;
}

.mini-game-scorecard {
  background: rgba(255, 255, 255, 0.8);
  border: 2rpx solid rgba(91, 124, 111, 0.12);
  border-radius: 16rpx;
  flex: 1;
  min-width: 0;
  padding: 14rpx 12rpx;
}

.mini-game-scorecard__label {
  color: #718077;
  font-size: 20rpx;
}

.mini-game-scorecard__value {
  color: #253047;
  font-size: 30rpx;
  font-weight: 900;
  margin-top: 6rpx;
}

.mini-game-stage {
  border-radius: 24rpx;
  flex: 1;
  margin-top: 16rpx;
  min-height: 410rpx;
  overflow: hidden;
  position: relative;
}

.mini-game-stage--catch {
  background:
    radial-gradient(circle at 14% 16%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0) 18%),
    linear-gradient(180deg, #aee9ff 0%, #d7f7ff 38%, #dff6b8 39%, #8dd06c 68%, #54af58 100%);
}

.mini-game-stage--rules-open {
  pointer-events: none;
}

.mini-game-stage--paused .hardware-portal,
.mini-game-stage--paused .hardware-portal__ring,
.mini-game-stage--paused .catch-rhythm-track__needle,
.mini-game-stage--paused .fetch-ball,
.mini-game-stage--paused .mini-game-dog,
.mini-game-stage--paused .mini-game-bubble,
.mini-game-stage--paused .bubble-shower__drop,
.mini-game-stage--paused .bubble-pop-effect,
.mini-game-stage--paused .jump-rope,
.mini-game-stage--paused .jump-rope-arc,
.mini-game-stage--paused .hide-firefly,
.mini-game-stage--paused .hide-spot--found .hide-spot__prop,
.mini-game-stage--paused .mini-game-peek-pet {
  animation-play-state: paused !important;
}

.mini-game-stage--bubble {
  background:
    radial-gradient(circle at 12% 20%, rgba(255, 255, 255, 0.85) 0, rgba(255, 255, 255, 0) 18%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.44) 1rpx, transparent 1rpx),
    linear-gradient(180deg, rgba(255, 255, 255, 0.4) 1rpx, transparent 1rpx),
    linear-gradient(180deg, #dff8ff 0%, #b8e8f6 58%, #f6f0d9 100%);
  background-size: auto, 48rpx 48rpx, 48rpx 48rpx, auto;
}

.mini-game-stage--jump {
  background:
    radial-gradient(circle at 82% 18%, rgba(255, 238, 146, 0.72) 0, rgba(255, 238, 146, 0) 18%),
    linear-gradient(180deg, #c9efff 0%, #e6f6ff 38%, #f8e7a7 52%, #83c774 53%, #5aa65b 100%);
}

.mini-game-stage--hide {
  background:
    radial-gradient(circle at 82% 18%, rgba(255, 247, 184, 0.86) 0, rgba(255, 247, 184, 0) 20%),
    radial-gradient(circle at 18% 24%, rgba(166, 228, 255, 0.52) 0, rgba(166, 228, 255, 0) 18%),
    linear-gradient(180deg, #d8f3ff 0%, #d8f0c3 48%, #94c977 100%);
}

.mini-game-stage--hide-garden {
  background:
    radial-gradient(circle at 82% 18%, rgba(255, 247, 184, 0.86) 0, rgba(255, 247, 184, 0) 20%),
    radial-gradient(circle at 18% 24%, rgba(166, 228, 255, 0.52) 0, rgba(166, 228, 255, 0) 18%),
    linear-gradient(180deg, #d8f3ff 0%, #d8f0c3 48%, #94c977 100%);
}

.mini-game-stage--hide-picnic {
  background:
    radial-gradient(circle at 72% 18%, rgba(255, 236, 148, 0.84) 0, rgba(255, 236, 148, 0) 20%),
    radial-gradient(circle at 28% 66%, rgba(255, 188, 152, 0.44) 0, rgba(255, 188, 152, 0) 18%),
    linear-gradient(180deg, #c9f0ff 0%, #f6edb6 48%, #86cc76 100%);
}

.mini-game-stage--hide-camp {
  background:
    radial-gradient(circle at 18% 18%, rgba(255, 243, 184, 0.78) 0, rgba(255, 243, 184, 0) 18%),
    radial-gradient(circle at 78% 26%, rgba(151, 198, 255, 0.34) 0, rgba(151, 198, 255, 0) 20%),
    linear-gradient(180deg, #b9dcff 0%, #d8e9c4 44%, #6fa963 100%);
}

.catch-cloud {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 999rpx;
  height: 34rpx;
  position: absolute;
  width: 112rpx;
}

.catch-cloud::before,
.catch-cloud::after {
  background: inherit;
  border-radius: 50%;
  content: '';
  position: absolute;
}

.catch-cloud::before {
  height: 52rpx;
  left: 18rpx;
  top: -22rpx;
  width: 52rpx;
}

.catch-cloud::after {
  height: 44rpx;
  right: 18rpx;
  top: -16rpx;
  width: 44rpx;
}

.catch-cloud--one {
  left: 54rpx;
  top: 64rpx;
}

.catch-cloud--two {
  right: 70rpx;
  top: 104rpx;
  transform: scale(0.86);
}

.catch-sun {
  background:
    radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.72) 0, rgba(255, 255, 255, 0.72) 16rpx, transparent 17rpx),
    linear-gradient(135deg, #ffe889, #ffb85c);
  border-radius: 50%;
  box-shadow: 0 0 34rpx rgba(255, 190, 80, 0.34);
  height: 86rpx;
  position: absolute;
  right: 36rpx;
  top: 32rpx;
  width: 86rpx;
}

.catch-hill {
  border-radius: 50% 50% 0 0;
  bottom: 92rpx;
  position: absolute;
}

.catch-hill--back {
  background: linear-gradient(180deg, #c7e99f, #93d176);
  height: 170rpx;
  left: -80rpx;
  width: 440rpx;
}

.catch-hill--front {
  background: linear-gradient(180deg, #a6dd82, #68bd61);
  bottom: 52rpx;
  height: 186rpx;
  right: -96rpx;
  width: 520rpx;
}

.catch-path {
  background: linear-gradient(180deg, rgba(255, 230, 166, 0.82), rgba(215, 158, 88, 0.72));
  border-radius: 50% 50% 0 0;
  bottom: -70rpx;
  height: 230rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 260rpx;
}

.catch-tree {
  bottom: 90rpx;
  height: 180rpx;
  position: absolute;
  width: 140rpx;
}

.catch-tree--left {
  left: 26rpx;
}

.catch-tree--right {
  right: 128rpx;
  transform: scale(0.82);
}

.catch-tree__crown {
  background:
    radial-gradient(circle at 28% 58%, #62bd63 0, #62bd63 42rpx, transparent 43rpx),
    radial-gradient(circle at 58% 40%, #81d86f 0, #81d86f 60rpx, transparent 61rpx),
    radial-gradient(circle at 78% 64%, #4ba952 0, #4ba952 40rpx, transparent 41rpx);
  height: 128rpx;
  width: 140rpx;
}

.catch-tree__trunk {
  background: linear-gradient(180deg, #a66b38, #7b4d2d);
  border-radius: 14rpx;
  bottom: 0;
  height: 88rpx;
  left: 58rpx;
  position: absolute;
  width: 28rpx;
}

.hardware-portal {
  align-items: center;
  display: flex;
  height: 150rpx;
  justify-content: center;
  opacity: 0.48;
  position: absolute;
  right: 46rpx;
  top: 154rpx;
  width: 112rpx;
}

.hardware-portal--active {
  animation: portal-pulse 0.8s ease-in-out infinite alternate;
  opacity: 1;
}

.hardware-portal__ring {
  border: 8rpx solid rgba(98, 190, 212, 0.72);
  border-radius: 50%;
  bottom: 0;
  box-shadow: 0 0 28rpx rgba(98, 190, 212, 0.34);
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.hardware-portal__core {
  color: #2e6671;
  font-size: 24rpx;
  font-weight: 900;
}

.catch-rhythm-card {
  background: rgba(255, 255, 255, 0.82);
  border: 2rpx solid rgba(57, 131, 102, 0.14);
  border-radius: 18rpx;
  box-shadow: 0 12rpx 24rpx rgba(70, 122, 83, 0.12);
  left: 24rpx;
  padding: 12rpx 14rpx 14rpx;
  position: absolute;
  right: 244rpx;
  top: 92rpx;
  z-index: 8;
}

.catch-rhythm-card__head {
  align-items: center;
  color: #2f755f;
  display: flex;
  font-size: 22rpx;
  font-weight: 900;
  justify-content: space-between;
}

.catch-rhythm-track {
  background: rgba(82, 119, 103, 0.16);
  border-radius: 999rpx;
  height: 18rpx;
  margin-top: 10rpx;
  overflow: hidden;
  position: relative;
}

.catch-rhythm-track__zone {
  background: linear-gradient(90deg, #77dd86, #40c693);
  bottom: 0;
  left: 42%;
  position: absolute;
  top: 0;
  width: 24%;
}

.catch-rhythm-track__needle {
  background: #45635a;
  border-radius: 999rpx;
  bottom: -2rpx;
  box-shadow: 0 0 0 4rpx rgba(255, 255, 255, 0.6);
  position: absolute;
  top: -2rpx;
  transform: translateX(-50%);
  width: 8rpx;
}

.catch-rhythm-track__needle--active {
  background: #18895f;
}

.m5-panel {
  background: rgba(31, 49, 59, 0.82);
  border: 2rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 18rpx;
  box-shadow: 0 12rpx 26rpx rgba(31, 49, 59, 0.16);
  color: #f6fbff;
  padding: 14rpx;
  position: absolute;
  right: 24rpx;
  top: 92rpx;
  width: 196rpx;
  z-index: 8;
}

.m5-panel__title {
  font-size: 22rpx;
  font-weight: 900;
}

.m5-panel__status {
  color: rgba(246, 251, 255, 0.72);
  font-size: 19rpx;
  margin-top: 4rpx;
}

.m5-panel__buttons {
  display: grid;
  gap: 8rpx;
  margin-top: 12rpx;
}

.m5-panel__button {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 999rpx;
  color: #1f3d49;
  font-size: 20rpx;
  font-weight: 900;
  height: 48rpx;
  line-height: 48rpx;
}

.m5-panel__button[disabled] {
  opacity: 0.5;
}

.fetch-ball {
  background: radial-gradient(circle at 32% 28%, #ffffff 0%, #fff0b5 24%, #f9aa4f 62%, #ee6f4d 100%);
  border-radius: 50%;
  box-shadow: 0 10rpx 20rpx rgba(180, 91, 58, 0.24);
  height: 54rpx;
  left: 46%;
  position: absolute;
  top: 55%;
  width: 54rpx;
  z-index: 4;
}

.fetch-ball--throwing {
  animation: ball-throw 0.58s ease-out forwards;
}

.fetch-ball--fetching {
  left: 70%;
  top: 62%;
}

.fetch-ball--returning {
  animation: ball-return 0.72s ease-in forwards;
}

.bubble-window {
  background: linear-gradient(180deg, rgba(221, 248, 255, 0.95), rgba(154, 217, 239, 0.68));
  border: 8rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 26rpx;
  box-shadow: 0 12rpx 24rpx rgba(70, 153, 181, 0.12);
  height: 120rpx;
  left: 36rpx;
  overflow: hidden;
  position: absolute;
  top: 70rpx;
  width: 170rpx;
}

.bubble-window__shine {
  background: rgba(255, 255, 255, 0.64);
  height: 170rpx;
  left: 44rpx;
  position: absolute;
  top: -28rpx;
  transform: rotate(28deg);
  width: 28rpx;
}

.bubble-shelf {
  align-items: flex-end;
  background: rgba(118, 150, 158, 0.28);
  border-radius: 999rpx;
  display: flex;
  gap: 12rpx;
  height: 14rpx;
  justify-content: center;
  position: absolute;
  right: 46rpx;
  top: 152rpx;
  width: 164rpx;
}

.bubble-bottle {
  border-radius: 12rpx 12rpx 8rpx 8rpx;
  bottom: 8rpx;
  height: 60rpx;
  position: relative;
  width: 28rpx;
}

.bubble-bottle--mint {
  background: linear-gradient(180deg, #d9fff0, #73d7bd);
}

.bubble-bottle--sun {
  background: linear-gradient(180deg, #fff0a8, #f4c35e);
  height: 74rpx;
}

.bubble-bottle--rose {
  background: linear-gradient(180deg, #ffd8e5, #ee8aaa);
}

.bubble-shower {
  height: 150rpx;
  position: absolute;
  right: 46rpx;
  top: 32rpx;
  width: 148rpx;
}

.bubble-shower__pipe {
  border-right: 10rpx solid rgba(88, 128, 145, 0.4);
  border-top: 10rpx solid rgba(88, 128, 145, 0.4);
  border-radius: 0 38rpx 0 0;
  height: 54rpx;
  position: absolute;
  right: 52rpx;
  top: 0;
  width: 62rpx;
}

.bubble-shower__head {
  background: linear-gradient(180deg, #d9eef5, #8fb6c6);
  border-radius: 999rpx;
  height: 36rpx;
  position: absolute;
  right: 28rpx;
  top: 44rpx;
  width: 74rpx;
}

.bubble-shower__drop {
  background: rgba(102, 190, 219, 0.52);
  border-radius: 999rpx;
  height: 24rpx;
  position: absolute;
  top: 92rpx;
  width: 8rpx;
}

.bubble-shower__drop--one {
  animation: bath-drop 1.2s ease-in infinite;
  right: 38rpx;
}

.bubble-shower__drop--two {
  animation: bath-drop 1.4s ease-in infinite 0.18s;
  right: 62rpx;
}

.bubble-shower__drop--three {
  animation: bath-drop 1.1s ease-in infinite 0.34s;
  right: 84rpx;
}

.bubble-foam {
  background:
    radial-gradient(circle at 18% 60%, rgba(255, 255, 255, 0.94) 0, rgba(255, 255, 255, 0.94) 24rpx, transparent 25rpx),
    radial-gradient(circle at 46% 42%, rgba(255, 255, 255, 0.88) 0, rgba(255, 255, 255, 0.88) 34rpx, transparent 35rpx),
    radial-gradient(circle at 76% 62%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0.9) 28rpx, transparent 29rpx);
  height: 86rpx;
  position: absolute;
  width: 220rpx;
  z-index: 2;
}

.bubble-foam--one {
  bottom: 118rpx;
  left: 62rpx;
}

.bubble-foam--two {
  bottom: 112rpx;
  right: 70rpx;
  transform: scale(0.86);
}

.bath-tub {
  background: linear-gradient(180deg, #ffffff 0%, #d9f2f8 100%);
  border-radius: 999rpx 999rpx 44rpx 44rpx;
  bottom: 34rpx;
  box-shadow: inset 0 -10rpx 0 rgba(100, 177, 196, 0.16);
  height: 120rpx;
  left: 70rpx;
  position: absolute;
  right: 70rpx;
}

.mini-game-bubble {
  background: radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.98), rgba(178, 244, 255, 0.68) 52%, rgba(87, 188, 214, 0.42) 100%);
  border-radius: 50%;
  box-shadow: inset -6rpx -6rpx 14rpx rgba(72, 166, 196, 0.16), 0 12rpx 22rpx rgba(78, 167, 203, 0.18);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1;
  position: absolute;
  z-index: 7;
}

.mini-game-bubble--star {
  background: radial-gradient(circle at 30% 24%, #fff 0%, #fff7bd 44%, rgba(255, 195, 80, 0.76) 100%);
  box-shadow: inset -6rpx -6rpx 14rpx rgba(188, 123, 34, 0.18), 0 0 22rpx rgba(255, 213, 112, 0.46);
}

.mini-game-bubble--heart {
  background: radial-gradient(circle at 30% 24%, #fff 0%, #ffd9e5 42%, rgba(238, 120, 154, 0.82) 100%);
  box-shadow: inset -6rpx -6rpx 14rpx rgba(176, 58, 94, 0.18), 0 0 26rpx rgba(255, 159, 190, 0.5);
}

.mini-game-bubble__mark {
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  text-shadow: 0 2rpx 5rpx rgba(126, 82, 54, 0.22);
  width: 100%;
}

.bubble-pop-effect {
  animation: bubble-pop-rise 0.62s ease-out forwards;
  color: #247f6b;
  font-size: 28rpx;
  font-weight: 900;
  pointer-events: none;
  position: absolute;
  text-shadow: 0 4rpx 10rpx rgba(255, 255, 255, 0.88);
  transform: translate(-50%, 0);
  z-index: 12;
}

.bubble-pop-effect--star {
  color: #bc7d18;
}

.bubble-pop-effect--heart {
  color: #d94f80;
}

.jump-sun {
  background: linear-gradient(135deg, #ffe889, #ffb85c);
  border-radius: 50%;
  box-shadow: 0 0 34rpx rgba(255, 190, 80, 0.36);
  height: 78rpx;
  position: absolute;
  right: 42rpx;
  top: 34rpx;
  width: 78rpx;
}

.jump-cloud {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 999rpx;
  height: 30rpx;
  position: absolute;
  width: 104rpx;
}

.jump-cloud::before,
.jump-cloud::after {
  background: inherit;
  border-radius: 50%;
  content: '';
  position: absolute;
}

.jump-cloud::before {
  height: 46rpx;
  left: 16rpx;
  top: -20rpx;
  width: 46rpx;
}

.jump-cloud::after {
  height: 38rpx;
  right: 16rpx;
  top: -14rpx;
  width: 38rpx;
}

.jump-cloud--one {
  left: 52rpx;
  top: 82rpx;
}

.jump-cloud--two {
  right: 152rpx;
  top: 130rpx;
  transform: scale(0.78);
}

.jump-hill {
  border-radius: 50% 50% 0 0;
  bottom: 62rpx;
  position: absolute;
}

.jump-hill--left {
  background: linear-gradient(180deg, #b9e293, #76c569);
  height: 170rpx;
  left: -110rpx;
  width: 430rpx;
}

.jump-hill--right {
  background: linear-gradient(180deg, #cdeaa0, #82cb69);
  bottom: 42rpx;
  height: 190rpx;
  right: -120rpx;
  width: 520rpx;
}

.jump-fence {
  background:
    repeating-linear-gradient(90deg, rgba(120, 82, 46, 0.68) 0, rgba(120, 82, 46, 0.68) 14rpx, transparent 14rpx, transparent 58rpx),
    linear-gradient(180deg, transparent 0, transparent 26rpx, rgba(120, 82, 46, 0.5) 26rpx, rgba(120, 82, 46, 0.5) 38rpx, transparent 38rpx);
  bottom: 148rpx;
  height: 86rpx;
  left: 0;
  opacity: 0.42;
  position: absolute;
  right: 0;
}

.jump-streak {
  display: flex;
  gap: 8rpx;
  left: 28rpx;
  position: absolute;
  top: 92rpx;
  z-index: 9;
}

.jump-streak__light {
  background: rgba(255, 255, 255, 0.78);
  border: 2rpx solid rgba(95, 199, 168, 0.18);
  border-radius: 50%;
  height: 22rpx;
  width: 22rpx;
}

.jump-streak__light--active {
  background: #ffe08a;
  box-shadow: 0 0 14rpx rgba(255, 209, 100, 0.62);
}

.jump-rhythm {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 999rpx;
  height: 22rpx;
  left: 50%;
  overflow: hidden;
  position: absolute;
  top: 42rpx;
  transform: translateX(-50%);
  width: 360rpx;
}

.jump-rhythm__zone {
  background: rgba(83, 188, 126, 0.42);
  bottom: 0;
  left: 42%;
  position: absolute;
  top: 0;
  width: 24%;
}

.jump-rhythm__perfect {
  background: rgba(255, 224, 138, 0.78);
  bottom: 0;
  left: 49%;
  position: absolute;
  top: 0;
  width: 9%;
}

.jump-rhythm__needle {
  background: #2c7c67;
  border-radius: 999rpx;
  bottom: 0;
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  width: 8rpx;
}

.jump-rope-arc {
  border-radius: 50%;
  box-sizing: border-box;
  pointer-events: none;
  position: absolute;
}

.jump-rope-arc--back {
  border: 10rpx solid rgba(111, 75, 45, 0.38);
  border-bottom-color: transparent;
  height: 330rpx;
  left: 50%;
  top: 152rpx;
  transform: translateX(-50%);
  width: 390rpx;
  z-index: 3;
}

.jump-rope-arc--front {
  border-bottom: 12rpx solid rgba(111, 75, 45, 0.72);
  bottom: 86rpx;
  height: 92rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 330rpx;
  z-index: 8;
}

.jump-rope-arc--active.jump-rope-arc--back {
  border-left-color: rgba(64, 198, 147, 0.62);
  border-right-color: rgba(64, 198, 147, 0.62);
  border-top-color: rgba(64, 198, 147, 0.62);
}

.jump-rope-arc--active.jump-rope-arc--front {
  border-bottom-color: rgba(64, 198, 147, 0.86);
  box-shadow: 0 10rpx 18rpx rgba(64, 198, 147, 0.12);
}

.jump-rope {
  height: 340rpx;
  left: 50%;
  position: absolute;
  top: 58%;
  transform-origin: center;
  width: 420rpx;
  z-index: 6;
}

.jump-rope__cord {
  background: linear-gradient(90deg, rgba(96, 60, 39, 0.96), #f0c67c 48%, rgba(96, 60, 39, 0.96));
  border-radius: 999rpx;
  box-shadow: 0 4rpx 12rpx rgba(82, 55, 32, 0.24);
  height: 12rpx;
  left: 32rpx;
  position: absolute;
  right: 32rpx;
  top: 50%;
  transform: translateY(-50%);
}

.jump-rope--window .jump-rope__cord {
  background: linear-gradient(90deg, rgba(47, 117, 95, 0.96), #ffe08a 48%, rgba(47, 117, 95, 0.96));
  box-shadow: 0 0 20rpx rgba(255, 224, 138, 0.44);
}

.jump-rope-handle {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.26), transparent 34%),
    linear-gradient(180deg, #8b5d3a, #603c27);
  border-radius: 999rpx;
  box-shadow: 0 6rpx 12rpx rgba(82, 55, 32, 0.22);
  height: 64rpx;
  position: absolute;
  top: 58%;
  width: 22rpx;
  z-index: 9;
}

.jump-rope-handle--left {
  left: calc(50% - 218rpx);
  transform: rotate(-24deg);
}

.jump-rope-handle--right {
  right: calc(50% - 218rpx);
  transform: rotate(24deg);
}

.mini-game-command {
  background: linear-gradient(135deg, #ffe08a, #f8b969);
  border-radius: 999rpx;
  bottom: 24rpx;
  box-shadow: 0 12rpx 24rpx rgba(159, 108, 52, 0.18);
  color: #4f351a;
  font-size: 28rpx;
  font-weight: 900;
  height: 88rpx;
  line-height: 88rpx;
  position: absolute;
  right: 24rpx;
  width: 210rpx;
  z-index: 30;
}

.mini-game-command[disabled] {
  opacity: 0.48;
}

.mini-game-command--jump {
  background: linear-gradient(135deg, #93e0a3, #6bcdd4);
  color: #173f38;
}

.catch-command-group {
  bottom: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  position: absolute;
  right: 24rpx;
  z-index: 30;
}

.catch-command-group .mini-game-command {
  bottom: auto;
  position: static;
  right: auto;
  width: 210rpx;
}

.mini-game-command--throw {
  background: linear-gradient(135deg, #93e0a3, #6bd4c7);
  color: #173f38;
}

.mini-game-dog {
  align-items: center;
  bottom: 44rpx;
  display: flex;
  height: 230rpx;
  justify-content: center;
  left: 50%;
  overflow: visible;
  position: absolute;
  transform: translateX(-50%);
  width: 230rpx;
  z-index: 5;
}

.mini-game-dog--bubble {
  bottom: 40rpx;
  height: 198rpx;
  width: 198rpx;
}

.mini-game-dog--jump {
  bottom: 80rpx;
  height: 210rpx;
  width: 210rpx;
}

.mini-game-dog--jump.mini-game-pet--idle {
  animation: dog-ready-bounce 1.5s ease-in-out infinite alternate;
}

.mini-game-dog--still {
  animation: none !important;
  transform: translateX(-50%) !important;
}

.mini-game-dog__touch {
  background: transparent;
  bottom: 10rpx;
  left: 16rpx;
  position: absolute;
  right: 16rpx;
  top: 10rpx;
  z-index: 12;
}

.mini-game-dog--tap-perk.mini-game-dog--tap {
  animation: catch-dog-perk 0.62s ease-out;
}

.mini-game-dog--tap-tail.mini-game-dog--tap {
  animation: catch-dog-tail 0.62s ease-out;
}

.mini-game-dog--tap-bow.mini-game-dog--tap {
  animation: catch-dog-bow 0.68s ease-out;
}

.mini-game-dog--catch.mini-game-pet--fetching {
  animation: pet-fetch 0.88s ease-in-out infinite alternate;
}

.mini-game-dog--catch.mini-game-pet--returning {
  animation: pet-return 0.8s ease-in-out infinite alternate;
}

.mini-game-dog.mini-game-pet--watching {
  animation: dog-watch 1.2s ease-in-out infinite alternate;
}

.mini-game-dog.mini-game-pet--popping {
  animation: pet-hop 0.26s ease-out;
}

.mini-game-dog.mini-game-pet--jumping {
  animation: pet-jump 0.38s ease-out;
}

.mini-game-dog.mini-game-pet--fallen {
  animation: pet-fall 0.72s ease-in-out forwards;
}

.mini-game-pet {
  bottom: 62rpx;
  height: 156rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 156rpx;
  z-index: 5;
}

.mini-game-pet__tail {
  background: linear-gradient(180deg, #f1c477, #dca65e);
  border-radius: 999rpx;
  height: 82rpx;
  position: absolute;
  right: 4rpx;
  top: 50rpx;
  transform: rotate(38deg);
  width: 24rpx;
}

.mini-game-pet__body {
  background: linear-gradient(180deg, #fff9e8 0%, #ffe0a5 100%);
  border-radius: 46% 46% 38% 38%;
  bottom: 0;
  box-shadow: inset 0 -6rpx 0 rgba(214, 151, 74, 0.1);
  height: 104rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 116rpx;
}

.mini-game-pet__head {
  background: linear-gradient(180deg, #fffdf0 0%, #ffe7b3 100%);
  border-radius: 45% 45% 42% 42%;
  height: 92rpx;
  left: 50%;
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  width: 100rpx;
}

.mini-game-pet__ear {
  background: linear-gradient(180deg, #ffeabb, #f3bd73);
  border-radius: 26rpx 26rpx 8rpx 8rpx;
  height: 36rpx;
  position: absolute;
  top: -14rpx;
  width: 24rpx;
}

.mini-game-pet__ear--left {
  left: 18rpx;
  transform: rotate(-12deg);
}

.mini-game-pet__ear--right {
  right: 18rpx;
  transform: rotate(12deg);
}

.mini-game-pet__eye {
  background: #59493c;
  border-radius: 999rpx;
  height: 12rpx;
  position: absolute;
  top: 38rpx;
  width: 9rpx;
}

.mini-game-pet__eye--left {
  left: 30rpx;
}

.mini-game-pet__eye--right {
  right: 30rpx;
}

.mini-game-pet__nose {
  background: #f49b7b;
  border-radius: 999rpx;
  height: 12rpx;
  left: 50%;
  position: absolute;
  top: 52rpx;
  transform: translateX(-50%);
  width: 14rpx;
}

.mini-game-pet__mouth {
  border-bottom: 4rpx solid #8f6950;
  border-radius: 0 0 24rpx 24rpx;
  height: 14rpx;
  left: 50%;
  position: absolute;
  top: 62rpx;
  transform: translateX(-50%);
  width: 26rpx;
}

.mini-game-pet--catch.mini-game-pet--fetching {
  animation: pet-fetch 0.88s ease-in-out infinite alternate;
}

.mini-game-pet--catch.mini-game-pet--returning {
  animation: pet-return 0.8s ease-in-out infinite alternate;
}

.mini-game-pet--hardware-enter {
  animation: pet-hardware-enter 0.95s ease-in-out forwards;
}

.mini-game-pet--watching .mini-game-pet__head {
  animation: pet-look-up 1.2s ease-in-out infinite alternate;
}

.mini-game-pet--popping {
  animation: pet-hop 0.26s ease-out;
}

.mini-game-pet--jumping {
  animation: pet-jump 0.38s ease-out;
}

.mini-game-pet--fallen {
  animation: pet-fall 0.72s ease-in-out forwards;
}

.hide-sky-glow {
  background: radial-gradient(circle, rgba(255, 250, 198, 0.82), rgba(255, 250, 198, 0));
  border-radius: 50%;
  height: 180rpx;
  position: absolute;
  right: 36rpx;
  top: 22rpx;
  width: 180rpx;
}

.hide-cloud {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 999rpx;
  height: 30rpx;
  position: absolute;
  width: 118rpx;
  z-index: 1;
}

.hide-cloud::before,
.hide-cloud::after {
  background: inherit;
  border-radius: 50%;
  content: '';
  position: absolute;
}

.hide-cloud::before {
  height: 46rpx;
  left: 18rpx;
  top: -18rpx;
  width: 46rpx;
}

.hide-cloud::after {
  height: 38rpx;
  right: 18rpx;
  top: -12rpx;
  width: 38rpx;
}

.hide-cloud--one {
  left: 28rpx;
  top: 82rpx;
}

.hide-cloud--two {
  opacity: 0.72;
  right: 130rpx;
  top: 62rpx;
  transform: scale(0.78);
}

.hide-grove {
  background:
    radial-gradient(circle at 28% 48%, #75c56d 0, #75c56d 42rpx, transparent 43rpx),
    radial-gradient(circle at 58% 36%, #67b95f 0, #67b95f 56rpx, transparent 57rpx),
    radial-gradient(circle at 78% 58%, #569f55 0, #569f55 44rpx, transparent 45rpx);
  bottom: 112rpx;
  height: 130rpx;
  opacity: 0.52;
  position: absolute;
  width: 190rpx;
  z-index: 1;
}

.hide-grove--left {
  left: -44rpx;
}

.hide-grove--right {
  right: -34rpx;
  transform: scale(1.08);
}

.hide-path {
  background: linear-gradient(180deg, rgba(255, 230, 166, 0.74), rgba(157, 115, 70, 0.32));
  border-radius: 50% 50% 0 0;
  bottom: -72rpx;
  height: 250rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 360rpx;
}

.hide-fence {
  background:
    repeating-linear-gradient(90deg, rgba(117, 84, 54, 0.54) 0, rgba(117, 84, 54, 0.54) 13rpx, transparent 13rpx, transparent 54rpx),
    linear-gradient(180deg, transparent 0, transparent 22rpx, rgba(117, 84, 54, 0.42) 22rpx, rgba(117, 84, 54, 0.42) 34rpx, transparent 34rpx);
  bottom: 132rpx;
  height: 78rpx;
  left: 0;
  opacity: 0.42;
  position: absolute;
  right: 0;
}

.hide-flower-patch {
  background:
    radial-gradient(circle at 18% 56%, #ffd86b 0, #ffd86b 9rpx, transparent 10rpx),
    radial-gradient(circle at 46% 42%, #ff9fb1 0, #ff9fb1 8rpx, transparent 9rpx),
    radial-gradient(circle at 74% 58%, #8bd8ff 0, #8bd8ff 8rpx, transparent 9rpx);
  bottom: 92rpx;
  height: 52rpx;
  position: absolute;
  width: 120rpx;
  z-index: 2;
}

.hide-flower-patch--left {
  left: 22rpx;
}

.hide-flower-patch--right {
  right: 26rpx;
}

.hide-sign {
  background: linear-gradient(180deg, #9b6a3e, #6f4b2e);
  border-radius: 8rpx;
  bottom: 92rpx;
  height: 72rpx;
  left: 42%;
  position: absolute;
  width: 14rpx;
  z-index: 2;
}

.hide-sign::before {
  background: linear-gradient(135deg, #fff0ca, #ffd68e);
  border: 3rpx solid rgba(108, 75, 42, 0.24);
  border-radius: 12rpx;
  color: #6d5138;
  content: '?';
  font-size: 30rpx;
  font-weight: 900;
  height: 48rpx;
  left: 50%;
  line-height: 48rpx;
  position: absolute;
  text-align: center;
  top: -46rpx;
  transform: translateX(-50%) rotate(-4deg);
  width: 62rpx;
}

.hide-lamp {
  background: linear-gradient(180deg, #6d5138, #443424);
  border-radius: 999rpx;
  bottom: 130rpx;
  height: 132rpx;
  position: absolute;
  width: 12rpx;
}

.hide-lamp::before {
  background: radial-gradient(circle, #fff4ad 0, #ffd668 44%, rgba(255, 214, 104, 0.18) 72%);
  border-radius: 50%;
  content: '';
  height: 48rpx;
  left: 50%;
  position: absolute;
  top: -36rpx;
  transform: translateX(-50%);
  width: 48rpx;
}

.hide-lamp--left {
  left: 42rpx;
}

.hide-lamp--right {
  right: 52rpx;
  transform: scale(0.86);
}

.hide-clue-card {
  background: rgba(255, 253, 248, 0.9);
  border: 2rpx solid rgba(95, 199, 168, 0.18);
  border-radius: 18rpx;
  box-shadow: 0 10rpx 22rpx rgba(67, 104, 82, 0.12);
  color: #365f56;
  font-size: 21rpx;
  font-weight: 800;
  left: 18rpx;
  line-height: 1.38;
  max-height: 86rpx;
  overflow: hidden;
  padding: 12rpx 14rpx;
  position: absolute;
  top: 18rpx;
  width: 330rpx;
  z-index: 12;
}

.hide-scene-picker {
  display: flex;
  gap: 8rpx;
  position: absolute;
  right: 18rpx;
  top: 18rpx;
  z-index: 13;
}

.hide-scene-picker__button {
  background: rgba(255, 253, 248, 0.82);
  border: 2rpx solid rgba(95, 199, 168, 0.18);
  border-radius: 999rpx;
  color: #557063;
  font-size: 20rpx;
  font-weight: 900;
  height: 48rpx;
  line-height: 48rpx;
  margin: 0;
  padding: 0 16rpx;
}

.hide-scene-picker__button::after {
  border: none;
}

.hide-scene-picker__button--active {
  background: linear-gradient(135deg, #ffe08a, #8adfb0);
  color: #173f38;
}

.hide-scene-picker__button[disabled] {
  opacity: 0.68;
}

.hide-firefly {
  animation: firefly-drift 3s ease-in-out infinite alternate;
  background: #fff2a2;
  border-radius: 50%;
  box-shadow: 0 0 18rpx rgba(255, 232, 120, 0.8);
  height: 10rpx;
  position: absolute;
  width: 10rpx;
}

.hide-firefly--one {
  left: 18%;
  top: 34%;
}

.hide-firefly--two {
  animation-delay: -0.8s;
  left: 66%;
  top: 28%;
}

.hide-firefly--three {
  animation-delay: -1.5s;
  left: 78%;
  top: 58%;
}

.hide-spot {
  background: transparent;
  height: 170rpx;
  overflow: visible;
  position: absolute;
  transform: translate(-50%, -50%);
  width: 174rpx;
  z-index: 7;
}

.hide-spot__prop {
  height: 122rpx;
  left: 50%;
  position: absolute;
  top: 12rpx;
  transform: translateX(-50%);
  width: 150rpx;
  z-index: 2;
}

.hide-spot__prop::before,
.hide-spot__prop::after {
  content: '';
  position: absolute;
}

.hide-spot--bench .hide-spot__prop {
  background:
    linear-gradient(180deg, #b77743 0, #b77743 22rpx, transparent 22rpx),
    linear-gradient(180deg, transparent 44rpx, #835936 44rpx, #835936 68rpx, transparent 68rpx);
  border-radius: 14rpx 14rpx 8rpx 8rpx;
}

.hide-spot--bench .hide-spot__prop::before,
.hide-spot--bench .hide-spot__prop::after {
  background: #6d4730;
  border-radius: 999rpx;
  bottom: 0;
  height: 64rpx;
  width: 12rpx;
}

.hide-spot--bench .hide-spot__prop::before {
  left: 24rpx;
}

.hide-spot--bench .hide-spot__prop::after {
  right: 24rpx;
}

.hide-spot--shrub .hide-spot__prop {
  background:
    radial-gradient(circle at 24% 58%, #4fa95b 0, #4fa95b 46rpx, transparent 47rpx),
    radial-gradient(circle at 52% 40%, #79ce74 0, #79ce74 60rpx, transparent 61rpx),
    radial-gradient(circle at 78% 62%, #56b15e 0, #56b15e 44rpx, transparent 45rpx),
    radial-gradient(ellipse at 50% 92%, rgba(64, 90, 47, 0.26) 0, rgba(64, 90, 47, 0.26) 68rpx, transparent 69rpx);
}

.hide-spot--shrub .hide-spot__prop::before {
  background:
    radial-gradient(circle, #e8f7a0 0, #e8f7a0 5rpx, transparent 6rpx),
    radial-gradient(circle at 78% 42%, #fff1b8 0, #fff1b8 4rpx, transparent 5rpx);
  height: 60rpx;
  left: 34rpx;
  top: 22rpx;
  width: 86rpx;
}

.hide-spot--box .hide-spot__prop {
  background:
    linear-gradient(90deg, transparent 0, transparent 48%, rgba(92, 56, 32, 0.2) 48%, rgba(92, 56, 32, 0.2) 53%, transparent 53%),
    linear-gradient(135deg, #d5a165, #a66a38);
  border-radius: 12rpx;
  box-shadow: inset 0 0 0 5rpx rgba(97, 58, 30, 0.12), 0 10rpx 16rpx rgba(92, 56, 32, 0.16);
}

.hide-spot--box .hide-spot__prop::before {
  background: linear-gradient(135deg, #e1b47a, #b8753f);
  border-radius: 12rpx 12rpx 0 0;
  height: 30rpx;
  left: -6rpx;
  right: -6rpx;
  top: -20rpx;
  transform: rotate(-1deg);
}

.hide-spot--box .hide-spot__prop::after {
  border-bottom: 4rpx solid rgba(92, 56, 32, 0.24);
  border-top: 4rpx solid rgba(255, 255, 255, 0.18);
  height: 18rpx;
  left: 16rpx;
  right: 16rpx;
  top: 48rpx;
}

.hide-spot--curtain .hide-spot__prop {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.38), transparent 28%),
    repeating-linear-gradient(90deg, #65aada 0, #65aada 18rpx, #a6d9ef 18rpx, #a6d9ef 34rpx);
  border-radius: 20rpx 20rpx 12rpx 12rpx;
  box-shadow: 0 10rpx 18rpx rgba(69, 121, 157, 0.18);
}

.hide-spot--curtain .hide-spot__prop::before {
  background: #5f7f92;
  border-radius: 999rpx;
  height: 10rpx;
  left: -12rpx;
  right: -12rpx;
  top: -10rpx;
}

.hide-spot--curtain .hide-spot__prop::after {
  background:
    radial-gradient(circle at 24% 50%, rgba(255, 255, 255, 0.62) 0, rgba(255, 255, 255, 0.62) 5rpx, transparent 6rpx),
    radial-gradient(circle at 68% 50%, rgba(255, 255, 255, 0.62) 0, rgba(255, 255, 255, 0.62) 5rpx, transparent 6rpx);
  bottom: 10rpx;
  height: 20rpx;
  left: 0;
  right: 0;
}

.hide-spot--mailbox .hide-spot__prop {
  background:
    linear-gradient(180deg, #ffdf7f 0, #ffb85c 58%, #d47a40 58%),
    linear-gradient(180deg, transparent 0, transparent 68rpx, #7b5a3b 68rpx);
  border-radius: 34rpx 34rpx 10rpx 10rpx;
  box-shadow: inset 0 -8rpx rgba(119, 72, 38, 0.12), 0 10rpx 16rpx rgba(116, 71, 41, 0.14);
}

.hide-spot--mailbox .hide-spot__prop::before {
  background: rgba(255, 255, 255, 0.74);
  border-radius: 8rpx;
  height: 24rpx;
  left: 24rpx;
  top: 44rpx;
  width: 56rpx;
}

.hide-spot--mailbox .hide-spot__prop::after {
  background: #7b5a3b;
  border-radius: 999rpx;
  bottom: -22rpx;
  height: 42rpx;
  left: 68rpx;
  width: 14rpx;
}

.hide-spot--basket .hide-spot__prop {
  background:
    repeating-linear-gradient(90deg, rgba(120, 78, 45, 0.3) 0, rgba(120, 78, 45, 0.3) 8rpx, transparent 8rpx, transparent 18rpx),
    linear-gradient(180deg, #e2b274, #b87442);
  border-radius: 18rpx 18rpx 28rpx 28rpx;
  box-shadow: inset 0 -8rpx rgba(92, 56, 32, 0.12), 0 10rpx 16rpx rgba(92, 56, 32, 0.12);
}

.hide-spot--basket .hide-spot__prop::before {
  border: 8rpx solid #8c5a34;
  border-bottom: 0;
  border-radius: 80rpx 80rpx 0 0;
  height: 48rpx;
  left: 30rpx;
  top: -32rpx;
  width: 74rpx;
}

.hide-spot--basket .hide-spot__prop::after {
  background:
    radial-gradient(circle at 28% 44%, #fff4a6 0, #fff4a6 12rpx, transparent 13rpx),
    radial-gradient(circle at 62% 50%, #ff9fb1 0, #ff9fb1 11rpx, transparent 12rpx);
  height: 52rpx;
  left: 28rpx;
  top: 18rpx;
  width: 86rpx;
}

.hide-spot--tent .hide-spot__prop {
  background:
    linear-gradient(115deg, transparent 0, transparent 46%, rgba(89, 67, 48, 0.28) 47%, rgba(89, 67, 48, 0.28) 53%, transparent 54%),
    linear-gradient(135deg, #ffe08a 0 50%, #f07f6f 50% 100%);
  border-radius: 70rpx 70rpx 12rpx 12rpx;
  height: 132rpx;
  top: -4rpx;
}

.hide-spot--tent .hide-spot__prop::before {
  background: rgba(88, 61, 42, 0.28);
  bottom: 0;
  height: 54rpx;
  left: 62rpx;
  width: 28rpx;
}

.hide-spot--log .hide-spot__prop {
  background:
    radial-gradient(circle at 14% 50%, #f5c788 0, #f5c788 28rpx, #865532 29rpx, #865532 34rpx, transparent 35rpx),
    linear-gradient(90deg, #a9693a, #d18b4d 52%, #8a542f);
  border-radius: 999rpx;
  box-shadow: inset 0 -8rpx rgba(84, 50, 28, 0.16), 0 10rpx 16rpx rgba(84, 50, 28, 0.12);
  height: 86rpx;
  top: 42rpx;
}

.hide-spot--log .hide-spot__prop::before,
.hide-spot--log .hide-spot__prop::after {
  background: rgba(95, 58, 32, 0.36);
  border-radius: 999rpx;
  height: 8rpx;
  left: 54rpx;
  right: 18rpx;
}

.hide-spot--log .hide-spot__prop::before {
  top: 26rpx;
}

.hide-spot--log .hide-spot__prop::after {
  top: 50rpx;
}

.hide-spot--flower .hide-spot__prop {
  background:
    radial-gradient(circle at 24% 62%, #ff9fb1 0, #ff9fb1 20rpx, transparent 21rpx),
    radial-gradient(circle at 48% 42%, #ffe08a 0, #ffe08a 24rpx, transparent 25rpx),
    radial-gradient(circle at 72% 62%, #a8dd70 0, #a8dd70 22rpx, transparent 23rpx),
    radial-gradient(ellipse at 50% 92%, rgba(57, 120, 64, 0.26) 0, rgba(57, 120, 64, 0.26) 62rpx, transparent 63rpx);
}

.hide-spot--flower .hide-spot__prop::before {
  background:
    linear-gradient(180deg, #5fa35f, #4a8f53),
    linear-gradient(180deg, #5fa35f, #4a8f53);
  border-radius: 999rpx;
  height: 52rpx;
  left: 68rpx;
  top: 56rpx;
  width: 10rpx;
}

.hide-spot--checked .hide-spot__prop {
  filter: grayscale(0.32);
  opacity: 0.62;
}

.hide-spot--checked::before {
  background: rgba(255, 255, 255, 0.88);
  border-radius: 50%;
  color: #8a7a68;
  content: '×';
  font-size: 28rpx;
  font-weight: 900;
  height: 38rpx;
  left: 20rpx;
  line-height: 38rpx;
  position: absolute;
  top: 8rpx;
  width: 38rpx;
  z-index: 5;
}

.hide-spot--found .hide-spot__prop {
  animation: hide-found-pop 0.72s ease-in-out infinite alternate;
  filter: none;
  opacity: 1;
}

.hide-spot__label {
  background: rgba(255, 255, 255, 0.86);
  border-radius: 999rpx;
  bottom: 2rpx;
  box-shadow: 0 6rpx 14rpx rgba(67, 104, 82, 0.1);
  color: #365f56;
  font-size: 22rpx;
  font-weight: 800;
  left: 50%;
  line-height: 42rpx;
  min-width: 112rpx;
  position: absolute;
  transform: translateX(-50%);
  z-index: 4;
}

.mini-game-peek-pet {
  align-items: flex-start;
  display: flex;
  height: 96rpx;
  justify-content: center;
  left: 50%;
  overflow: visible;
  pointer-events: none;
  position: absolute;
  top: -20rpx;
  transform: translateX(-50%);
  width: 96rpx;
  z-index: 5;
}

.mini-game-peek-pet--stage {
  height: 112rpx;
  top: 0;
  width: 112rpx;
  z-index: 10;
}

.mini-game-peek-pet__ear {
  background: #f3bf74;
  border-radius: 16rpx 16rpx 6rpx 6rpx;
  height: 26rpx;
  position: absolute;
  top: -10rpx;
  width: 18rpx;
}

.mini-game-peek-pet__ear--left {
  left: 14rpx;
  transform: rotate(-10deg);
}

.mini-game-peek-pet__ear--right {
  right: 14rpx;
  transform: rotate(10deg);
}

.mini-game-peek-pet__eye {
  background: #59493c;
  border-radius: 999rpx;
  height: 9rpx;
  position: absolute;
  top: 30rpx;
  width: 7rpx;
}

.mini-game-peek-pet__eye--left {
  left: 24rpx;
}

.mini-game-peek-pet__eye--right {
  right: 24rpx;
}

.mini-game-summary {
  color: #5f6f64;
  font-size: 25rpx;
  line-height: 1.5;
  margin-top: 14rpx;
  min-height: 76rpx;
}

.mini-game-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 14rpx;
}

.mini-game-actions__primary,
.mini-game-actions__ghost {
  border-radius: 999rpx;
  flex: 1;
  font-size: 27rpx;
  font-weight: 900;
  height: 78rpx;
  line-height: 78rpx;
}

.mini-game-actions__primary {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  color: #173f38;
}

.mini-game-actions__primary--paused {
  background: linear-gradient(135deg, #ffe08a, #f8b969);
  color: #4f351a;
}

.mini-game-actions__ghost {
  background: rgba(255, 255, 255, 0.78);
  color: #68786f;
}

.catch-rules-layer {
  bottom: 0;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 9999;
}

.catch-rules-layer__mask {
  background: rgba(22, 39, 43, 0.32);
  bottom: 0;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.catch-rules-card {
  background: linear-gradient(180deg, #fffdf8 0%, #eefbf2 100%);
  border: 2rpx solid rgba(67, 138, 111, 0.18);
  border-radius: 24rpx;
  box-shadow: 0 24rpx 48rpx rgba(32, 66, 58, 0.2);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  left: 32rpx;
  max-height: calc(100vh - 160rpx);
  overflow: hidden;
  padding: 28rpx 26rpx;
  position: absolute;
  right: 32rpx;
  top: calc(72rpx + env(safe-area-inset-top));
}

.catch-rules-card__title {
  color: #253047;
  flex: 0 0 auto;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 42rpx;
}

.catch-rules-card__list {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 10rpx;
  overflow: visible;
}

.catch-rules-card__item {
  background: rgba(255, 255, 255, 0.76);
  border-radius: 14rpx;
  color: #50645b;
  font-size: 24rpx;
  line-height: 34rpx;
  min-height: 0;
  padding: 12rpx 14rpx 12rpx 58rpx;
  position: relative;
  white-space: normal;
}

.catch-rules-card__index {
  color: #2f755f;
  font-size: 24rpx;
  font-weight: 900;
  left: 18rpx;
  position: absolute;
  top: 12rpx;
  width: 36rpx;
}

.catch-rules-card__text {
  color: #50645b;
  white-space: normal;
  word-break: break-word;
}

.catch-rules-card__hardware {
  background: rgba(31, 49, 59, 0.9);
  border-radius: 16rpx;
  box-sizing: border-box;
  color: rgba(246, 251, 255, 0.78);
  flex: 0 0 auto;
  font-size: 23rpx;
  line-height: 1.45;
  padding: 16rpx;
}

.catch-rules-card__hardware-name {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 900;
}

.catch-rules-card__button {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  border-radius: 999rpx;
  box-sizing: border-box;
  color: #173f38;
  flex: 0 0 auto;
  font-size: 28rpx;
  font-weight: 900;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  width: auto;
}

@keyframes portal-pulse {
  from {
    transform: scale(0.94);
  }
  to {
    transform: scale(1.04);
  }
}

@keyframes ball-throw {
  0% {
    left: 44%;
    top: 60%;
  }
  100% {
    left: 72%;
    top: 42%;
  }
}

@keyframes ball-return {
  0% {
    left: 72%;
    top: 62%;
  }
  100% {
    left: 48%;
    top: 62%;
  }
}

@keyframes pet-fetch {
  from {
    transform: translateX(-70%);
  }
  to {
    transform: translateX(62%);
  }
}

@keyframes pet-return {
  from {
    transform: translateX(48%) scaleX(-1);
  }
  to {
    transform: translateX(-50%) scaleX(-1);
  }
}

@keyframes catch-dog-perk {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  45% {
    transform: translateX(-50%) translateY(-16rpx) rotate(-2deg);
  }
}

@keyframes catch-dog-tail {
  0%,
  100% {
    transform: translateX(-50%) scale(1);
  }
  45% {
    transform: translateX(-50%) scale(1.06);
  }
}

@keyframes catch-dog-bow {
  0%,
  100% {
    transform: translateX(-50%) rotate(0);
  }
  42% {
    transform: translateX(-50%) translateY(10rpx) rotate(3deg);
  }
}

@keyframes pet-hardware-enter {
  0% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
  70% {
    opacity: 0.78;
    transform: translateX(112%) scale(0.74);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

@keyframes pet-look-up {
  from {
    transform: translateX(-50%) rotate(-3deg);
  }
  to {
    transform: translateX(-50%) rotate(4deg);
  }
}

@keyframes dog-watch {
  from {
    transform: translateX(-50%) translateY(0);
  }
  to {
    transform: translateX(-50%) translateY(-12rpx);
  }
}

@keyframes dog-ready-bounce {
  from {
    transform: translateX(-50%) translateY(0);
  }
  to {
    transform: translateX(-50%) translateY(-8rpx);
  }
}

@keyframes pet-hop {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-24rpx);
  }
}

@keyframes pet-jump {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-74rpx);
  }
}

@keyframes bath-drop {
  0% {
    opacity: 0;
    transform: translateY(-8rpx);
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(46rpx);
  }
}

@keyframes bubble-pop-rise {
  0% {
    opacity: 0;
    transform: translate(-50%, 16rpx) scale(0.82);
  }
  28% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -42rpx) scale(1.08);
  }
}

@keyframes firefly-drift {
  from {
    opacity: 0.5;
    transform: translate(0, 0);
  }
  to {
    opacity: 1;
    transform: translate(28rpx, -18rpx);
  }
}

@keyframes hide-found-pop {
  from {
    transform: translateX(-50%) scale(1);
  }
  to {
    transform: translateX(-50%) scale(1.08);
  }
}

@keyframes pet-fall {
  0% {
    transform: translateX(-50%) rotate(0);
  }
  100% {
    transform: translateX(-50%) rotate(82deg);
  }
}
</style>
