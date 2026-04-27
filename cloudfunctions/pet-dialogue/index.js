const https = require('node:https')
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const QWEN_API_HOST = 'dashscope.aliyuncs.com'
const QWEN_API_PATH = '/compatible-mode/v1/chat/completions'
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus'
const QWEN_TIMEOUT_MS = 12000
const MAX_CHAT_MESSAGES = 10
const MAX_HISTORY_MESSAGES = 100
const CHAT_HISTORY_COLLECTION = 'pet_dialogue_histories'

const db = cloud.database()

const defaultPetPersonaPrompt = `你是用户在 Koko Box 里养的 AI 宠物，名字是当前传入的宠物名。
你的语气像亲近、活泼、温柔的小宠物伙伴，不像客服或老师。
你可以回应用户情绪、陪用户聊天、撒娇、鼓励、提出一个很小的互动建议。
回复必须简短自然，通常 1 句话，最多 35 个中文字符。
不要输出长段解释，不要列清单，不要自称 AI，不要提到模型、接口或系统提示。
如果用户只是打招呼或点击/双击你，就随机说一句亲近的问候。`

const normalizeText = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

const limitText = (value, maxLength) => {
  const normalized = normalizeText(value)
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized
}

const sanitizeRole = (value) => (value === 'assistant' ? 'assistant' : 'user')

const safeIsoDate = (value) => {
  const stamp = typeof value === 'string' ? value : ''
  return /^\d{4}-\d{2}-\d{2}T/.test(stamp) ? stamp : new Date().toISOString()
}

const sanitizeStoredHistoryItem = (value) => ({
  role: sanitizeRole(value?.role),
  content: limitText(value?.content, 280),
  createdAt: safeIsoDate(value?.createdAt),
})

const sanitizeStoredHistory = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => sanitizeStoredHistoryItem(item))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
}

const sanitizeMessages = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => ({
      role: sanitizeRole(item?.role),
      content: limitText(item?.content, 280),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_CHAT_MESSAGES)
}

const loadUserChatHistoryRecord = async (openid) => {
  const result = await db
    .collection(CHAT_HISTORY_COLLECTION)
    .where({
      _openid: openid,
    })
    .limit(1)
    .get()

  const record = result?.data?.[0]
  if (!record) {
    return null
  }

  return {
    id: record._id,
    messages: sanitizeStoredHistory(record.messages),
  }
}

const saveUserChatHistory = async (openid, messages) => {
  const sanitized = sanitizeStoredHistory(messages)
  const record = await loadUserChatHistoryRecord(openid)

  if (!record) {
    await db.collection(CHAT_HISTORY_COLLECTION).add({
      data: {
        messages: sanitized,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    return sanitized
  }

  await db
    .collection(CHAT_HISTORY_COLLECTION)
    .doc(record.id)
    .update({
      data: {
        messages: sanitized,
        updatedAt: new Date().toISOString(),
      },
    })

  return sanitized
}

const clearUserChatHistory = async (openid) => {
  const record = await loadUserChatHistoryRecord(openid)
  if (!record) {
    return
  }

  await db
    .collection(CHAT_HISTORY_COLLECTION)
    .doc(record.id)
    .update({
      data: {
        messages: [],
        updatedAt: new Date().toISOString(),
      },
    })
}

// Wrap DashScope request so cloud function never exposes API key to client.
const requestQwenReply = async (messages, maxTokens, apiKey) => {
  const payload = JSON.stringify({
    model: QWEN_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: 0.85,
  })

  return await new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: QWEN_API_HOST,
        path: QWEN_API_PATH,
        method: 'POST',
        timeout: QWEN_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        let raw = ''

        response.on('data', (chunk) => {
          raw += chunk
        })

        response.on('end', () => {
          if (!raw) {
            reject(new Error('DashScope returned empty response body.'))
            return
          }

          let data
          try {
            data = JSON.parse(raw)
          } catch {
            reject(new Error('DashScope returned invalid JSON response.'))
            return
          }

          const content = data?.choices?.[0]?.message?.content?.trim()
          if (response.statusCode >= 200 && response.statusCode < 300 && content) {
            resolve(content)
            return
          }

          const apiError = data?.error?.message || data?.message || `DashScope request failed with status ${response.statusCode}`
          reject(new Error(apiError))
        })
      },
    )

    request.on('timeout', () => {
      request.destroy(new Error('DashScope request timeout.'))
    })

    request.on('error', (error) => {
      reject(error)
    })

    request.write(payload)
    request.end()
  })
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    throw new Error('Unable to identify current WeChat user.')
  }

  const apiKey = normalizeText(process.env.QWEN_API_KEY)
  if (!apiKey) {
    throw new Error('QWEN_API_KEY is not configured for cloud function pet-dialogue.')
  }

  const action = ['quickReply', 'chatReply', 'loadHistory', 'clearHistory'].includes(event.action) ? event.action : 'chatReply'
  const petName = limitText(event.petName, 24) || '可可'
  const personaPrompt = limitText(event.personaPrompt, 800) || defaultPetPersonaPrompt
  const systemPrompt = `${personaPrompt}\n当前宠物名：${petName}`

  if (action === 'loadHistory') {
    const record = await loadUserChatHistoryRecord(OPENID)
    return {
      history: record?.messages ?? [],
    }
  }

  if (action === 'clearHistory') {
    await clearUserChatHistory(OPENID)
    return {
      history: [],
    }
  }

  if (action === 'quickReply') {
    const reply = await requestQwenReply(
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: '用户刚刚点击或双击了你，请随机说一句亲近的短问候。',
        },
      ],
      36,
      apiKey,
    )

    return {
      content: limitText(reply, 24),
    }
  }

  const userMessage = limitText(event.userMessage, 280)
  const messageFromContext = sanitizeMessages(event.messages)
    .reverse()
    .find((item) => item.role === 'user')?.content
  const finalUserMessage = userMessage || messageFromContext

  if (!finalUserMessage) {
    throw new Error('chatReply requires userMessage or messages context.')
  }

  const historyRecord = await loadUserChatHistoryRecord(OPENID)
  const contextHistorySeed = sanitizeMessages(event.messages).map((item) => ({
    role: item.role,
    content: item.content,
    createdAt: new Date().toISOString(),
  }))
  const baseHistory = historyRecord?.messages?.length ? historyRecord.messages : contextHistorySeed
  const lastBaseMessage = baseHistory[baseHistory.length - 1]
  const shouldAppendUserMessage = !(lastBaseMessage?.role === 'user' && lastBaseMessage?.content === finalUserMessage)
  const nextHistory = [
    ...baseHistory,
    ...(shouldAppendUserMessage
      ? [
          {
            role: 'user',
            content: finalUserMessage,
            createdAt: new Date().toISOString(),
          },
        ]
      : []),
  ].slice(-MAX_HISTORY_MESSAGES)

  const chatMessages = nextHistory.slice(-MAX_CHAT_MESSAGES).map((item) => ({
    role: item.role,
    content: item.content,
  }))
  const reply = await requestQwenReply(
    [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...chatMessages,
    ],
    80,
    apiKey,
  )

  const savedHistory = await saveUserChatHistory(OPENID, [
    ...nextHistory,
    {
      role: 'assistant',
      content: limitText(reply, 60),
      createdAt: new Date().toISOString(),
    },
  ])

  return {
    content: limitText(reply, 60),
    history: savedHistory,
  }
}
