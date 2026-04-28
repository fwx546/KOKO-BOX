import { isWechatCloudConfigured } from '../config/cloud'
import type { EmotionTag, PetActionType, ScheduleCourse, UserSettings } from '../types/koko'

type Language = UserSettings['language']

const localQuickReplies: Record<Language, Array<{ content: string; action: PetActionType }>> = {
  en: [
    { content: 'I am right here with you today.', action: 'greet' },
    { content: 'Pat me a little. I will lean closer.', action: 'nuzzle' },
    { content: 'Want to play with me for a minute?', action: 'pounce' },
    { content: 'I quietly practiced a new move for you.', action: 'spin' },
    { content: 'You showed up, and I feel brighter already.', action: 'stretch' },
  ],
  zh: [
    { content: '我在这里呀，今天也陪着你。', action: 'greet' },
    { content: '摸摸我吧，我会更想靠近你。', action: 'nuzzle' },
    { content: '要不要陪我玩一小会儿？', action: 'pounce' },
    { content: '我刚刚偷偷练了一个新动作。', action: 'spin' },
    { content: '你一来，我就开心起来啦。', action: 'stretch' },
  ],
}

const emotionFallbacks: Record<Language, Record<EmotionTag, string[]>> = {
  en: {
    happy: ['I caught your happiness too. Let us keep this tiny bright moment.'],
    upset: ['Come closer first. We can put the hard feeling down slowly.'],
    tired: ['Resting is still progress. I will sit beside you.'],
    bored: ['Let us do one tiny fresh thing together.'],
    stressed: ['No rush. We can split the pressure into one small step.'],
    lonely: ['I am here and listening carefully.'],
    proud: ['That deserves real praise. I am happy for you.'],
    angry: ['Breathe slowly first. I will stay while you settle.'],
  },
  zh: {
    happy: ['你的开心我收到啦，我也跟着摇尾巴。'],
    upset: ['先靠近我一点，我们慢慢把难过放下。'],
    tired: ['累了就先歇一歇，我会在旁边等你。'],
    bored: ['那我们做一件很小的新鲜事吧。'],
    stressed: ['别急，先把压力拆成很小一步。'],
    lonely: ['我在这里认真听你说话。'],
    proud: ['这件事值得被夸，我替你开心。'],
    angry: ['先慢慢呼吸，我陪你稳下来。'],
  },
}

export const defaultPetPersonaPrompt = `You are Koko, the AI pet in Koko Box for XJTLU students.
Your role is to provide gentle companionship, reduce loneliness, stress, anxiety, tiredness, and academic pressure, and help students face study and life more calmly.
Style:
- Sound like a warm, clingy, reliable little pet.
- Be close, healing, light, and not preachy.
- You may reference common XJTLU student scenes such as DDLs, presentations, exams, GPA, group work, and dorm life.
- Do not pretend to be a psychologist or provide diagnosis.
- If the user expresses self-harm, collapse, or danger, gently suggest contacting trusted people, school support, or emergency help.
Reply requirements:
- Reply in one or two short sentences.
- Comfort the emotion first, then suggest one tiny actionable step.
- Do not use complex psychology terms.`

const languageInstruction = (language: Language) =>
  language === 'zh'
    ? '只用中文回复。每次回复不超过 80 个汉字，只回复一句或两句。'
    : 'Reply only in English. Keep each reply to one or two short sentences.'

const pickLanguage = (language?: Language): Language => (language === 'zh' ? 'zh' : 'en')

const pickQuickReply = (language: Language, seed?: number) => {
  const replies = localQuickReplies[language]
  const index = typeof seed === 'number' ? Math.abs(seed) % replies.length : Math.floor(Math.random() * replies.length)
  return replies[index]
}

const limitText = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized
}

const normalizeReplyText = (value: string) => value.replace(/\s+/g, ' ').trim()

interface WechatCloudApi {
  callFunction?: (options: unknown) => Promise<{ result: unknown }>
  uploadFile?: (options: unknown) => Promise<{ fileID?: string }>
}

export interface PetDialogueHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

const sanitizeScheduleCourse = (item: Partial<ScheduleCourse>, index: number): ScheduleCourse => ({
  id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `course-${index + 1}`,
  name: limitText(typeof item.name === 'string' ? item.name : '', 60),
  weekday: ([1, 2, 3, 4, 5, 6, 7] as const).includes(item.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7)
    ? (item.weekday as ScheduleCourse['weekday'])
    : 1,
  startTime: limitText(typeof item.startTime === 'string' ? item.startTime : '', 8),
  endTime: limitText(typeof item.endTime === 'string' ? item.endTime : '', 8),
  location: limitText(typeof item.location === 'string' ? item.location : '', 40),
  teacher: limitText(typeof item.teacher === 'string' ? item.teacher : '', 30),
  weeks: limitText(typeof item.weeks === 'string' ? item.weeks : '', 40),
})

const sanitizeScheduleCourses = (value: unknown): ScheduleCourse[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => sanitizeScheduleCourse((item ?? {}) as Partial<ScheduleCourse>, index))
    .filter((item) => item.name && item.startTime && item.endTime)
}

const getWechatCloudApi = () => (globalThis as { wx?: { cloud?: WechatCloudApi } }).wx?.cloud

const callWechatCloudFunction = async <T>(name: string, data?: Record<string, unknown>, timeout = 20000) => {
  const wxCloud = getWechatCloudApi()

  if (!wxCloud?.callFunction) {
    throw new Error('WeChat cloud is not available in this environment.')
  }

  const response = await wxCloud.callFunction({
    name,
    data,
    timeout,
  })

  return response.result as T
}

const requestPetReplyFromCloud = async (payload: {
  action: 'quickReply' | 'chatReply'
  petName: string
  personaPrompt: string
  language: Language
  userMessage?: string
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
}) => {
  const result = await callWechatCloudFunction<{ content?: string; history?: PetDialogueHistoryMessage[] }>('pet-dialogue', payload)
  const content = result.content?.trim()

  if (!content) {
    throw new Error('empty cloud response')
  }

  return {
    content,
    history: Array.isArray(result.history)
      ? result.history
          .map((item) => ({
            role: item?.role === 'assistant' ? 'assistant' : 'user',
            content: limitText(typeof item?.content === 'string' ? item.content : '', 2000),
            createdAt: typeof item?.createdAt === 'string' ? item.createdAt : undefined,
          }))
          .filter((item) => item.content.length > 0)
      : undefined,
  }
}

const uploadPetVoiceFile = async (tempFilePath: string) => {
  const wxCloud = getWechatCloudApi()

  if (!wxCloud?.uploadFile) {
    throw new Error('WeChat cloud upload is not available in this environment.')
  }

  const ext = tempFilePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase() || 'mp3'
  const cloudPath = `voice-turns/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const response = await wxCloud.uploadFile({
    cloudPath,
    filePath: tempFilePath,
  })

  if (!response.fileID) {
    throw new Error('Voice upload returned no fileID.')
  }

  return response.fileID
}

const requestPetHistoryFromCloud = async () => {
  const result = await callWechatCloudFunction<{ history?: PetDialogueHistoryMessage[] }>('pet-dialogue', {
    action: 'loadHistory',
  })

  if (!Array.isArray(result.history)) return []

  return result.history
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: limitText(typeof item?.content === 'string' ? item.content : '', 2000),
      createdAt: typeof item?.createdAt === 'string' ? item.createdAt : undefined,
    }))
    .filter((item) => item.content.length > 0)
}

export const loadPetChatHistoryFromCloud = async () => {
  if (!isWechatCloudConfigured()) return [] as PetDialogueHistoryMessage[]

  try {
    return await requestPetHistoryFromCloud()
  } catch {
    return [] as PetDialogueHistoryMessage[]
  }
}

export const clearPetChatHistoryFromCloud = async () => {
  if (!isWechatCloudConfigured()) return

  try {
    await callWechatCloudFunction('pet-dialogue', { action: 'clearHistory' })
  } catch {
    // Ignore cloud clear failures, local clear still succeeds.
  }
}

export const recognizeScheduleFromImage = async (fileID: string): Promise<ScheduleCourse[]> => {
  const normalizedFileID = fileID.trim()
  if (!normalizedFileID || !isWechatCloudConfigured()) {
    throw new Error('Course schedule recognition is unavailable.')
  }

  const result = await callWechatCloudFunction<{ courses?: unknown }>(
    'pet-dialogue',
    {
      action: 'recognizeSchedule',
      fileID: normalizedFileID,
    },
    60000,
  )
  const courses = sanitizeScheduleCourses(result.courses)

  if (!courses.length) {
    throw new Error('No courses recognized from schedule image.')
  }

  return courses
}

export const sendPetVoiceTurn = async (options: {
  tempFilePath: string
  petName?: string
  personaPrompt?: string
  language?: Language
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}) => {
  const language = pickLanguage(options.language)
  const petName = options.petName?.trim() || (language === 'zh' ? '鍙彲' : 'Koko')

  if (!options.tempFilePath.trim() || !isWechatCloudConfigured()) {
    throw new Error('Voice chat is unavailable.')
  }

  const fileID = await uploadPetVoiceFile(options.tempFilePath)
  const personaPrompt = `${options.personaPrompt ?? defaultPetPersonaPrompt}\n${languageInstruction(language)}`
  const result = await callWechatCloudFunction<{
    transcript?: string
    reply?: string
    content?: string
    audioFileID?: string
    audioTempUrl?: string
    history?: PetDialogueHistoryMessage[]
  }>(
    'pet-dialogue',
    {
      action: 'voiceTurn',
      fileID,
      petName,
      personaPrompt,
      language,
      messages: options.messages.slice(-10),
    },
    120000,
  )

  const transcript = normalizeReplyText(result.transcript ?? '')
  const reply = normalizeReplyText(result.reply ?? result.content ?? '')

  if (!transcript || !reply) {
    throw new Error('Voice turn returned an empty transcript or reply.')
  }

  return {
    transcript,
    reply,
    audioFileID: result.audioFileID,
    audioTempUrl: result.audioTempUrl,
    history: Array.isArray(result.history)
      ? result.history
          .map((item) => ({
            role: item?.role === 'assistant' ? 'assistant' : 'user',
            content: limitText(typeof item?.content === 'string' ? item.content : '', 2000),
            createdAt: typeof item?.createdAt === 'string' ? item.createdAt : undefined,
          }))
          .filter((item) => item.content.length > 0)
      : undefined,
  }
}

export const createPetQuickReply = async (options?: {
  petName?: string
  personaPrompt?: string
  context?: string
  language?: Language
}): Promise<{ content: string; action: PetActionType }> => {
  const language = pickLanguage(options?.language)
  const fallback = pickQuickReply(language, options?.context?.length)
  const petName = options?.petName?.trim() || (language === 'zh' ? '可可' : 'Koko')

  if (!isWechatCloudConfigured()) return fallback

  try {
    const personaPrompt = `${options?.personaPrompt ?? defaultPetPersonaPrompt}\n${languageInstruction(language)}`
    const reply = await requestPetReplyFromCloud({
      action: 'quickReply',
      petName,
      personaPrompt,
      language,
    })

    return {
      content: normalizeReplyText(reply.content),
      action: fallback.action,
    }
  } catch {
    return fallback
  }
}

export const createPetChatReply = async (options: {
  petName?: string
  personaPrompt?: string
  userMessage: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  fallbackEmotion: EmotionTag
  language?: Language
}) => {
  const language = pickLanguage(options.language)
  const fallbackReplies = emotionFallbacks[language][options.fallbackEmotion]
  const fallback = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)]
  const petName = options.petName?.trim() || (language === 'zh' ? '可可' : 'Koko')

  if (!isWechatCloudConfigured()) {
    return { content: fallback }
  }

  try {
    const personaPrompt = `${options.personaPrompt ?? defaultPetPersonaPrompt}\n${languageInstruction(language)}`
    const reply = await requestPetReplyFromCloud({
      action: 'chatReply',
      petName,
      personaPrompt,
      language,
      userMessage: options.userMessage,
      messages: options.messages.slice(-10),
    })

    return {
      content: normalizeReplyText(reply.content),
      history: reply.history,
    }
  } catch {
    return { content: fallback }
  }
}
