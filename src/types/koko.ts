export type PetSpecies = 'cat' | 'dog' | 'spirit' | 'mochi'
export type PetStage = 'egg' | 'baby' | 'growing' | 'adult'
export type PetState = 'normal' | 'hungry' | 'tired' | 'low' | 'sick' | 'resting'
export type TaskCategory = 'schedule' | 'study' | 'work' | 'health' | 'life'
export type TaskRepeatType = 'once' | 'daily' | 'weekly'
export type TaskStatus = 'pending' | 'completed' | 'delayed' | 'skipped'
export type RewardType = 'snack' | 'coin' | 'toy' | 'mood' | 'bond'
export type TaskPriority = 'low' | 'medium' | 'high'
export type EmotionTag =
  | 'happy'
  | 'upset'
  | 'tired'
  | 'bored'
  | 'stressed'
  | 'lonely'
  | 'proud'
  | 'angry'
export type DeviceType = 'miniapp' | 'desktop' | 'm5'
export type SyncStatus = 'success' | 'offline' | 'retrying'

export interface Pet {
  id: string
  name: string
  species: PetSpecies
  stage: PetStage
  state: PetState
  health: number
  mood: number
  hunger: number
  energy: number
  intimacy: number
  clean: number
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  notes?: string
  category: TaskCategory
  time: string
  dueDate?: string
  repeatType: TaskRepeatType
  status: TaskStatus
  priority?: TaskPriority
  isStarred?: boolean
  rewardType: RewardType
  subtasks?: Array<{
    id: string
    title: string
    completed: boolean
  }>
  createdAt: string
  completedAt?: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  emotionTag: EmotionTag
  encrypted: boolean
  createdAt: string
}

export interface DeviceStatus {
  deviceId: string
  deviceType: DeviceType
  online: boolean
  battery: number
  charging: boolean
  lastSyncAt: string
  terminalRole: string
}

export interface SyncEvent {
  id: string
  source: DeviceType
  target: DeviceType
  actionType: string
  summary: string
  timestamp: string
  status: SyncStatus
}

export interface UserSettings {
  language: 'zh' | 'en'
  hideChats: boolean
  allowChatClear: boolean
  allowCrossDeviceSummary: boolean
  lowDisturbanceMode: boolean
  demoMode: boolean
}

export interface ArchiveMilestone {
  id: string
  title: string
  description: string
  timestamp: string
}

export interface MedicalLog {
  id: string
  note: string
  timestamp: string
}

export interface PetArchive {
  adoptedAt: string
  stageHistory: Array<{ stage: PetStage; timestamp: string }>
  milestones: ArchiveMilestone[]
  medicalLogs: MedicalLog[]
}

export interface DailySnapshot {
  id: string
  label: string
  mood: number
  intimacy: number
  completionRate: number
  interactions: number
}

export interface AppMetrics {
  interactions: number
  completedTasks: number
  companionMinutes: number
  coins: number
}
