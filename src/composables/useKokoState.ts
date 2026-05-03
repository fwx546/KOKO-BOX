import { computed, ref } from 'vue'
import { watch } from 'vue'
import type {
  AppMetrics,
  CareActionKey,
  CareActionResult,
  ChatMessage,
  CoinLog,
  CompanionEconomy,
  CourseSchedule,
  DailySnapshot,
  DeviceStatus,
  EconomyRewardSource,
  EmotionTag,
  FacingDirection,
  HardwareInputEvent,
  MiniGameResult,
  Pet,
  PetArchive,
  PetQuickReply,
  PetStage,
  RewardType,
  ShopItem,
  ShopItemId,
  SyncEvent,
  SyncStatus,
  Task,
  TaskCategory,
  TaskPriority,
  TaskRepeatType,
  TaskStatus,
  UserSettings,
} from '../types/koko'
import {
  clearPetChatHistoryFromCloud,
  createPetChatReply,
  createPetQuickReply,
  defaultPetPersonaPrompt,
  loadPetChatHistoryFromCloud,
  sendPetVoiceTurn,
  type PetDialogueHistoryMessage,
} from '../services/petDialogue'
import {
  clearCourseScheduleFromCloud,
  loadCourseScheduleFromCloud,
  saveCourseScheduleToCloud,
} from '../services/courseScheduleCloud'
import {
  loadTasksFromCloud,
  saveTasksToCloud,
} from '../services/taskCloud'
import {
  loadCompanionFromCloud,
  normalizeCompanionEconomy,
  saveCompanionToCloud,
} from '../services/companionCloud'
import { useAuth } from './useAuth'
import { copy } from '../i18n'
import { miniGameDefinitions } from '../config/miniGames'

const STORAGE_KEY = 'koko-box-mini-state-v1'
const CHAT_SESSION_ID = 'main-session'
const MAX_CHAT_HISTORY = 100
const FEED_DIGEST_MS = 30 * 60 * 1000
const PET_ROTATION_FRAMES = 16
const PET_PERSONA_PROMPT_VERSION = 4

const nowIso = () => new Date().toISOString()
const { authMode, isMockSession } = useAuth()
const shortTime = () =>
  new Date().toLocaleTimeString(settings.value.language === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
const hasUniStorage = () => typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function'
const normalizeRotationFrame = (value?: number) => {
  const frame = Math.round(value ?? 0)
  return ((frame % PET_ROTATION_FRAMES) + PET_ROTATION_FRAMES) % PET_ROTATION_FRAMES
}
const directionByFrame: FacingDirection[] = [
  'front',
  'front-right',
  'right',
  'back-right',
  'back',
  'back-left',
  'left',
  'front-left',
]
const deriveFacingDirection = (frame: number): FacingDirection => directionByFrame[Math.round(frame / 2) % directionByFrame.length]

const formatDuration = (ms: number) => {
  const safe = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const defaultSettings = (): UserSettings => ({
  language: 'en',
  hideChats: false,
  allowChatClear: true,
  allowCrossDeviceSummary: true,
  lowDisturbanceMode: false,
  demoMode: true,
})

const defaultPet = (): Pet => ({
  id: 'pet-koko',
  name: 'Koko',
  species: 'cat',
  stage: 'growing',
  state: 'normal',
  health: 84,
  mood: 78,
  hunger: 72,
  energy: 69,
  intimacy: 58,
  clean: 85,
  lastFedAt: undefined,
  digestingUntil: undefined,
  activeMiniGame: null,
  homeSceneMood: 'meadow',
  rotationFrame: 0,
  facingDirection: 'front',
  updatedAt: nowIso(),
})

const defaultTasks = (): Task[] => [
  {
    id: 'task-morning',
    title: 'Morning check-in and hydration',
    category: 'health',
    time: '08:30',
    repeatType: 'daily',
    status: 'pending',
    rewardType: 'mood',
    createdAt: nowIso(),
  },
  {
    id: 'task-focus',
    title: 'Complete a 25-minute focus task',
    category: 'study',
    time: '14:00',
    repeatType: 'daily',
    status: 'pending',
    rewardType: 'bond',
    createdAt: nowIso(),
  },
  {
    id: 'task-winddown',
    title: 'Evening review and wind-down',
    category: 'life',
    time: '21:30',
    repeatType: 'daily',
    status: 'delayed',
    rewardType: 'snack',
    createdAt: nowIso(),
  },
]

const defaultMessages = (): ChatMessage[] => [
  {
    id: createId('msg'),
    sessionId: CHAT_SESSION_ID,
    role: 'assistant',
    content: copy.en.home.assistantFallback,
    emotionTag: 'happy',
    encrypted: false,
    createdAt: nowIso(),
  },
]

const defaultDevices = (): DeviceStatus[] => [
  {
    deviceId: 'device-miniapp',
    deviceType: 'miniapp',
    online: true,
    battery: 100,
    charging: false,
    lastSyncAt: nowIso(),
    terminalRole: 'Primary terminal',
  },
  {
    deviceId: 'device-desktop',
    deviceType: 'desktop',
    online: true,
    battery: 88,
    charging: true,
    lastSyncAt: nowIso(),
    terminalRole: 'Desktop display',
  },
  {
    deviceId: 'device-m5',
    deviceType: 'm5',
    online: false,
    battery: 36,
    charging: false,
    lastSyncAt: nowIso(),
    terminalRole: 'Hardware link',
  },
]

const defaultSyncEvents = (): SyncEvent[] => [
  {
    id: createId('sync'),
    source: 'miniapp',
    target: 'desktop',
    actionType: 'status',
    summary: 'Home status synced to the desktop display.',
    timestamp: nowIso(),
    status: 'success',
  },
  {
    id: createId('sync'),
    source: 'm5',
    target: 'miniapp',
    actionType: 'hardware',
    summary: 'M5StickS3 is offline and waiting to reconnect.',
    timestamp: nowIso(),
    status: 'offline',
  },
]

const defaultArchive = (): PetArchive => ({
  adoptedAt: '2026-04-16 20:30',
  stageHistory: [
    { stage: 'egg', timestamp: '2026-04-16 20:30' },
    { stage: 'baby', timestamp: '2026-04-17 09:00' },
    { stage: 'growing', timestamp: '2026-04-20 10:00' },
  ],
  milestones: [
    {
      id: createId('mile'),
      title: 'First stable companion week',
      description: 'Care and plans stayed consistent, and the mood curve became steadier.',
      timestamp: '2026-04-20 21:00',
    },
    {
      id: createId('mile'),
      title: 'First synced reminder',
      description: 'The mini program reminder was written to the linkage log.',
      timestamp: '2026-04-21 14:00',
    },
  ],
  medicalLogs: [
    {
      id: createId('med'),
      note: 'Slight tiredness recovered through rest and food.',
      timestamp: '2026-04-21 22:10',
    },
  ],
})

const defaultSnapshots = (): DailySnapshot[] => [
  { id: 'snap-1', label: 'Mon', mood: 72, intimacy: 50, completionRate: 67, interactions: 5 },
  { id: 'snap-2', label: 'Tue', mood: 75, intimacy: 53, completionRate: 74, interactions: 6 },
  { id: 'snap-3', label: 'Wed', mood: 78, intimacy: 57, completionRate: 81, interactions: 8 },
  { id: 'snap-4', label: 'Thu', mood: 80, intimacy: 60, completionRate: 78, interactions: 7 },
  { id: 'snap-5', label: 'Today', mood: 78, intimacy: 58, completionRate: 60, interactions: 4 },
]

const defaultMetrics = (): AppMetrics => ({
  interactions: 12,
  completedTasks: 4,
  companionMinutes: 48,
  coins: 0,
})

const defaultEconomy = (coins = 0): CompanionEconomy => ({
  coins,
  inventory: {},
  purchaseHistory: [],
  rewardLedger: {},
  coinLogs: [],
  dailyChatRewards: {},
  starterResourcesGranted: false,
  updatedAt: nowIso(),
})

const starterResources = {
  meal: 3,
  water: 3,
  'clean-kit': 3,
}

const shopItems: ShopItem[] = [
  {
    id: 'meal',
    name: 'Meal',
    description: 'A filling meal resource for home feeding.',
    price: 8,
    resourceKey: 'meal',
  },
  {
    id: 'water',
    name: 'Water',
    description: 'A fresh water resource for home hydration.',
    price: 5,
    resourceKey: 'water',
  },
  {
    id: 'clean-kit',
    name: 'Clean Kit',
    description: 'A clean care resource for home grooming.',
    price: 12,
    resourceKey: 'clean-kit',
  },
]

interface PersistedState {
  pet: Pet
  tasks: Task[]
  taskCollectionUpdatedAt?: string
  courseSchedule?: CourseSchedule | null
  messages: ChatMessage[]
  devices: DeviceStatus[]
  syncEvents: SyncEvent[]
  settings: UserSettings
  archive: PetArchive
  snapshots: DailySnapshot[]
  metrics: AppMetrics
  economy?: CompanionEconomy
  petPersonaPrompt?: string
  petPersonaPromptVersion?: number
}

const pet = ref<Pet>(defaultPet())
const tasks = ref<Task[]>(defaultTasks())
const taskCollectionUpdatedAt = ref('')
const courseSchedule = ref<CourseSchedule | null>(null)
const messages = ref<ChatMessage[]>(defaultMessages())
const devices = ref<DeviceStatus[]>(defaultDevices())
const syncEvents = ref<SyncEvent[]>(defaultSyncEvents())
const settings = ref<UserSettings>(defaultSettings())
const archive = ref<PetArchive>(defaultArchive())
const snapshots = ref<DailySnapshot[]>(defaultSnapshots())
const metrics = ref<AppMetrics>(defaultMetrics())
const economy = ref<CompanionEconomy>(defaultEconomy())
const petPersonaPrompt = ref(defaultPetPersonaPrompt)
const hydrated = ref(false)
const cloudHistoryHydrated = ref(false)
const cloudHistoryHydrating = ref(false)
const cloudTasksHydrated = ref(false)
const cloudTasksHydrating = ref(false)
const cloudCourseScheduleHydrated = ref(false)
const cloudCourseScheduleHydrating = ref(false)
const cloudEconomyHydrated = ref(false)
const cloudEconomyHydrating = ref(false)

const shouldUseCloudSync = () => authMode.value === 'wechat' && !isMockSession.value

const deriveStage = (value: number): PetStage => {
  if (value >= 85) return 'adult'
  if (value >= 55) return 'growing'
  if (value >= 25) return 'baby'
  return 'egg'
}

const deriveState = (currentPet: Pet): Pet['state'] => {
  if (currentPet.health <= 35) return 'sick'
  if (currentPet.hunger <= 30) return 'hungry'
  if (currentPet.energy <= 30) return 'tired'
  if (currentPet.mood <= 35) return 'low'
  return currentPet.state === 'resting' && currentPet.energy >= 70 ? 'normal' : currentPet.state
}

const getDigestStatus = (currentPet = pet.value, nowMs = Date.now()) => {
  const untilMs = currentPet.digestingUntil ? new Date(currentPet.digestingUntil).getTime() : 0
  const remainingMs = untilMs > nowMs ? untilMs - nowMs : 0

  return {
    isDigesting: remainingMs > 0,
    canFeedMeal: remainingMs <= 0,
    remainingMs,
    digestCountdownLabel: remainingMs > 0 ? formatDuration(remainingMs) : '00:00',
  }
}

const sanitizePet = (value?: Partial<Pet>): Pet => {
  const merged = {
    ...defaultPet(),
    ...(value ?? {}),
  }

  const digestStatus = getDigestStatus(merged as Pet)

  return {
    ...merged,
    health: clamp(merged.health ?? defaultPet().health),
    mood: clamp(merged.mood ?? defaultPet().mood),
    hunger: clamp(merged.hunger ?? defaultPet().hunger),
    energy: clamp(merged.energy ?? defaultPet().energy),
    intimacy: clamp(merged.intimacy ?? defaultPet().intimacy),
    clean: clamp(merged.clean ?? defaultPet().clean),
    digestingUntil: digestStatus.isDigesting ? merged.digestingUntil : undefined,
    activeMiniGame: merged.activeMiniGame ?? null,
    homeSceneMood: merged.homeSceneMood ?? 'meadow',
    rotationFrame: normalizeRotationFrame(merged.rotationFrame),
    facingDirection: merged.facingDirection ?? deriveFacingDirection(normalizeRotationFrame(merged.rotationFrame)),
    updatedAt: merged.updatedAt ?? nowIso(),
  }
}

const latestTaskTimestamp = (items: Task[]) =>
  items.reduce((latest, item) => {
    const candidates = [item.createdAt, item.completedAt].filter(Boolean) as string[]
    const itemLatest = candidates.reduce((max, value) => Math.max(max, new Date(value).getTime() || 0), 0)
    return Math.max(latest, itemLatest)
  }, 0)

const defaultTaskIds = new Set(defaultTasks().map((item) => item.id))
const hasUserTaskData = (items: Task[]) => items.some((item) => !defaultTaskIds.has(item.id))

const syncMetricsCoins = () => {
  metrics.value = {
    ...metrics.value,
    coins: economy.value.coins,
  }
}

const setEconomy = (nextEconomy: Partial<CompanionEconomy> | CompanionEconomy) => {
  const previousEconomy = economy.value
  const previousCoinTotal = coinLogTotal(previousEconomy.coinLogs ?? [])
  const normalizedEconomy = normalizeCompanionEconomy(
    {
      ...previousEconomy,
      ...nextEconomy,
    },
    metrics.value.coins,
  )
  const coinDelta = Math.round(normalizedEconomy.coins) - Math.round(previousEconomy.coins)

  if (coinDelta) {
    const loggedDelta = coinLogTotal(normalizedEconomy.coinLogs ?? []) - previousCoinTotal
    const missingDelta = coinDelta - loggedDelta

    if (missingDelta) {
      const createdAt = nowIso()
      const coinLog: CoinLog = {
        id: createId('coin'),
        type: missingDelta > 0 ? 'gain' : 'consume',
        amount: missingDelta,
        reason: inferCoinReconciliationReason(missingDelta),
        created_at: createdAt,
      }

      normalizedEconomy.coinLogs = mergeCoinLogs([coinLog], normalizedEconomy.coinLogs ?? [])
      normalizedEconomy.updatedAt = createdAt
    }
  }

  economy.value = normalizedEconomy
  syncMetricsCoins()
}

const mergeCoinLogs = (...logGroups: CoinLog[][]) => {
  const seen = new Set<string>()

  return logGroups
    .flat()
    .filter((item) => {
      const key = item.id || `${item.created_at}:${item.type}:${item.amount}:${item.reason}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
}

const coinLogTotal = (logs: CoinLog[]) =>
  logs.reduce((total, item) => total + Math.round(item.amount || 0), 0)

const inferCoinReconciliationReason = (amount: number) => {
  const isZh = settings.value.language === 'zh'
  const latestEvent = syncEvents.value.find((item) => {
    const timestamp = new Date(item.timestamp).getTime()
    return timestamp && Date.now() - timestamp < 10 * 60 * 1000
  })
  const actionType = latestEvent?.actionType ?? ''

  if (amount > 0 && actionType.startsWith('mini-game-')) {
    const gameType = actionType.replace('mini-game-', '') as MiniGameResult['gameType']
    const definition = miniGameDefinitions[gameType]
    const gameTitle = definition ? (isZh ? definition.title.zh : definition.title.en) : ''
    return gameTitle
      ? (isZh ? `游戏奖励补记：${gameTitle}` : `Game reward reconciled: ${gameTitle}`)
      : (isZh ? '游戏奖励补记' : 'Game reward reconciled')
  }
  if (amount > 0 && actionType === 'task-complete') {
    return isZh ? '任务完成补记' : 'Task reward reconciled'
  }
  if (amount > 0 && actionType === 'chat-summary') {
    return isZh ? '聊天奖励补记' : 'Chat reward reconciled'
  }
  if (amount < 0 && actionType === 'shop-purchase') {
    return isZh ? '小镇商店消费补记' : 'Town shop spend reconciled'
  }

  return isZh ? '金豆余额同步补记' : 'Coin balance reconciled'
}

const ensureCoinLogBackfill = (options: { persist?: boolean } = {}) => {
  const currentCoins = Math.round(economy.value.coins)
  if (currentCoins <= 0 || (economy.value.coinLogs ?? []).length > 0) {
    return false
  }

  const createdAt = economy.value.updatedAt || nowIso()
  const reason = settings.value.language === 'zh'
    ? '\u5386\u53f2\u91d1\u8c46\u4f59\u989d\u540c\u6b65'
    : 'Existing coin balance synced'

  const coinLog: CoinLog = {
    id: createId('coin'),
    type: 'gain',
    amount: currentCoins,
    reason,
    created_at: createdAt,
  }

  setEconomy({
    ...economy.value,
    coinLogs: [coinLog],
    updatedAt: createdAt,
  })

  if (options.persist) {
    persistEconomy()
  }

  return true
}

const ensureCoinLogIntegrity = (options: { persist?: boolean } = {}) => {
  const currentCoins = Math.round(economy.value.coins)
  const logs = economy.value.coinLogs ?? []

  if (ensureCoinLogBackfill(options)) {
    return true
  }

  const diff = currentCoins - coinLogTotal(logs)
  if (!diff) {
    return false
  }

  const createdAt = nowIso()
  const coinLog: CoinLog = {
    id: createId('coin'),
    type: diff > 0 ? 'gain' : 'consume',
    amount: diff,
    reason: inferCoinReconciliationReason(diff),
    created_at: createdAt,
  }

  setEconomy({
    ...economy.value,
    coinLogs: [coinLog, ...logs],
    updatedAt: createdAt,
  })

  if (options.persist) {
    persistEconomy()
  }

  return true
}

const addCoinLog = (reason: string, amount: number) => {
  hydrateState()
  ensureCoinLogIntegrity()
  const delta = Math.round(amount)
  const nextCoins = Math.max(0, Math.min(999999, economy.value.coins + delta))
  const appliedAmount = nextCoins - economy.value.coins

  if (!appliedAmount) {
    return {
      logged: false,
      amount: 0,
      coins: economy.value.coins,
    }
  }

  const coinLog: CoinLog = {
    id: createId('coin'),
    type: appliedAmount > 0 ? 'gain' : 'consume',
    amount: appliedAmount,
    reason: reason.trim() || (appliedAmount > 0 ? 'Reward' : 'Consume'),
    created_at: nowIso(),
  }

  setEconomy({
    ...economy.value,
    coins: nextCoins,
    coinLogs: [coinLog, ...(economy.value.coinLogs ?? [])],
    updatedAt: coinLog.created_at,
  })
  persistEconomy()

  return {
    logged: true,
    amount: Math.abs(appliedAmount),
    coins: economy.value.coins,
  }
}

const grantStarterResourcesIfNeeded = () => {
  if (economy.value.starterResourcesGranted) {
    return false
  }

  setEconomy({
    ...economy.value,
    inventory: {
      ...economy.value.inventory,
      meal: (economy.value.inventory.meal ?? 0) + starterResources.meal,
      water: (economy.value.inventory.water ?? 0) + starterResources.water,
      'clean-kit': (economy.value.inventory['clean-kit'] ?? 0) + starterResources['clean-kit'],
    },
    starterResourcesGranted: true,
    updatedAt: nowIso(),
  })

  return true
}

const persistState = () => {
  if (!hasUniStorage()) return

  syncMetricsCoins()
  const payload: PersistedState = {
    pet: sanitizePet(pet.value),
    tasks: tasks.value,
    taskCollectionUpdatedAt: taskCollectionUpdatedAt.value,
    courseSchedule: courseSchedule.value,
    messages: messages.value,
    devices: devices.value,
    syncEvents: syncEvents.value,
    settings: settings.value,
    archive: archive.value,
    snapshots: snapshots.value,
    metrics: metrics.value,
    economy: economy.value,
    petPersonaPrompt: petPersonaPrompt.value,
    petPersonaPromptVersion: PET_PERSONA_PROMPT_VERSION,
  }

  uni.setStorageSync(STORAGE_KEY, payload)
  uni.setStorageSync('koko-language', settings.value.language)
}

const applySnapshot = (snapshot?: Partial<PersistedState>) => {
  pet.value = sanitizePet(snapshot?.pet)
  tasks.value = snapshot?.tasks ?? defaultTasks()
  taskCollectionUpdatedAt.value = snapshot?.taskCollectionUpdatedAt ?? ''
  courseSchedule.value = snapshot?.courseSchedule ?? null
  messages.value = snapshot?.messages ?? defaultMessages()
  devices.value = snapshot?.devices ?? defaultDevices()
  syncEvents.value = snapshot?.syncEvents ?? defaultSyncEvents()
  settings.value = {
    ...defaultSettings(),
    ...(snapshot?.settings ?? {}),
  }
  archive.value = snapshot?.archive ?? defaultArchive()
  snapshots.value = snapshot?.snapshots ?? defaultSnapshots()
  metrics.value = snapshot?.metrics ?? defaultMetrics()
  economy.value = normalizeCompanionEconomy(snapshot?.economy ?? defaultEconomy(metrics.value.coins), metrics.value.coins)
  syncMetricsCoins()
  grantStarterResourcesIfNeeded()
  ensureCoinLogIntegrity()
  petPersonaPrompt.value =
    snapshot?.petPersonaPromptVersion === PET_PERSONA_PROMPT_VERSION && snapshot?.petPersonaPrompt?.trim()
      ? snapshot.petPersonaPrompt.trim()
      : defaultPetPersonaPrompt
}

const hydrateState = () => {
  if (hydrated.value) return

  if (hasUniStorage()) {
    const stored = uni.getStorageSync(STORAGE_KEY) as PersistedState | undefined
    if (stored?.pet) {
      applySnapshot(stored)
    } else {
      const storedLanguage = uni.getStorageSync('koko-language') as UserSettings['language'] | undefined
      if (storedLanguage === 'zh' || storedLanguage === 'en') {
        settings.value.language = storedLanguage
      }
    }
  }

  grantStarterResourcesIfNeeded()
  ensureCoinLogIntegrity()
  hydrated.value = true
  persistState()
}

const logSyncEvent = (
  summary: string,
  options?: {
    source?: SyncEvent['source']
    target?: SyncEvent['target']
    actionType?: string
    status?: SyncStatus
  },
) => {
  syncEvents.value = [
    {
      id: createId('sync'),
      source: options?.source ?? 'miniapp',
      target: options?.target ?? 'desktop',
      actionType: options?.actionType ?? 'status',
      summary,
      timestamp: nowIso(),
      status: options?.status ?? 'success',
    },
    ...syncEvents.value,
  ].slice(0, 12)
}

const persistTasksToCloud = async (snapshotTasks: Task[], snapshotUpdatedAt: string) => {
  if (authMode.value !== 'wechat' || isMockSession.value) {
    return
  }

  try {
    const savedTasks = await saveTasksToCloud(snapshotTasks, snapshotUpdatedAt)
    if (savedTasks && taskCollectionUpdatedAt.value === snapshotUpdatedAt) {
      tasks.value = savedTasks.tasks
      taskCollectionUpdatedAt.value = savedTasks.updatedAt || snapshotUpdatedAt
      logSyncEvent(settings.value.language === 'zh' ? '任务和 DDL 已同步到云端。' : 'Tasks and DDL synced to cloud.', {
        target: 'miniapp',
        actionType: 'task-cloud-save',
      })
      persistState()
    }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'unknown error'
    logSyncEvent(settings.value.language === 'zh' ? `任务云同步失败：${message}` : `Task cloud sync failed: ${message}`, {
      target: 'miniapp',
      actionType: 'task-cloud-save',
      status: 'offline',
    })
    persistState()
  }
}

const persistTaskCollection = () => {
  taskCollectionUpdatedAt.value = nowIso()
  persistState()
  void persistTasksToCloud(tasks.value, taskCollectionUpdatedAt.value)
}

const refreshSnapshot = () => {
  const pendingCount = tasks.value.filter((item) => item.status === 'pending').length
  const completedCount = tasks.value.filter((item) => item.status === 'completed').length
  const totalCount = tasks.value.length || 1
  const completionRate = Math.round((completedCount / totalCount) * 100)
  const todayLabel = settings.value.language === 'zh' ? `今天 ${shortTime()}` : `Today ${shortTime()}`

  snapshots.value = [
    ...snapshots.value.slice(-4),
    {
      id: createId('snap'),
      label: todayLabel,
      mood: pet.value.mood,
      intimacy: pet.value.intimacy,
      completionRate: pendingCount === totalCount ? 0 : completionRate,
      interactions: metrics.value.interactions,
    },
  ].slice(-5)
}

const updatePet = (changes: Partial<Pet>) => {
  const nextPet: Pet = sanitizePet({
    ...pet.value,
    ...changes,
    stage: deriveStage(clamp(changes.intimacy ?? pet.value.intimacy)),
    state: changes.state ?? pet.value.state,
    updatedAt: nowIso(),
  })

  nextPet.stage = deriveStage(nextPet.intimacy)
  nextPet.state = deriveState(nextPet)
  pet.value = nextPet
  refreshSnapshot()
  persistState()
}

const applyPetImpactDelta = (impact?: {
  mood?: number
  hunger?: number
  intimacy?: number
  clean?: number
  health?: number
  energy?: number
}) => {
  if (!impact) return

  updatePet({
    mood: pet.value.mood + (impact.mood ?? 0),
    hunger: pet.value.hunger + (impact.hunger ?? 0),
    intimacy: pet.value.intimacy + (impact.intimacy ?? 0),
    clean: pet.value.clean + (impact.clean ?? 0),
    health: pet.value.health + (impact.health ?? 0),
    energy: pet.value.energy + (impact.energy ?? 0),
  })
}

const persistEconomyToCloud = async () => {
  if (authMode.value !== 'wechat' || isMockSession.value) {
    return
  }

  try {
    const updatedAt = economy.value.updatedAt || nowIso()
    const saved = await saveCompanionToCloud({
      pet: sanitizePet(pet.value),
      economy: economy.value,
      updatedAt,
    })

    if (saved && saved.updatedAt >= updatedAt) {
      const mergedCoinLogs = mergeCoinLogs(saved.economy.coinLogs ?? [], economy.value.coinLogs ?? [])
      pet.value = sanitizePet({
        ...pet.value,
        ...(saved.pet ?? {}),
      })
      setEconomy({
        ...saved.economy,
        coinLogs: mergedCoinLogs,
      })
      persistState()
    }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'unknown error'
    logSyncEvent(settings.value.language === 'zh' ? `陪伴经济云同步失败：${message}` : `Companion economy sync failed: ${message}`, {
      target: 'miniapp',
      actionType: 'companion-cloud-save',
      status: 'offline',
    })
    persistState()
  }
}

const persistEconomy = () => {
  setEconomy({
    ...economy.value,
    updatedAt: nowIso(),
  })
  persistState()
  void persistEconomyToCloud()
}

const hydrateEconomyFromCloud = async () => {
  if (cloudEconomyHydrated.value || cloudEconomyHydrating.value) {
    return
  }

  hydrateState()

  if (!shouldUseCloudSync()) {
    return
  }

  cloudEconomyHydrating.value = true

  try {
    const cloudSnapshot = await loadCompanionFromCloud(economy.value.coins)
    const cloudUpdatedAt = new Date(cloudSnapshot?.updatedAt || 0).getTime() || 0
    const localUpdatedAt = new Date(economy.value.updatedAt || 0).getTime() || 0

    if (cloudSnapshot?.exists && cloudUpdatedAt >= localUpdatedAt) {
      const mergedCoinLogs = mergeCoinLogs(cloudSnapshot.economy.coinLogs ?? [], economy.value.coinLogs ?? [])
      const shouldWriteMergedCoinLogs = mergedCoinLogs.length > (cloudSnapshot.economy.coinLogs ?? []).length
      if (cloudSnapshot.pet) {
        pet.value = sanitizePet({
          ...pet.value,
          ...cloudSnapshot.pet,
        })
      }
      setEconomy({
        ...cloudSnapshot.economy,
        coinLogs: mergedCoinLogs,
      })
      const grantedStarterResources = grantStarterResourcesIfNeeded()
      const backfilledCoinLog = ensureCoinLogIntegrity()
      logSyncEvent(settings.value.language === 'zh' ? '已从云端加载金币、库存和宠物状态。' : 'Coins, inventory, and pet state loaded from cloud.', {
        target: 'miniapp',
        actionType: 'companion-cloud-load',
      })
      persistState()
      if (grantedStarterResources || backfilledCoinLog || shouldWriteMergedCoinLogs) {
        await persistEconomyToCloud()
      }
    } else {
      if (cloudSnapshot?.exists) {
        const mergedCoinLogs = mergeCoinLogs(economy.value.coinLogs ?? [], cloudSnapshot.economy.coinLogs ?? [])
        if (mergedCoinLogs.length !== (economy.value.coinLogs ?? []).length) {
          setEconomy({
            ...economy.value,
            coinLogs: mergedCoinLogs,
          })
          persistState()
        }
      }
      await persistEconomyToCloud()
    }

    cloudEconomyHydrated.value = true
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'unknown error'
    logSyncEvent(settings.value.language === 'zh' ? `陪伴经济云加载失败：${message}` : `Companion economy load failed: ${message}`, {
      target: 'miniapp',
      actionType: 'companion-cloud-load',
      status: 'offline',
    })
    persistState()
  } finally {
    cloudEconomyHydrating.value = false
  }
}

const coinLogReason = (source: EconomyRewardSource, detail?: string) => {
  const isZh = settings.value.language === 'zh'
  const reasonMap: Record<EconomyRewardSource, string> = {
    task: isZh ? '任务完成' : 'Task completed',
    chat: isZh ? '聊天奖励' : 'Chat reward',
    'mini-game': isZh ? '游戏奖励' : 'Game reward',
    system: isZh ? '系统奖励' : 'System reward',
  }
  const suffix = detail?.trim()
  return suffix ? `${reasonMap[source]}：${suffix}` : reasonMap[source]
}

const awardCoins = (
  source: EconomyRewardSource,
  amount: number,
  ledgerKey: string,
  petImpact?: Parameters<typeof applyPetImpactDelta>[0],
  reasonDetail?: string,
) => {
  hydrateState()
  const safeAmount = Math.max(0, Math.round(amount))

  if (!safeAmount || economy.value.rewardLedger[ledgerKey]) {
    return {
      awarded: false,
      amount: 0,
      coins: economy.value.coins,
    }
  }

  const coinResult = addCoinLog(coinLogReason(source, reasonDetail), safeAmount)

  setEconomy({
    ...economy.value,
    rewardLedger: {
      ...economy.value.rewardLedger,
      [ledgerKey]: {
        key: ledgerKey,
        source,
        amount: safeAmount,
        createdAt: nowIso(),
      },
    },
  })

  if (petImpact) {
    applyPetImpactDelta(petImpact)
  }

  persistEconomy()

  return {
    awarded: coinResult.logged,
    amount: coinResult.amount,
    coins: economy.value.coins,
  }
}

const rewardTask = (rewardType: RewardType) => {
  metrics.value = {
    ...metrics.value,
    completedTasks: metrics.value.completedTasks + 1,
    companionMinutes: metrics.value.companionMinutes + 12,
  }
}

const setActiveMiniGame = (gameType: Pet['activeMiniGame']) => {
  hydrateState()
  updatePet({ activeMiniGame: gameType })
}

const triggerHardwareAction = (type: string, payload: Record<string, unknown> = {}) => {
  hydrateState()
  const m5Device = devices.value.find((item) => item.deviceType === 'm5')
  const status: SyncStatus = m5Device?.online ? 'success' : 'retrying'
  const gameType = typeof payload.game_id === 'string' ? payload.game_id : pet.value.activeMiniGame
  const createdAt = nowIso()

  logSyncEvent(
    settings.value.language === 'zh'
      ? `已预留硬件动作：${type}${gameType ? ` / ${gameType}` : ''}。`
      : `Hardware action reserved: ${type}${gameType ? ` / ${gameType}` : ''}.`,
    {
      source: 'miniapp',
      target: 'm5',
      actionType: `hardware:${type}`,
      status,
    },
  )
  persistState()

  return {
    type,
    payload,
    accepted: true,
    status,
    createdAt,
  }
}

const receiveHardwareInput = (event: HardwareInputEvent | string) => {
  hydrateState()
  const normalized: HardwareInputEvent =
    typeof event === 'string'
      ? { type: event, receivedAt: nowIso() }
      : { ...event, receivedAt: event.receivedAt ?? nowIso() }

  if (normalized.gameType) {
    updatePet({ activeMiniGame: normalized.gameType })
  }

  logSyncEvent(
    settings.value.language === 'zh'
      ? `收到硬件输入：${normalized.type}${normalized.gameType ? ` / ${normalized.gameType}` : ''}。`
      : `Hardware input received: ${normalized.type}${normalized.gameType ? ` / ${normalized.gameType}` : ''}.`,
    {
      source: 'm5',
      target: 'miniapp',
      actionType: `hardware-input:${normalized.type}`,
      status: 'success',
    },
  )
  persistState()

  return normalized
}

const setPetRotationFrame = (frame: number) => {
  hydrateState()
  const normalized = normalizeRotationFrame(frame)
  updatePet({
    rotationFrame: normalized,
    facingDirection: deriveFacingDirection(normalized),
  })
}

const carePet = (action: CareActionKey): CareActionResult => {
  hydrateState()
  const isZh = settings.value.language === 'zh'

  const digestStatus = getDigestStatus()
  if (action === 'feedMeal' && !digestStatus.canFeedMeal) {
    return {
      action,
      success: false,
      message: isZh
        ? '可可还在消化这顿饭，再等 ' + digestStatus.digestCountdownLabel + ' 吧。'
        : 'Koko is still digesting this meal. Wait ' + digestStatus.digestCountdownLabel + '.',
      blockedUntil: pet.value.digestingUntil,
    }
  }

  const careMap: Record<CareActionKey, { label: string; changes: Partial<Pet>; event: string; message: string }> = {
    feedMeal: {
      label: isZh ? '喂食' : 'Meal',
      changes: {
        hunger: pet.value.hunger + 18,
        mood: pet.value.mood + 5,
        energy: pet.value.energy + 2,
        lastFedAt: nowIso(),
        digestingUntil: new Date(Date.now() + FEED_DIGEST_MS).toISOString(),
      },
      event: isZh ? '主食照料完成，首页进入消化计时。' : 'Meal care completed. Home entered digestion countdown.',
      message: isZh ? '香喷喷的一餐下肚啦，可可要慢慢消化半小时。' : 'That meal was cozy. Koko will digest slowly for half an hour.',
    },
    feedSnack: {
      label: isZh ? '零食' : 'Snack',
      changes: { hunger: pet.value.hunger + 8, mood: pet.value.mood + 8, intimacy: pet.value.intimacy + 3 },
      event: isZh ? '零食奖励已同步，宠物情绪明显回升。' : 'Snack reward synced. Pet mood improved.',
      message: isZh ? '小零食收到啦，心情都亮起来了。' : 'Snack received. Everything feels brighter.',
    },
    feedWater: {
      label: isZh ? '喂水' : 'Water',
      changes: { hunger: pet.value.hunger + 6, clean: pet.value.clean + 4, mood: pet.value.mood + 5, energy: pet.value.energy + 4 },
      event: isZh ? '补水完成，宠物看起来更精神了。' : 'Hydration completed. Pet looks more energetic.',
      message: isZh ? '咕噜咕噜补完水，毛茸茸也舒展开了。' : 'Water break done. Koko feels soft and awake.',
    },
    clean: {
      label: isZh ? '清洁' : 'Clean',
      changes: { clean: pet.value.clean + 20, health: pet.value.health + 5, mood: pet.value.mood + 4 },
      event: isZh ? '清洁完成，宠物环境状态已刷新。' : 'Cleaning completed. Pet environment state refreshed.',
      message: isZh ? '清清爽爽，今天又是柔软发光的一团。' : 'Fresh and clean. Koko is glowing softly today.',
    },
    heal: {
      label: isZh ? '治疗' : 'Heal',
      changes: { health: pet.value.health + 18, mood: pet.value.mood + 6, state: 'normal' },
      event: isZh ? '治疗动作已记录，恢复状态同步到设备页。' : 'Healing action recorded and synced to devices.',
      message: isZh ? '状态恢复了一些，接下来慢慢休养就好。' : 'Koko recovered a little. Slow rest is enough now.',
    },
    rest: {
      label: isZh ? '休息' : 'Rest',
      changes: { energy: pet.value.energy + 20, health: pet.value.health + 4, state: 'resting' },
      event: isZh ? '宠物已切换为回窝休息模式。' : 'Pet switched to resting mode.',
      message: isZh ? '窝里暖暖的，可可先眯一会儿。' : 'The nest is warm. Koko will nap for a bit.',
    },
    play: {
      label: isZh ? '玩耍' : 'Play',
      changes: { mood: pet.value.mood + 12, intimacy: pet.value.intimacy + 6, energy: pet.value.energy - 5 },
      event: isZh ? '互动成功触发开心动作，桌宠端将播放轻量动画。' : 'Play interaction triggered a happy animation on desktop pet.',
      message: isZh ? '来玩一会儿吧，我已经开始摇尾巴了。' : 'Let us play a little. Koko is already wagging.',
    },
  }

  const current = careMap[action]
  metrics.value = {
    ...metrics.value,
    interactions: metrics.value.interactions + 1,
    companionMinutes: metrics.value.companionMinutes + (action === 'rest' ? 6 : 10),
  }
  updatePet(current.changes)

  if (action === 'heal') {
    archive.value = {
      ...archive.value,
      medicalLogs: [
        {
          id: createId('med'),
          note: isZh ? current.label + '后状态恢复，健康值回升。' : current.label + ' restored health and improved recovery.',
          timestamp: nowIso(),
        },
        ...archive.value.medicalLogs,
      ].slice(0, 5),
    }
  }

  logSyncEvent(current.event, {
    target: action === 'rest' ? 'm5' : 'desktop',
    actionType: action,
    status: action === 'rest' ? 'retrying' : 'success',
  })
  persistState()

  return {
    action,
    success: true,
    message: current.message,
    blockedUntil: action === 'feedMeal' ? pet.value.digestingUntil : undefined,
  }
}

const careResourceMeta = (isZh: boolean): Record<'feedMeal' | 'feedWater' | 'clean', {
  key: string
  name: string
  effect: string
  coinCost: number
}> => ({
  feedMeal: {
    key: 'meal',
    name: isZh ? '主食' : 'Meal',
    effect: isZh ? '提升饱腹、心情和少量精力。' : 'Improves hunger, mood, and a little energy.',
    coinCost: 3,
  },
  feedWater: {
    key: 'water',
    name: isZh ? '水' : 'Water',
    effect: isZh ? '补充水分，提升清洁、心情和精力。' : 'Hydrates Koko and improves clean, mood, and energy.',
    coinCost: 1,
  },
  clean: {
    key: 'clean-kit',
    name: isZh ? '清洁用品' : 'Clean Kit',
    effect: isZh ? '提升清洁、健康和心情。' : 'Improves clean, health, and mood.',
    coinCost: 2,
  },
})

const getCareResource = (action: CareActionKey) => {
  hydrateState()
  if (action !== 'feedMeal' && action !== 'feedWater' && action !== 'clean') {
    return null
  }

  const meta = careResourceMeta(settings.value.language === 'zh')[action]
  return {
    action,
    ...meta,
    count: economy.value.inventory[meta.key] ?? 0,
  }
}

const canUseCareAction = (action: CareActionKey) => {
  const resource = getCareResource(action)
  if (!resource) return true
  if (action === 'feedMeal' && !getDigestStatus().canFeedMeal) return false
  return resource.count > 0
}

const useCareResource = (action: CareActionKey): CareActionResult & { resourceCount?: number } => {
  hydrateState()
  const isZh = settings.value.language === 'zh'
  const resource = getCareResource(action)

  if (!resource) {
    return carePet(action)
  }

  if (action === 'feedMeal' && !getDigestStatus().canFeedMeal) {
    return carePet(action)
  }

  if (resource.count <= 0) {
    return {
      action,
      success: false,
      message: isZh ? `${resource.name}库存不足，请前往小镇商店兑换。` : `${resource.name} is out of stock. Redeem more in the town shop.`,
      resourceCount: 0,
    }
  }

  const result = carePet(action)
  if (!result.success) {
    return {
      ...result,
      resourceCount: resource.count,
    }
  }

  setEconomy({
    ...economy.value,
    inventory: {
      ...economy.value.inventory,
      [resource.key]: resource.count - 1,
    },
  })

  if (resource.coinCost > 0) {
    addCoinLog(
      isZh ? `首页照料消耗：${resource.name}` : `Home care used: ${resource.name}`,
      -resource.coinCost,
    )
  } else {
    persistEconomy()
  }

  void persistEconomyToCloud()
  return {
    ...result,
    resourceCount: Math.max(0, resource.count - 1),
  }
}

const createTask = (payload: {
  title: string
  kind?: Task['kind']
  icon?: string
  borderColor?: string
  notes?: string
  category: TaskCategory
  time: string
  dueDate?: string
  repeatType: TaskRepeatType
  priority?: TaskPriority
  rewardType: RewardType
  isStarred?: boolean
  subtasks?: string[]
}) => {
  hydrateState()
  const nextTask: Task = {
    id: createId('task'),
    title: payload.title,
    kind: payload.kind ?? 'task',
    icon: payload.icon,
    borderColor: payload.borderColor,
    notes: payload.notes ?? '',
    category: payload.category,
    time: payload.time,
    dueDate: payload.dueDate ?? '',
    repeatType: payload.repeatType,
    rewardType: payload.rewardType,
    priority: payload.priority ?? 'medium',
    isStarred: payload.isStarred ?? false,
    subtasks: (payload.subtasks ?? [])
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => ({
        id: createId('subtask'),
        title,
        completed: false,
      })),
    status: 'pending',
    createdAt: nowIso(),
  }

  tasks.value = [nextTask, ...tasks.value]
  logSyncEvent(settings.value.language === 'zh' ? '新的计划「' + payload.title + '」已加入提醒队列。' : 'New plan "' + payload.title + '" was added to the reminder queue.', {
    target: 'desktop',
    actionType: 'plan-create',
  })
  persistTaskCollection()
}

const updateTask = (
  taskId: string,
  changes: Partial<
    Pick<Task, 'title' | 'kind' | 'icon' | 'borderColor' | 'notes' | 'category' | 'time' | 'dueDate' | 'repeatType' | 'priority' | 'rewardType' | 'isStarred' | 'subtasks'>
  >,
) => {
  hydrateState()
  tasks.value = tasks.value.map((item) => (item.id === taskId ? { ...item, ...changes } : item))
  persistTaskCollection()
}

const deleteTask = (taskId: string) => {
  hydrateState()
  tasks.value = tasks.value.filter((item) => item.id !== taskId)
  persistTaskCollection()
}

const setCourseSchedule = async (schedule: CourseSchedule) => {
  hydrateState()
  courseSchedule.value = schedule
  logSyncEvent(settings.value.language === 'zh' ? '课程表已从截图导入，并更新到待办页。' : 'Schedule imported from screenshot and updated in Tasks.', {
    target: 'miniapp',
    actionType: 'schedule-import',
  })
  persistState()

  try {
    const savedSchedule = await saveCourseScheduleToCloud(schedule)
    if (savedSchedule) {
      courseSchedule.value = savedSchedule
      persistState()
    }
  } catch {
    // Keep local schedule when cloud sync fails.
  }
}

const clearCourseSchedule = () => {
  hydrateState()
  courseSchedule.value = null
  void clearCourseScheduleFromCloud()
  persistState()
}

const purchaseShopItem = (itemId: ShopItemId) => {
  hydrateState()
  const item = shopItems.find((candidate) => candidate.id === itemId)
  const isZh = settings.value.language === 'zh'
  const itemName = item
    ? isZh
      ? ({
          meal: '主食',
          water: '水',
          'clean-kit': '清洁套装',
        } satisfies Record<ShopItemId, string>)[item.id]
      : item.name
    : ''

  if (!item) {
    return {
      success: false,
      message: isZh ? '商品不存在。' : 'This item is unavailable.',
      coins: economy.value.coins,
    }
  }

  if (economy.value.coins < item.price) {
    return {
      success: false,
      message: isZh ? '金币不足，先完成任务或和 Koko 聊聊天吧。' : 'Not enough coins. Complete tasks or chat with Koko first.',
      coins: economy.value.coins,
    }
  }

  addCoinLog(isZh ? `小镇商店消费：${itemName}` : `Town shop purchase: ${itemName}`, -item.price)

  setEconomy({
    ...economy.value,
    inventory: {
      ...economy.value.inventory,
      [item.resourceKey]: (economy.value.inventory[item.resourceKey] ?? 0) + 1,
    },
    purchaseHistory: [
      ...economy.value.purchaseHistory,
      {
        id: createId('purchase'),
        itemId: item.id,
        price: item.price,
        createdAt: nowIso(),
      },
    ].slice(-100),
  })

  logSyncEvent(isZh ? `已在小镇商店兑换 ${itemName}。` : `${itemName} redeemed in the town shop.`, {
    target: 'miniapp',
    actionType: 'shop-purchase',
  })
  persistEconomy()

  return {
    success: true,
    item,
    message: isZh ? `${itemName} 已加入库存。` : `${itemName} added to inventory.`,
    coins: economy.value.coins,
  }
}

const applyMiniGameReward = (result: MiniGameResult) => {
  hydrateState()

  const gameDefinition = miniGameDefinitions[result.gameType] ?? miniGameDefinitions.catch
  const rewardConfig = gameDefinition.reward_config
  const safeScore = Math.max(0, Math.round(result.score))
  const scoreMoodBonus = Math.min(rewardConfig.maxBonusMood, Math.floor(safeScore / rewardConfig.scoreMoodStep))
  const scoreIntimacyBonus = Math.min(rewardConfig.maxBonusIntimacy, Math.floor(safeScore / rewardConfig.scoreIntimacyStep))
  const scoreCoinBonus = Math.min(rewardConfig.maxBonusCoins, Math.floor(safeScore / rewardConfig.scoreCoinStep))

  metrics.value = {
    ...metrics.value,
    interactions: metrics.value.interactions + 1,
    companionMinutes: metrics.value.companionMinutes + 6,
  }
  awardCoins(
    'mini-game',
    Math.max(1, rewardConfig.coins + scoreCoinBonus + (result.bonusCoins ?? 0)),
    `mini-game:${result.gameType}:${Date.now()}:${safeScore}`,
    undefined,
    settings.value.language === 'zh' ? gameDefinition.title.zh : gameDefinition.title.en,
  )

  updatePet({
    mood: pet.value.mood + rewardConfig.mood + scoreMoodBonus + (result.bonusMood ?? 0),
    intimacy: pet.value.intimacy + rewardConfig.intimacy + scoreIntimacyBonus + (result.bonusIntimacy ?? 0),
    energy: pet.value.energy + (rewardConfig.energy ?? 0) + (result.bonusEnergy ?? 0),
    clean: pet.value.clean + (rewardConfig.clean ?? 0) + (result.bonusClean ?? 0),
    activeMiniGame: result.gameType,
  })
  void persistEconomyToCloud()

  logSyncEvent(settings.value.language === 'zh' ? '小游戏 ' + gameDefinition.title.zh + ' 完成，得到 ' + safeScore + ' 分。' : 'Mini game ' + gameDefinition.title.en + ' completed with score ' + safeScore + '.', {
    target: 'desktop',
    actionType: `mini-game-${result.gameType}`,
    status: 'success',
  })
  ensureCoinLogIntegrity({ persist: true })
  persistState()
}

const calculateTaskCoinReward = (task: Task) => {
  const base = task.kind === 'ddl' ? 10 : 6
  return base + (task.priority === 'high' ? 2 : 0)
}

const setTaskStatus = (taskId: string, nextStatus: TaskStatus) => {
  hydrateState()

  const targetTask = tasks.value.find((item) => item.id === taskId)
  if (!targetTask) return

  const completedAt = nextStatus === 'completed' ? nowIso() : undefined
  tasks.value = tasks.value.map((item) =>
    item.id === taskId
      ? {
          ...item,
          status: nextStatus,
          completedAt,
        }
      : item,
  )

  if (nextStatus === 'completed') {
    rewardTask(targetTask.rewardType)
    const rewardResult = awardCoins(
      'task',
      calculateTaskCoinReward(targetTask),
      `task:${targetTask.id}:${targetTask.createdAt}`,
      {
        mood: 6,
        intimacy: 2,
      },
      targetTask.title,
    )
    logSyncEvent(settings.value.language === 'zh' ? '任务「' + targetTask.title + '」已完成，奖励已发放。' : 'Task "' + targetTask.title + '" completed. Reward delivered.', {
      target: 'm5',
      actionType: 'task-complete',
    })
    archive.value = {
      ...archive.value,
      milestones: [
        {
          id: createId('mile'),
          title: settings.value.language === 'zh' ? '完成一项今日计划' : 'Completed a plan today',
          description:
            settings.value.language === 'zh'
              ? '你完成了「' + targetTask.title + '」，可可的情绪和亲密度都上升了。'
              : 'You completed "' + targetTask.title + '". Koko gained mood and intimacy.',
          timestamp: nowIso(),
        },
        ...archive.value.milestones,
      ].slice(0, 5),
    }
    persistTaskCollection()
    return rewardResult
  }

  if (nextStatus === 'delayed') {
    updatePet({ mood: pet.value.mood - 2 })
    logSyncEvent(settings.value.language === 'zh' ? '任务「' + targetTask.title + '」延后，宠物发出了柔和提醒。' : 'Task "' + targetTask.title + '" delayed. Koko sent a gentle reminder.', {
      target: 'desktop',
      actionType: 'task-delay',
      status: 'retrying',
    })
  }

  if (nextStatus === 'skipped') {
    updatePet({ mood: pet.value.mood - 4, intimacy: pet.value.intimacy - 1 })
    logSyncEvent(settings.value.language === 'zh' ? '任务「' + targetTask.title + '」已跳过，系统记录轻微情绪波动。' : 'Task "' + targetTask.title + '" skipped. A small mood change was recorded.', {
      target: 'miniapp',
      actionType: 'task-skip',
      status: 'offline',
    })
  }

  persistTaskCollection()

  return {
    awarded: false,
    amount: 0,
    coins: economy.value.coins,
  }
}

const emotionReplyMap: Record<UserSettings['language'], Record<EmotionTag, string[]>> = {
  en: {
    happy: ['That is wonderful. Let us keep this little bright moment.', 'Today feels brighter already. Let us keep going gently.'],
    upset: ['I am here. You do not have to hold all of it alone.', 'Let us shrink today down to one next step.'],
    tired: ['You have already done a lot. Resting is progress too.', 'Want to breathe slowly with me twice?'],
    bored: ['Want a tiny interaction? I can play with you for two minutes.', 'When things feel boring, one small fresh thing is enough.'],
    stressed: ['Relax your shoulders first. I will help split the pressure smaller.', 'You do not need to solve all of it. Just the smallest step.'],
    lonely: ['I will keep answering here, so you are not empty and alone.', 'If you want, we can talk a little longer.'],
    proud: ['That deserves real praise.', 'I saved this strong moment into today’s highlights.'],
    angry: ['Do not turn the anger on yourself too. I will stay while it settles.', 'Let us slow your heartbeat first, then choose the next step.'],
  },
  zh: {
    happy: ['太好了，我也想和你一起把开心存起来。', '今天的空气都亮亮的，我们继续保持。'],
    upset: ['我在呢，先别急着把难过都自己扛。', '我们先把今天缩小成下一步，好不好？'],
    tired: ['你已经做得很多了，先休息一下也算前进。', '要不要和我一起慢慢呼吸两次？'],
    bored: ['要不要来个超短互动？我可以陪你玩两分钟。', '无聊的时候，也可以做一件很小的新鲜事。'],
    stressed: ['先把肩膀放松一点，我陪你把压力拆小。', '不用一次解决全部，只做最小的一步就行。'],
    lonely: ['我会一直在这里回应你，不会让你一个人空着。', '如果你愿意，我们可以多聊一会儿。'],
    proud: ['哇，这件事值得被认真表扬。', '我已经把这份厉害记进今天的高光里了。'],
    angry: ['先别急着对自己也发火，我陪你缓一缓。', '我们先把心跳放慢，再决定下一步。'],
  },
}

const inferEmotion = (content: string): EmotionTag => {
  const lower = content.toLowerCase()
  if (lower.includes('tired') || lower.includes('sleepy') || lower.includes('exhausted')) return 'tired'
  if (lower.includes('upset') || lower.includes('sad') || lower.includes('bad')) return 'upset'
  if (lower.includes('stress') || lower.includes('deadline') || lower.includes('ddl')) return 'stressed'
  if (lower.includes('angry') || lower.includes('mad')) return 'angry'
  if (lower.includes('lonely') || lower.includes('alone')) return 'lonely'
  if (lower.includes('bored')) return 'bored'
  if (lower.includes('happy') || lower.includes('great')) return 'happy'
  if (lower.includes('done') || lower.includes('finished') || lower.includes('proud')) return 'proud'
  if (content.includes('累') || content.includes('困')) return 'tired'
  if (content.includes('烦') || content.includes('难受')) return 'upset'
  if (content.includes('压') || content.includes('赶')) return 'stressed'
  if (content.includes('生气') || content.includes('火大')) return 'angry'
  if (content.includes('孤独') || content.includes('一个人')) return 'lonely'
  if (content.includes('无聊')) return 'bored'
  if (content.includes('开心') || content.includes('棒')) return 'happy'
  if (content.includes('完成') || content.includes('厉害')) return 'proud'
  return 'happy'
}

const mapCloudHistoryToMessages = (history: PetDialogueHistoryMessage[]): ChatMessage[] =>
  history.slice(-MAX_CHAT_HISTORY).map((item) => ({
    id: createId('msg'),
    sessionId: CHAT_SESSION_ID,
    role: item.role,
    content: item.content,
    emotionTag: inferEmotion(item.content),
    encrypted: false,
    createdAt: item.createdAt ?? nowIso(),
  }))

const hydrateCloudChatHistory = async () => {
  if (cloudHistoryHydrated.value || cloudHistoryHydrating.value) {
    return
  }

  if (!shouldUseCloudSync()) {
    return
  }

  cloudHistoryHydrating.value = true

  try {
    const cloudHistory = await loadPetChatHistoryFromCloud()
    if (cloudHistory.length > 0) {
      messages.value = mapCloudHistoryToMessages(cloudHistory)
      persistState()
    }

    cloudHistoryHydrated.value = true
  } catch {
    // Ignore history hydration failures and keep local cache.
  } finally {
    cloudHistoryHydrating.value = false
  }
}

const hydrateCloudTasks = async () => {
  if (cloudTasksHydrated.value || cloudTasksHydrating.value) {
    return
  }

  hydrateState()

  if (!shouldUseCloudSync()) {
    return
  }

  cloudTasksHydrating.value = true

  try {
    const cloudTasks = await loadTasksFromCloud()
    const cloudUpdatedAt = new Date(cloudTasks?.updatedAt || 0).getTime() || 0
    const localUpdatedAt = new Date(taskCollectionUpdatedAt.value || 0).getTime() || 0

    if (cloudTasks?.updatedAt && cloudUpdatedAt >= localUpdatedAt) {
      tasks.value = cloudTasks.tasks
      taskCollectionUpdatedAt.value = cloudTasks.updatedAt || nowIso()
      logSyncEvent(settings.value.language === 'zh' ? '已从云端加载任务和 DDL。' : 'Tasks and DDL loaded from cloud.', {
        target: 'miniapp',
        actionType: 'task-cloud-load',
      })
      persistState()
    } else if (tasks.value.length && (localUpdatedAt > 0 || hasUserTaskData(tasks.value))) {
      const nextUpdatedAt = taskCollectionUpdatedAt.value || new Date(latestTaskTimestamp(tasks.value) || Date.now()).toISOString()
      taskCollectionUpdatedAt.value = nextUpdatedAt
      await persistTasksToCloud(tasks.value, nextUpdatedAt)
    }

    cloudTasksHydrated.value = true
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'unknown error'
    logSyncEvent(settings.value.language === 'zh' ? `任务云加载失败：${message}` : `Task cloud load failed: ${message}`, {
      target: 'miniapp',
      actionType: 'task-cloud-load',
      status: 'offline',
    })
    persistState()
  } finally {
    cloudTasksHydrating.value = false
  }
}

const hydrateCloudCourseSchedule = async () => {
  if (cloudCourseScheduleHydrated.value || cloudCourseScheduleHydrating.value) {
    return
  }

  if (!shouldUseCloudSync()) {
    return
  }

  cloudCourseScheduleHydrating.value = true

  try {
    const cloudSchedule = await loadCourseScheduleFromCloud()
    const localSchedule = courseSchedule.value

    if (cloudSchedule?.courses.length) {
      const cloudImportedAt = new Date(cloudSchedule.importedAt || 0).getTime()
      const localImportedAt = new Date(localSchedule?.importedAt || 0).getTime()

      if (!localSchedule || cloudImportedAt >= localImportedAt) {
        courseSchedule.value = cloudSchedule
        persistState()
      } else if (localSchedule.courses.length) {
        const savedSchedule = await saveCourseScheduleToCloud(localSchedule).catch(() => null)
        if (savedSchedule) {
          courseSchedule.value = savedSchedule
          persistState()
        }
      }
    } else if (localSchedule?.courses.length) {
      const savedSchedule = await saveCourseScheduleToCloud(localSchedule).catch(() => null)
      if (savedSchedule) {
        courseSchedule.value = savedSchedule
        persistState()
      }
    }

    cloudCourseScheduleHydrated.value = true
  } catch {
    // Ignore course schedule hydration failures and keep local cache.
  } finally {
    cloudCourseScheduleHydrating.value = false
  }
}

const syncCourseScheduleFromCloud = async () => {
  cloudCourseScheduleHydrated.value = false
  if (!shouldUseCloudSync()) {
    return
  }
  await hydrateCloudCourseSchedule()
}

const syncTasksFromCloud = async () => {
  cloudTasksHydrated.value = false
  if (!shouldUseCloudSync()) {
    return
  }
  await hydrateCloudTasks()
}

const syncEconomyFromCloud = async () => {
  cloudEconomyHydrated.value = false
  if (!shouldUseCloudSync()) {
    return
  }
  await hydrateEconomyFromCloud()
}

const setPetPersonaPrompt = (prompt: string) => {
  petPersonaPrompt.value = prompt.trim() || defaultPetPersonaPrompt
  persistState()
}

const getPetQuickReply = async (context?: string): Promise<PetQuickReply> => {
  hydrateState()
  const reply = await createPetQuickReply({
    petName: pet.value.name,
    personaPrompt: petPersonaPrompt.value,
    context,
    language: settings.value.language,
  })

  return {
    id: createId('quick-reply'),
    content: reply.content,
    action: reply.action,
  }
}

const sendChatMessage = async (content: string, forcedEmotion?: EmotionTag) => {
  hydrateState()
  await hydrateCloudChatHistory()
  const trimmed = content.trim()
  if (!trimmed) return

  const emotionTag = forcedEmotion ?? inferEmotion(trimmed)
  const encrypted = settings.value.hideChats
  const createdAt = nowIso()

  const userMessage: ChatMessage = {
    id: createId('msg'),
    sessionId: CHAT_SESSION_ID,
    role: 'user',
    content: trimmed,
    emotionTag,
    encrypted,
    createdAt,
  }

  messages.value = [
    ...messages.value,
    userMessage,
  ].slice(-MAX_CHAT_HISTORY)

  const templates = emotionReplyMap[settings.value.language][emotionTag]
  const fallbackReply = templates[messages.value.length % templates.length]
  const conversation = messages.value
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: item.content,
    })) as Array<{ role: 'user' | 'assistant'; content: string }>

  const replyResult = await createPetChatReply({
    petName: pet.value.name,
    personaPrompt: petPersonaPrompt.value,
    language: settings.value.language,
    userMessage: trimmed,
    messages: conversation,
    fallbackEmotion: emotionTag,
  }).catch(() => ({ content: fallbackReply }))

  const reply = replyResult.content

  if (replyResult.history?.length) {
    messages.value = mapCloudHistoryToMessages(replyResult.history)
  } else {
    messages.value = [
      ...messages.value,
      {
        id: createId('msg'),
        sessionId: CHAT_SESSION_ID,
        role: 'assistant',
        content: reply,
        emotionTag,
        encrypted,
        createdAt: nowIso(),
      },
    ].slice(-MAX_CHAT_HISTORY)
  }

  metrics.value = {
    ...metrics.value,
    interactions: metrics.value.interactions + 1,
    companionMinutes: metrics.value.companionMinutes + 8,
  }

  const chatImpact: Record<EmotionTag, Partial<Pet>> = {
    happy: { mood: pet.value.mood + 6, intimacy: pet.value.intimacy + 2 },
    proud: { mood: pet.value.mood + 8, intimacy: pet.value.intimacy + 4 },
    upset: { mood: pet.value.mood + 5, intimacy: pet.value.intimacy + 3 },
    tired: { mood: pet.value.mood + 4, energy: pet.value.energy + 3 },
    bored: { mood: pet.value.mood + 6 },
    stressed: { mood: pet.value.mood + 5, intimacy: pet.value.intimacy + 3 },
    lonely: { mood: pet.value.mood + 7, intimacy: pet.value.intimacy + 5 },
    angry: { mood: pet.value.mood + 4, health: pet.value.health + 2 },
  }

  updatePet(chatImpact[emotionTag])
  const todayKey = createdAt.slice(0, 10)
  const chatRewardRemaining = Math.max(0, 20 - (economy.value.dailyChatRewards[todayKey] ?? 0))
  const chatRewardAmount = Math.min(2, chatRewardRemaining)
  const chatReward = chatRewardAmount > 0
    ? awardCoins('chat', chatRewardAmount, `chat:${todayKey}:${userMessage.id}`)
    : { awarded: false, amount: 0, coins: economy.value.coins }

  if (chatReward.awarded) {
    setEconomy({
      ...economy.value,
      dailyChatRewards: {
        ...economy.value.dailyChatRewards,
        [todayKey]: (economy.value.dailyChatRewards[todayKey] ?? 0) + chatReward.amount,
      },
    })
    persistEconomy()
  }

  logSyncEvent(settings.value.language === 'zh' ? `聊天摘要已写入联动队列：${reply}` : `Chat summary written to sync queue: ${reply}`, {
    target: settings.value.allowCrossDeviceSummary ? 'desktop' : 'miniapp',
    actionType: 'chat-summary',
    status: settings.value.allowCrossDeviceSummary ? 'success' : 'offline',
  })
  persistState()

  return {
    reply,
    coinReward: chatReward,
  }
}

const applyChatTurnEffects = (emotionTag: EmotionTag, createdAt: string, rewardId: string, reply: string) => {
  metrics.value = {
    ...metrics.value,
    interactions: metrics.value.interactions + 1,
    companionMinutes: metrics.value.companionMinutes + 8,
  }

  const chatImpact: Record<EmotionTag, Partial<Pet>> = {
    happy: { mood: pet.value.mood + 6, intimacy: pet.value.intimacy + 2 },
    proud: { mood: pet.value.mood + 8, intimacy: pet.value.intimacy + 4 },
    upset: { mood: pet.value.mood + 5, intimacy: pet.value.intimacy + 3 },
    tired: { mood: pet.value.mood + 4, energy: pet.value.energy + 3 },
    bored: { mood: pet.value.mood + 6 },
    stressed: { mood: pet.value.mood + 5, intimacy: pet.value.intimacy + 3 },
    lonely: { mood: pet.value.mood + 7, intimacy: pet.value.intimacy + 5 },
    angry: { mood: pet.value.mood + 4, health: pet.value.health + 2 },
  }

  updatePet(chatImpact[emotionTag])
  const todayKey = createdAt.slice(0, 10)
  const chatRewardRemaining = Math.max(0, 20 - (economy.value.dailyChatRewards[todayKey] ?? 0))
  const chatRewardAmount = Math.min(2, chatRewardRemaining)
  const chatReward = chatRewardAmount > 0
    ? awardCoins('chat', chatRewardAmount, `chat:${todayKey}:${rewardId}`)
    : { awarded: false, amount: 0, coins: economy.value.coins }

  if (chatReward.awarded) {
    setEconomy({
      ...economy.value,
      dailyChatRewards: {
        ...economy.value.dailyChatRewards,
        [todayKey]: (economy.value.dailyChatRewards[todayKey] ?? 0) + chatReward.amount,
      },
    })
    persistEconomy()
  }

  logSyncEvent(settings.value.language === 'zh' ? `聊天摘要已写入联动队列：${reply}` : `Chat summary written to sync queue: ${reply}`, {
    target: settings.value.allowCrossDeviceSummary ? 'desktop' : 'miniapp',
    actionType: 'chat-summary',
    status: settings.value.allowCrossDeviceSummary ? 'success' : 'offline',
  })

  return chatReward
}

const sendVoiceChatTurn = async (tempFilePath: string) => {
  hydrateState()
  await hydrateCloudChatHistory()

  const conversation = messages.value
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: item.content,
    })) as Array<{ role: 'user' | 'assistant'; content: string }>

  const result = await sendPetVoiceTurn({
    tempFilePath,
    petName: pet.value.name,
    personaPrompt: petPersonaPrompt.value,
    language: settings.value.language,
    messages: conversation,
  })

  const createdAt = nowIso()
  const emotionTag = inferEmotion(result.transcript)

  if (result.history?.length) {
    messages.value = mapCloudHistoryToMessages(result.history)
  } else {
    messages.value = [
      ...messages.value,
      {
        id: createId('msg'),
        sessionId: CHAT_SESSION_ID,
        role: 'user',
        content: result.transcript,
        emotionTag,
        encrypted: settings.value.hideChats,
        createdAt,
      },
      {
        id: createId('msg'),
        sessionId: CHAT_SESSION_ID,
        role: 'assistant',
        content: result.reply,
        emotionTag,
        encrypted: false,
        createdAt: nowIso(),
      },
    ].slice(-MAX_CHAT_HISTORY)
  }

  const coinReward = applyChatTurnEffects(emotionTag, createdAt, `voice:${createId('voice')}`, result.reply)
  persistState()

  return {
    ...result,
    coinReward,
  }
}

const clearMessages = () => {
  hydrateState()
  if (!settings.value.allowChatClear) return

  messages.value = [
    {
      id: createId('msg'),
      sessionId: CHAT_SESSION_ID,
      role: 'assistant',
      content: copy[settings.value.language].home.assistantFallback,
      emotionTag: 'happy',
      encrypted: false,
      createdAt: nowIso(),
    },
  ]
  void clearPetChatHistoryFromCloud()
  logSyncEvent(settings.value.language === 'zh' ? '聊天记录已清空，本次操作仅保留系统欢迎语。' : 'Chat history cleared. Only the welcome message remains.', {
    target: 'miniapp',
    actionType: 'chat-clear',
  })
  persistState()
}

const updateSettings = (changes: Partial<UserSettings>) => {
  hydrateState()
  settings.value = {
    ...settings.value,
    ...changes,
  }
  persistState()
}

const syncPetFromAuth = (remotePet?: {
  name?: string
  stage?: PetStage
  mood?: number
  health?: number
  hunger?: number
  energy?: number
  intimacy?: number
  cleanliness?: number
}) => {
  if (!remotePet) return

  updatePet({
    mood: remotePet.mood ?? pet.value.mood,
    health: remotePet.health ?? pet.value.health,
    hunger: remotePet.hunger ?? pet.value.hunger,
    energy: remotePet.energy ?? pet.value.energy,
    intimacy: remotePet.intimacy ?? pet.value.intimacy,
    clean: remotePet.cleanliness ?? pet.value.clean,
    name: remotePet.name || pet.value.name,
  })

  if (remotePet.stage) {
    pet.value = {
      ...pet.value,
      stage: remotePet.stage,
    }
    persistState()
  }
}

const runDemoScenario = (scenario: 'reminder' | 'taskComplete' | 'comfort' | 'offline' | 'reconnect' | 'reset') => {
  hydrateState()

  if (scenario === 'reminder') {
    const pendingTask = tasks.value.find((item) => item.status === 'pending')
    if (pendingTask) {
      logSyncEvent(settings.value.language === 'zh' ? '任务「' + pendingTask.title + '」到点，已触发柔和提醒。' : 'Task "' + pendingTask.title + '" is due. A gentle reminder was triggered.', {
        target: 'desktop',
        actionType: 'task-reminder',
        status: 'success',
      })
      updatePet({ mood: pet.value.mood - 1 })
    }
  }

  if (scenario === 'taskComplete') {
    const pendingTask = tasks.value.find((item) => item.status === 'pending')
    if (pendingTask) {
      setTaskStatus(pendingTask.id, 'completed')
    }
  }

  if (scenario === 'comfort') {
    void sendChatMessage(settings.value.language === 'zh' ? '今天压力有点大，但我还是想努力一下。' : 'I feel stressed today, but I still want to try.', 'stressed')
  }

  if (scenario === 'offline') {
    devices.value = devices.value.map((item) =>
      item.deviceType === 'm5'
        ? { ...item, online: false, charging: false, lastSyncAt: nowIso() }
        : item,
    )
    logSyncEvent(settings.value.language === 'zh' ? 'M5StickS3 暂时离线，系统保留本地缓存并等待重连。' : 'M5StickS3 is temporarily offline. Local cache is kept while waiting to reconnect.', {
      source: 'm5',
      target: 'miniapp',
      actionType: 'hardware-offline',
      status: 'offline',
    })
  }

  if (scenario === 'reconnect') {
    devices.value = devices.value.map((item) =>
      item.deviceType === 'm5'
        ? { ...item, online: true, charging: true, battery: Math.max(42, item.battery), lastSyncAt: nowIso() }
        : item,
    )
    logSyncEvent(settings.value.language === 'zh' ? 'M5StickS3 已恢复连接，离线期间状态已补同步。' : 'M5StickS3 reconnected. Offline state has been synced.', {
      source: 'm5',
      target: 'miniapp',
      actionType: 'hardware-reconnect',
      status: 'success',
    })
  }

  if (scenario === 'reset') {
    const preservedLanguage = settings.value.language
    applySnapshot()
    settings.value.language = preservedLanguage
  }

  persistState()
}

const pendingTasks = computed(() => tasks.value.filter((item) => item.status === 'pending'))
const completedTasks = computed(() => tasks.value.filter((item) => item.status === 'completed'))
const todayTasks = computed(() =>
  tasks.value
    .filter((item) => item.status === 'pending')
    .slice()
    .sort((left, right) => `${left.dueDate ?? ''} ${left.time}`.localeCompare(`${right.dueDate ?? ''} ${right.time}`)),
)
const inboxTasks = computed(() => tasks.value.filter((item) => item.status === 'pending' && !(item.isStarred ?? false)))
const upcomingTasks = computed(() =>
  tasks.value
    .filter((item) => item.status === 'pending' || item.status === 'delayed')
    .slice()
    .sort((left, right) => `${left.dueDate ?? ''} ${left.time}`.localeCompare(`${right.dueDate ?? ''} ${right.time}`)),
)
const dueSoonTasks = computed(() => upcomingTasks.value.slice(0, 3))
const completedTodayCount = computed(() => completedTasks.value.length)
const recentReminders = computed(() => {
  const isZh = settings.value.language === 'zh'
  const taskReminders = tasks.value
    .filter((item) => item.status === 'pending' || item.status === 'delayed')
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.time + ' · ' + (item.status === 'delayed' ? (isZh ? '已延后，等待追提醒' : 'Delayed, waiting for follow-up') : (isZh ? '待执行' : 'Pending')),
      badge: item.status === 'delayed' ? (isZh ? '追提醒' : 'Follow-up') : (isZh ? '待办' : 'Todo'),
      tone: item.status === 'delayed' ? 'peach' : 'mint',
    }))

  const eventReminders = syncEvents.value.slice(0, 2).map((event) => ({
    id: event.id,
    title: event.actionType,
    subtitle: event.summary,
    badge: event.status === 'success' ? (isZh ? '已同步' : 'Synced') : event.status === 'offline' ? (isZh ? '离线' : 'Offline') : (isZh ? '重试中' : 'Retrying'),
    tone: event.status === 'success' ? 'sun' : event.status === 'offline' ? 'peach' : 'mint',
  }))

  return [...taskReminders, ...eventReminders].slice(0, 4)
})

const weeklyCompletionRate = computed(() => {
  const total = tasks.value.length || 1
  return Math.round((completedTasks.value.length / total) * 100)
})

const overviewStats = computed(() => [
  {
    key: 'completion',
    label: settings.value.language === 'zh' ? '本周完成率' : 'Weekly completion',
    value: `${weeklyCompletionRate.value}%`,
    hint: completedTasks.value.length > 0 ? (settings.value.language === 'zh' ? '任务闭环已形成' : 'Task loop is forming') : (settings.value.language === 'zh' ? '先完成第一项计划' : 'Complete the first plan'),
  },
  {
    key: 'mood',
    label: settings.value.language === 'zh' ? '平均心情值' : 'Average mood',
    value: `${pet.value.mood}`,
    hint: pet.value.mood >= 75 ? (settings.value.language === 'zh' ? '情绪整体稳定' : 'Mood is generally stable') : (settings.value.language === 'zh' ? '建议多进行陪伴互动' : 'More companion interaction suggested'),
  },
  {
    key: 'intimacy',
    label: settings.value.language === 'zh' ? '当前亲密度' : 'Current intimacy',
    value: `${pet.value.intimacy}`,
    hint: pet.value.intimacy >= 60 ? (settings.value.language === 'zh' ? '关系正在升温' : 'Bond is warming up') : (settings.value.language === 'zh' ? '继续完成计划和聊天' : 'Keep completing plans and chatting'),
  },
])

hydrateState()
if (shouldUseCloudSync()) {
  void hydrateCloudChatHistory()
  void hydrateCloudTasks()
  void hydrateCloudCourseSchedule()
  void hydrateEconomyFromCloud()
}

watch(
  () => [authMode.value, isMockSession.value] as const,
  ([mode, mock]) => {
    if (mode === 'wechat' && !mock) {
      void syncEconomyFromCloud()
    }
  },
  { immediate: true },
)

export const useKokoState = () => ({
  pet,
  tasks,
  courseSchedule,
  messages,
  devices,
  syncEvents,
  settings,
  archive,
  snapshots,
  metrics,
  economy,
  shopItems,
  petPersonaPrompt,
  pendingTasks,
  completedTasks,
  todayTasks,
  inboxTasks,
  upcomingTasks,
  dueSoonTasks,
  completedTodayCount,
  recentReminders,
  weeklyCompletionRate,
  overviewStats,
  hydrateState,
  carePet,
  getCareResource,
  useCareResource,
  canUseCareAction,
  applyMiniGameReward,
  createTask,
  updateTask,
  deleteTask,
  setCourseSchedule,
  clearCourseSchedule,
  syncCourseScheduleFromCloud,
  syncTasksFromCloud,
  syncEconomyFromCloud,
  hydrateEconomyFromCloud,
  persistEconomyToCloud,
  awardCoins,
  addCoinLog,
  ensureCoinLogBackfill,
  ensureCoinLogIntegrity,
  purchaseShopItem,
  calculateTaskCoinReward,
  completeTaskWithReward: (taskId: string) => setTaskStatus(taskId, 'completed'),
  setTaskStatus,
  getPetQuickReply,
  sendChatMessage,
  sendVoiceChatTurn,
  clearMessages,
  updateSettings,
  setPetPersonaPrompt,
  runDemoScenario,
  syncPetFromAuth,
  updatePet,
  getDigestStatus,
  setActiveMiniGame,
  triggerHardwareAction,
  receiveHardwareInput,
  setPetRotationFrame,
  petRotationFrames: PET_ROTATION_FRAMES,
  feedDigestMs: FEED_DIGEST_MS,
})

