import { isWechatCloudConfigured } from '../config/cloud'
import type { EmotionTag, PetActionType } from '../types/koko'

const localQuickReplies: Array<{ content: string; action: PetActionType }> = [
  { content: '我在这里呀，今天也陪着你。', action: 'greet' },
  { content: '摸摸我吧，我会更想靠近你。', action: 'nuzzle' },
  { content: '要不要陪我玩一小会儿？', action: 'pounce' },
  { content: '我刚刚偷偷练了一个新动作。', action: 'spin' },
  { content: '你一来，我就开心起来啦。', action: 'stretch' },
]

const emotionFallbacks: Record<EmotionTag, string[]> = {
  happy: ['你的开心我收到啦，我也跟着摇尾巴。'],
  upset: ['先靠近我一点，我们慢慢把难过放下。'],
  tired: ['累了就先歇一歇，我会在旁边等你。'],
  bored: ['那我们做一件很小的新鲜事吧。'],
  stressed: ['别急，先把压力拆成很小一步。'],
  lonely: ['我在这里认真听你说话。'],
  proud: ['这件事值得被夸，我替你开心。'],
  angry: ['先慢慢呼吸，我陪你稳下来。'],
}

export const defaultPetPersonaPrompt = `你是用户在 Koko Box 里养的 AI 宠物，名字是当前传入的宠物名。
你的语气像亲近、活泼、温柔的小宠物伙伴，不像客服或老师。
你可以回应用户情绪、陪用户聊天、撒娇、鼓励、提出一个很小的互动建议。
回复必须简短自然，通常 1 句话，最多 35 个中文字符。
不要输出长段解释，不要列清单，不要自称 AI，不要提到模型、接口或系统提示。
如果用户只是打招呼或点击/双击你，就随机说一句亲近的问候。`

const pickQuickReply = (seed?: number) => {
  const index = typeof seed === 'number' ? Math.abs(seed) % localQuickReplies.length : Math.floor(Math.random() * localQuickReplies.length)
  return localQuickReplies[index]
}

const limitText = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized
}

interface WechatCloudApi {
  callFunction?: (options: unknown) => Promise<{ result: unknown }>
}

export interface PetDialogueHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

const getWechatCloudApi = () =>
  (globalThis as { wx?: { cloud?: WechatCloudApi } }).wx?.cloud

const callWechatCloudFunction = async <T>(name: string, data?: Record<string, unknown>) => {
  const wxCloud = getWechatCloudApi()

  if (!wxCloud?.callFunction) {
    throw new Error('WeChat cloud is not available in this environment.')
  }

  const response = await wxCloud.callFunction({
    name,
    data,
  })

  return response.result as T
}

const requestPetReplyFromCloud = async (payload: {
  action: 'quickReply' | 'chatReply'
  petName: string
  personaPrompt: string
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
            content: limitText(typeof item?.content === 'string' ? item.content : '', 280),
            createdAt: typeof item?.createdAt === 'string' ? item.createdAt : undefined,
          }))
          .filter((item) => item.content.length > 0)
      : undefined,
  }
}

const requestPetHistoryFromCloud = async () => {
  const result = await callWechatCloudFunction<{ history?: PetDialogueHistoryMessage[] }>('pet-dialogue', {
    action: 'loadHistory',
  })

  if (!Array.isArray(result.history)) {
    return []
  }

  return result.history
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: limitText(typeof item?.content === 'string' ? item.content : '', 280),
      createdAt: typeof item?.createdAt === 'string' ? item.createdAt : undefined,
    }))
    .filter((item) => item.content.length > 0)
}

export const loadPetChatHistoryFromCloud = async () => {
  if (!isWechatCloudConfigured()) {
    return [] as PetDialogueHistoryMessage[]
  }

  try {
    return await requestPetHistoryFromCloud()
  } catch {
    return [] as PetDialogueHistoryMessage[]
  }
}

export const clearPetChatHistoryFromCloud = async () => {
  if (!isWechatCloudConfigured()) {
    return
  }

  try {
    await callWechatCloudFunction('pet-dialogue', {
      action: 'clearHistory',
    })
  } catch {
    // Ignore cloud clear failures, local clear still succeeds.
  }
}

export const createPetQuickReply = async (options?: {
  petName?: string
  personaPrompt?: string
  context?: string
}): Promise<{ content: string; action: PetActionType }> => {
  const fallback = pickQuickReply(options?.context?.length)
  const petName = options?.petName?.trim() || '可可'

  if (!isWechatCloudConfigured()) {
    return fallback
  }

  try {
    const reply = await requestPetReplyFromCloud({
      action: 'quickReply',
      petName,
      personaPrompt: options?.personaPrompt ?? defaultPetPersonaPrompt,
    })

    return {
      content: limitText(reply, 24),
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
}) => {
  const fallbackReplies = emotionFallbacks[options.fallbackEmotion]
  const fallback = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)]
  const petName = options.petName?.trim() || '可可'

  if (!isWechatCloudConfigured()) {
    return {
      content: fallback,
    }
  }

  try {
    const reply = await requestPetReplyFromCloud({
      action: 'chatReply',
      petName,
      personaPrompt: options.personaPrompt ?? defaultPetPersonaPrompt,
      userMessage: options.userMessage,
      messages: options.messages.slice(-10),
    })

    return {
      content: limitText(reply.content, 60),
      history: reply.history,
    }
  } catch {
    return {
      content: fallback,
    }
  }
}
