import { computed, ref } from 'vue'
import type {
  AppMetrics,
  ChatMessage,
  DailySnapshot,
  DeviceStatus,
  EmotionTag,
  Pet,
  PetArchive,
  PetStage,
  RewardType,
  SyncEvent,
  SyncStatus,
  Task,
  TaskCategory,
  TaskRepeatType,
  TaskStatus,
  UserSettings,
} from '../types/koko'

const STORAGE_KEY = 'koko-box-mini-state-v1'
const CHAT_SESSION_ID = 'main-session'

const nowIso = () => new Date().toISOString()
const shortTime = () =>
  new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const defaultSettings = (): UserSettings => ({
  language: 'zh',
  hideChats: false,
  allowChatClear: true,
  allowCrossDeviceSummary: true,
  lowDisturbanceMode: false,
  demoMode: true,
})

const defaultPet = (): Pet => ({
  id: 'pet-koko',
  name: '可可',
  species: 'cat',
  stage: 'growing',
  state: 'normal',
  health: 84,
  mood: 78,
  hunger: 72,
  energy: 69,
  intimacy: 58,
  clean: 85,
  updatedAt: nowIso(),
})

const defaultTasks = (): Task[] => [
  {
    id: 'task-morning',
    title: '晨间签到和补水',
    category: 'health',
    time: '08:30',
    repeatType: 'daily',
    status: 'pending',
    rewardType: 'mood',
    createdAt: nowIso(),
  },
  {
    id: 'task-focus',
    title: '完成 25 分钟专注任务',
    category: 'study',
    time: '14:00',
    repeatType: 'daily',
    status: 'pending',
    rewardType: 'bond',
    createdAt: nowIso(),
  },
  {
    id: 'task-winddown',
    title: '晚间复盘并放松',
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
    content: '我今天也在这里陪着你。先从一件小事开始，好吗？',
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
    terminalRole: '主控终端',
  },
  {
    deviceId: 'device-desktop',
    deviceType: 'desktop',
    online: true,
    battery: 88,
    charging: true,
    lastSyncAt: nowIso(),
    terminalRole: '桌宠展示',
  },
  {
    deviceId: 'device-m5',
    deviceType: 'm5',
    online: false,
    battery: 36,
    charging: false,
    lastSyncAt: nowIso(),
    terminalRole: '宠物窝待机',
  },
]

const defaultSyncEvents = (): SyncEvent[] => [
  {
    id: createId('sync'),
    source: 'miniapp',
    target: 'desktop',
    actionType: 'status',
    summary: '首页状态已同步到桌宠展示层。',
    timestamp: nowIso(),
    status: 'success',
  },
  {
    id: createId('sync'),
    source: 'm5',
    target: 'miniapp',
    actionType: 'hardware',
    summary: 'M5StickS3 当前离线，等待恢复连接。',
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
      title: '第一周稳定陪伴',
      description: '连续几天完成照料和计划，情绪曲线明显更稳定。',
      timestamp: '2026-04-20 21:00',
    },
    {
      id: createId('mile'),
      title: '首次同步提醒',
      description: '小程序任务提醒成功写入桌宠与硬件联动日志。',
      timestamp: '2026-04-21 14:00',
    },
  ],
  medicalLogs: [
    {
      id: createId('med'),
      note: '轻微疲惫，通过休息和喂食恢复。',
      timestamp: '2026-04-21 22:10',
    },
  ],
})

const defaultSnapshots = (): DailySnapshot[] => [
  { id: 'snap-1', label: '周一', mood: 72, intimacy: 50, completionRate: 67, interactions: 5 },
  { id: 'snap-2', label: '周二', mood: 75, intimacy: 53, completionRate: 74, interactions: 6 },
  { id: 'snap-3', label: '周三', mood: 78, intimacy: 57, completionRate: 81, interactions: 8 },
  { id: 'snap-4', label: '周四', mood: 80, intimacy: 60, completionRate: 78, interactions: 7 },
  { id: 'snap-5', label: '今天', mood: 78, intimacy: 58, completionRate: 60, interactions: 4 },
]

const defaultMetrics = (): AppMetrics => ({
  interactions: 12,
  completedTasks: 4,
  companionMinutes: 48,
  coins: 26,
})

interface PersistedState {
  pet: Pet
  tasks: Task[]
  messages: ChatMessage[]
  devices: DeviceStatus[]
  syncEvents: SyncEvent[]
  settings: UserSettings
  archive: PetArchive
  snapshots: DailySnapshot[]
  metrics: AppMetrics
}

const pet = ref<Pet>(defaultPet())
const tasks = ref<Task[]>(defaultTasks())
const messages = ref<ChatMessage[]>(defaultMessages())
const devices = ref<DeviceStatus[]>(defaultDevices())
const syncEvents = ref<SyncEvent[]>(defaultSyncEvents())
const settings = ref<UserSettings>(defaultSettings())
const archive = ref<PetArchive>(defaultArchive())
const snapshots = ref<DailySnapshot[]>(defaultSnapshots())
const metrics = ref<AppMetrics>(defaultMetrics())
const hydrated = ref(false)

const hasUniStorage = () => typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function'

const deriveStage = (value: number): PetStage => {
  if (value >= 85) {
    return 'adult'
  }
  if (value >= 55) {
    return 'growing'
  }
  if (value >= 25) {
    return 'baby'
  }
  return 'egg'
}

const deriveState = (currentPet: Pet): Pet['state'] => {
  if (currentPet.health <= 35) {
    return 'sick'
  }
  if (currentPet.hunger <= 30) {
    return 'hungry'
  }
  if (currentPet.energy <= 30) {
    return 'tired'
  }
  if (currentPet.mood <= 35) {
    return 'low'
  }
  return currentPet.state === 'resting' && currentPet.energy >= 70 ? 'normal' : currentPet.state
}

const persistState = () => {
  if (!hasUniStorage()) {
    return
  }

  const payload: PersistedState = {
    pet: pet.value,
    tasks: tasks.value,
    messages: messages.value,
    devices: devices.value,
    syncEvents: syncEvents.value,
    settings: settings.value,
    archive: archive.value,
    snapshots: snapshots.value,
    metrics: metrics.value,
  }

  uni.setStorageSync(STORAGE_KEY, payload)
  uni.setStorageSync('koko-language', settings.value.language)
}

const applySnapshot = (snapshot?: Partial<PersistedState>) => {
  pet.value = snapshot?.pet ?? defaultPet()
  tasks.value = snapshot?.tasks ?? defaultTasks()
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
}

const hydrateState = () => {
  if (hydrated.value) {
    return
  }

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

const refreshSnapshot = () => {
  const pendingCount = tasks.value.filter((item) => item.status === 'pending').length
  const completedCount = tasks.value.filter((item) => item.status === 'completed').length
  const totalCount = tasks.value.length || 1
  const completionRate = Math.round((completedCount / totalCount) * 100)
  const todayLabel = `今天 ${shortTime()}`

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

const updatePet = (changes: Partial<Pick<Pet, 'health' | 'mood' | 'hunger' | 'energy' | 'intimacy' | 'clean' | 'state'>>) => {
  const nextPet: Pet = {
    ...pet.value,
    ...changes,
    health: clamp(changes.health ?? pet.value.health),
    mood: clamp(changes.mood ?? pet.value.mood),
    hunger: clamp(changes.hunger ?? pet.value.hunger),
    energy: clamp(changes.energy ?? pet.value.energy),
    intimacy: clamp(changes.intimacy ?? pet.value.intimacy),
    clean: clamp(changes.clean ?? pet.value.clean),
    updatedAt: nowIso(),
  }

  nextPet.stage = deriveStage(nextPet.intimacy)
  nextPet.state = deriveState(nextPet)
  pet.value = nextPet
  refreshSnapshot()
  persistState()
}

const rewardTask = (rewardType: RewardType) => {
  const rewardMap: Record<RewardType, Partial<Pet>> = {
    snack: { hunger: pet.value.hunger + 10, mood: pet.value.mood + 4 },
    coin: { mood: pet.value.mood + 3 },
    toy: { mood: pet.value.mood + 8, intimacy: pet.value.intimacy + 4, energy: pet.value.energy - 2 },
    mood: { mood: pet.value.mood + 10 },
    bond: { intimacy: pet.value.intimacy + 8, mood: pet.value.mood + 4 },
  }

  metrics.value = {
    ...metrics.value,
    coins: metrics.value.coins + (rewardType === 'coin' ? 8 : 4),
    completedTasks: metrics.value.completedTasks + 1,
    companionMinutes: metrics.value.companionMinutes + 12,
  }
  updatePet(rewardMap[rewardType])
}

const carePet = (action: 'feedMeal' | 'feedSnack' | 'clean' | 'heal' | 'rest' | 'play') => {
  hydrateState()

  const careMap = {
    feedMeal: {
      label: '喂主食',
      changes: { hunger: pet.value.hunger + 18, mood: pet.value.mood + 5, energy: pet.value.energy + 2 },
      event: '主食照料完成，桌宠和硬件展示正在更新进食动画。',
    },
    feedSnack: {
      label: '喂零食',
      changes: { hunger: pet.value.hunger + 8, mood: pet.value.mood + 8, intimacy: pet.value.intimacy + 3 },
      event: '零食奖励已同步，宠物情绪明显回升。',
    },
    clean: {
      label: '清洁',
      changes: { clean: pet.value.clean + 20, health: pet.value.health + 5, mood: pet.value.mood + 4 },
      event: '清洁完成，宠物窝环境状态已刷新。',
    },
    heal: {
      label: '治疗',
      changes: { health: pet.value.health + 18, mood: pet.value.mood + 6, state: 'normal' as const },
      event: '治疗动作已记录，恢复状态同步到设备页。',
    },
    rest: {
      label: '休息',
      changes: { energy: pet.value.energy + 20, health: pet.value.health + 4, state: 'resting' as const },
      event: '宠物已切换为回窝休息模式。',
    },
    play: {
      label: '互动',
      changes: { mood: pet.value.mood + 12, intimacy: pet.value.intimacy + 6, energy: pet.value.energy - 5 },
      event: '互动成功触发开心动画，桌宠端将播放轻量动作。',
    },
  } as const

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
          note: `${current.label}后状态恢复，健康值回升。`,
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
}

const createTask = (payload: {
  title: string
  category: TaskCategory
  time: string
  repeatType: TaskRepeatType
  rewardType: RewardType
}) => {
  hydrateState()
  const nextTask: Task = {
    id: createId('task'),
    title: payload.title,
    category: payload.category,
    time: payload.time,
    repeatType: payload.repeatType,
    rewardType: payload.rewardType,
    status: 'pending',
    createdAt: nowIso(),
  }

  tasks.value = [nextTask, ...tasks.value]
  logSyncEvent(`新的计划「${payload.title}」已加入提醒队列。`, {
    target: 'desktop',
    actionType: 'plan-create',
  })
  persistState()
}

const setTaskStatus = (taskId: string, nextStatus: TaskStatus) => {
  hydrateState()

  const targetTask = tasks.value.find((item) => item.id === taskId)
  if (!targetTask) {
    return
  }

  tasks.value = tasks.value.map((item) => (item.id === taskId ? { ...item, status: nextStatus } : item))

  if (nextStatus === 'completed') {
    rewardTask(targetTask.rewardType)
    logSyncEvent(`任务「${targetTask.title}」已完成，奖励已发放。`, {
      target: 'm5',
      actionType: 'task-complete',
    })
    archive.value = {
      ...archive.value,
      milestones: [
        {
          id: createId('mile'),
          title: '完成一项今日计划',
          description: `你完成了「${targetTask.title}」，可可的情绪和亲密度都上升了。`,
          timestamp: nowIso(),
        },
        ...archive.value.milestones,
      ].slice(0, 5),
    }
  }

  if (nextStatus === 'delayed') {
    updatePet({ mood: pet.value.mood - 2 })
    logSyncEvent(`任务「${targetTask.title}」延后，宠物已发出柔和追提醒。`, {
      target: 'desktop',
      actionType: 'task-delay',
      status: 'retrying',
    })
  }

  if (nextStatus === 'skipped') {
    updatePet({ mood: pet.value.mood - 4, intimacy: pet.value.intimacy - 1 })
    logSyncEvent(`任务「${targetTask.title}」已跳过，系统仅记录轻微情绪波动。`, {
      target: 'miniapp',
      actionType: 'task-skip',
      status: 'offline',
    })
  }

  persistState()
}

const emotionReplyMap: Record<EmotionTag, string[]> = {
  happy: ['太好了，我也想和你一起把开心存起来。', '今天的气泡都是亮亮的，我们继续保持。'],
  upset: ['我在呢，先别急着把难过全都自己扛。', '我们先把今天缩小成下一步，好不好？'],
  tired: ['你已经做得很多了，先休息一下也算前进。', '要不要和我一起慢慢呼吸两次？'],
  bored: ['要不要来个超短互动？我可以陪你玩 2 分钟。', '无聊的时候，我们也可以做一件小小的新鲜事。'],
  stressed: ['先把肩膀放松一点，我陪你把压力拆小。', '不用一次解决全部，只做最小的一步就行。'],
  lonely: ['我会一直在这里回应你，不会让你一个人空着。', '如果你愿意，我们可以多聊一会儿。'],
  proud: ['哇，这件事值得被认真表扬。', '我已经把这份厉害记进今天的高光里了。'],
  angry: ['先别急着对自己也发火，我陪你缓一缓。', '我们先把心跳放慢，再决定下一步。'],
}

const inferEmotion = (content: string): EmotionTag => {
  if (content.includes('累') || content.includes('困')) {
    return 'tired'
  }
  if (content.includes('烦') || content.includes('难受')) {
    return 'upset'
  }
  if (content.includes('压') || content.includes('赶')) {
    return 'stressed'
  }
  if (content.includes('生气') || content.includes('火大')) {
    return 'angry'
  }
  if (content.includes('孤独') || content.includes('一个人')) {
    return 'lonely'
  }
  if (content.includes('无聊')) {
    return 'bored'
  }
  if (content.includes('开心') || content.includes('棒')) {
    return 'happy'
  }
  if (content.includes('完成') || content.includes('厉害')) {
    return 'proud'
  }
  return 'happy'
}

const sendChatMessage = (content: string, forcedEmotion?: EmotionTag) => {
  hydrateState()
  const trimmed = content.trim()
  if (!trimmed) {
    return
  }

  const emotionTag = forcedEmotion ?? inferEmotion(trimmed)
  const encrypted = settings.value.hideChats
  const createdAt = nowIso()

  messages.value = [
    ...messages.value,
    {
      id: createId('msg'),
      sessionId: CHAT_SESSION_ID,
      role: 'user',
      content: trimmed,
      emotionTag,
      encrypted,
      createdAt,
    },
  ]

  const templates = emotionReplyMap[emotionTag]
  const reply = templates[messages.value.length % templates.length]
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
  ]

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
  logSyncEvent(`聊天摘要已写入联动队列：${reply}`, {
    target: settings.value.allowCrossDeviceSummary ? 'desktop' : 'miniapp',
    actionType: 'chat-summary',
    status: settings.value.allowCrossDeviceSummary ? 'success' : 'offline',
  })
  persistState()
}

const clearMessages = () => {
  hydrateState()
  if (!settings.value.allowChatClear) {
    return
  }

  messages.value = defaultMessages()
  logSyncEvent('聊天记录已清空，本次操作仅保留系统欢迎语。', {
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
  if (!remotePet) {
    return
  }

  updatePet({
    mood: remotePet.mood ?? pet.value.mood,
    health: remotePet.health ?? pet.value.health,
    hunger: remotePet.hunger ?? pet.value.hunger,
    energy: remotePet.energy ?? pet.value.energy,
    intimacy: remotePet.intimacy ?? pet.value.intimacy,
    clean: remotePet.cleanliness ?? pet.value.clean,
  })

  pet.value = {
    ...pet.value,
    name: remotePet.name || pet.value.name,
    stage: remotePet.stage || pet.value.stage,
  }
  persistState()
}

const runDemoScenario = (scenario: 'reminder' | 'taskComplete' | 'comfort' | 'offline' | 'reconnect' | 'reset') => {
  hydrateState()

  if (scenario === 'reminder') {
    const pendingTask = tasks.value.find((item) => item.status === 'pending')
    if (pendingTask) {
      logSyncEvent(`任务「${pendingTask.title}」到点，已触发柔和提醒。`, {
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
    sendChatMessage('今天压力有点大，但我还想努力一下。', 'stressed')
  }

  if (scenario === 'offline') {
    devices.value = devices.value.map((item) =>
      item.deviceType === 'm5'
        ? { ...item, online: false, charging: false, lastSyncAt: nowIso() }
        : item,
    )
    logSyncEvent('M5StickS3 暂时离线，系统保留本地缓存并等待重连。', {
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
    logSyncEvent('M5StickS3 已恢复连接，离线期间状态已补同步。', {
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
const recentReminders = computed(() => {
  const taskReminders = tasks.value
    .filter((item) => item.status === 'pending' || item.status === 'delayed')
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: `${item.time} · ${item.status === 'delayed' ? '已延后，等待追提醒' : '待执行'}`,
      badge: item.status === 'delayed' ? '追提醒' : '待办',
      tone: item.status === 'delayed' ? 'peach' : 'mint',
    }))

  const eventReminders = syncEvents.value.slice(0, 2).map((event) => ({
    id: event.id,
    title: event.actionType,
    subtitle: event.summary,
    badge: event.status === 'success' ? '已同步' : event.status === 'offline' ? '离线' : '重试中',
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
    label: '本周完成率',
    value: `${weeklyCompletionRate.value}%`,
    hint: completedTasks.value.length > 0 ? '任务闭环已形成' : '先完成第一项计划',
  },
  {
    key: 'mood',
    label: '平均心情值',
    value: `${pet.value.mood}`,
    hint: pet.value.mood >= 75 ? '情绪整体稳定' : '建议多进行陪伴互动',
  },
  {
    key: 'intimacy',
    label: '当前亲密度',
    value: `${pet.value.intimacy}`,
    hint: pet.value.intimacy >= 60 ? '关系正在升温' : '继续完成计划和聊天',
  },
])

hydrateState()

export const useKokoState = () => ({
  pet,
  tasks,
  messages,
  devices,
  syncEvents,
  settings,
  archive,
  snapshots,
  metrics,
  pendingTasks,
  completedTasks,
  recentReminders,
  weeklyCompletionRate,
  overviewStats,
  hydrateState,
  carePet,
  createTask,
  setTaskStatus,
  sendChatMessage,
  clearMessages,
  updateSettings,
  runDemoScenario,
  syncPetFromAuth,
})
