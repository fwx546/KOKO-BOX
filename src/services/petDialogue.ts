import { QWEN_API_BASE_URL, QWEN_API_KEY, QWEN_MODEL, isQwenConfigured } from '../config/ai'
import type { EmotionTag, PetActionType } from '../types/koko'

const localQuickReplies: Array<{ content: string; action: PetActionType }> = [
  { content: '我在这儿，今天也一起慢慢变好。', action: 'greet' },
  { content: '摸摸我，我会更想陪着你。', action: 'nuzzle' },
  { content: '想不想陪我玩一小会儿？', action: 'pounce' },
  { content: '我刚刚偷偷练了一个新动作。', action: 'spin' },
  { content: '有你在旁边，今天就很安心。', action: 'stretch' },
]

const emotionFallbacks: Record<EmotionTag, string[]> = {
  happy: ['你的开心有传染力，我也在跟着晃尾巴。'],
  upset: ['先靠近一点吧，我会陪你把这阵情绪慢慢放下。'],
  tired: ['累的时候就先歇一歇，我会在旁边等你。'],
  bored: ['如果你愿意，我们可以先从一个很小的互动开始。'],
  stressed: ['别急着一次解决全部，先把最小的一步做完就很好。'],
  lonely: ['你不是一个人，我会认真接住你说的话。'],
  proud: ['这件事值得被表扬，我已经替你偷偷骄傲了一下。'],
  angry: ['先把呼吸放慢一点，我会陪你把情绪稳下来。'],
}

export const defaultPetPersonaPrompt = `你是一只住在微信小程序首页里的陪伴型猫咪宠物。
你的名字叫 Koko。
请保持语气温柔、简洁、像真正有情绪的宠物伙伴。
首页轻聊回复限制在 24 个汉字以内，避免长段落。
当用户只是点击你时，请优先给出轻松、陪伴感强的一句话。`

const pickQuickReply = (seed?: number) => {
  const index = typeof seed === 'number' ? Math.abs(seed) % localQuickReplies.length : Math.floor(Math.random() * localQuickReplies.length)
  return localQuickReplies[index]
}

const requestQwenReply = async (messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) => {
  return await new Promise<string>((resolve, reject) => {
    if (typeof uni === 'undefined' || typeof uni.request !== 'function') {
      reject(new Error('uni.request is unavailable'))
      return
    }

    uni.request({
      url: `${QWEN_API_BASE_URL}/chat/completions`,
      method: 'POST',
      timeout: 12000,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${QWEN_API_KEY}`,
      },
      data: {
        model: QWEN_MODEL,
        messages,
        temperature: 0.8,
      },
      success: (response) => {
        const data = response.data as
          | {
              choices?: Array<{
                message?: {
                  content?: string
                }
              }>
            }
          | undefined

        const content = data?.choices?.[0]?.message?.content?.trim()
        if (content) {
          resolve(content)
          return
        }

        reject(new Error('empty response'))
      },
      fail: (error) => {
        reject(error)
      },
    })
  })
}

export const createPetQuickReply = async (options?: {
  petName?: string
  personaPrompt?: string
  context?: string
}): Promise<{ content: string; action: PetActionType }> => {
  const fallback = pickQuickReply(options?.context?.length)

  if (!isQwenConfigured()) {
    return fallback
  }

  try {
    const reply = await requestQwenReply([
      {
        role: 'system',
        content: options?.personaPrompt ?? defaultPetPersonaPrompt,
      },
      {
        role: 'user',
        content: `你是${options?.petName ?? 'Koko'}。用户刚刚点击了你。请返回一句很短的宠物回应。`,
      },
    ])

    return {
      content: reply.slice(0, 48),
      action: fallback.action,
    }
  } catch {
    return fallback
  }
}

export const createPetChatReply = async (options: {
  petName?: string
  personaPrompt?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  fallbackEmotion: EmotionTag
}) => {
  const fallbackReplies = emotionFallbacks[options.fallbackEmotion]
  const fallback = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)]

  if (!isQwenConfigured()) {
    return fallback
  }

  try {
    const reply = await requestQwenReply([
      {
        role: 'system',
        content: options.personaPrompt ?? defaultPetPersonaPrompt,
      },
      ...options.messages.slice(-10),
    ])

    return reply
  } catch {
    return fallback
  }
}
