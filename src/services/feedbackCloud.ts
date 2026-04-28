import { isWechatCloudConfigured } from '../config/cloud'

interface WechatCloudApi {
  callFunction?: (options: unknown) => Promise<{ result: unknown }>
}

export type FeedbackType = 'complaint' | 'suggestion'
export type FeedbackStatus = 'submitted' | 'reviewing' | 'resolved' | 'rejected'

export interface FeedbackRecord {
  _id: string
  ownerOpenid?: string
  type: FeedbackType
  content: string
  status: FeedbackStatus
  adminReply: string
  createdAt: string
  updatedAt: string
  repliedAt: string
}

export interface FeedbackListResult {
  records: FeedbackRecord[]
  isAdmin: boolean
}

const feedbackTypes: FeedbackType[] = ['complaint', 'suggestion']
const feedbackStatuses: FeedbackStatus[] = ['submitted', 'reviewing', 'resolved', 'rejected']

const getWechatCloudApi = () =>
  (globalThis as { wx?: { cloud?: WechatCloudApi } }).wx?.cloud

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

const normalizeText = (value: unknown, maxLength: number) => {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

const normalizeEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

const normalizeRecord = (item: Partial<FeedbackRecord>): FeedbackRecord | null => {
  const id = normalizeText(item._id, 80)
  const content = normalizeText(item.content, 1000)

  if (!id || !content) {
    return null
  }

  return {
    _id: id,
    ownerOpenid: normalizeText(item.ownerOpenid, 80) || undefined,
    type: normalizeEnum(item.type, feedbackTypes, 'suggestion'),
    content,
    status: normalizeEnum(item.status, feedbackStatuses, 'submitted'),
    adminReply: normalizeText(item.adminReply, 1000),
    createdAt: normalizeText(item.createdAt, 40),
    updatedAt: normalizeText(item.updatedAt, 40),
    repliedAt: normalizeText(item.repliedAt, 40),
  }
}

const normalizeListResult = (value: unknown): FeedbackListResult => {
  const result = (value ?? {}) as { records?: unknown; isAdmin?: unknown }
  const records = Array.isArray(result.records)
    ? result.records
        .map((item) => normalizeRecord((item ?? {}) as Partial<FeedbackRecord>))
        .filter((item): item is FeedbackRecord => Boolean(item))
    : []

  return {
    records,
    isAdmin: Boolean(result.isAdmin),
  }
}

export const canUseFeedbackCloud = () => isWechatCloudConfigured()

export const submitFeedback = async (payload: { type: FeedbackType; content: string }) => {
  if (!isWechatCloudConfigured()) {
    throw new Error('WeChat cloud is not configured.')
  }

  const result = await callWechatCloudFunction<{ record?: unknown; isAdmin?: unknown }>(
    'feedback-sync',
    {
      action: 'submit',
      type: payload.type,
      content: payload.content,
    },
    30000,
  )

  const record = normalizeRecord((result.record ?? {}) as Partial<FeedbackRecord>)
  if (!record) {
    throw new Error('Invalid feedback response.')
  }

  return {
    record,
    isAdmin: Boolean(result.isAdmin),
  }
}

export const listMyFeedback = async () => {
  if (!isWechatCloudConfigured()) {
    return {
      records: [],
      isAdmin: false,
    }
  }

  const result = await callWechatCloudFunction('feedback-sync', {
    action: 'listMine',
  })

  return normalizeListResult(result)
}

export const listAdminFeedback = async (status?: FeedbackStatus | 'all') => {
  if (!isWechatCloudConfigured()) {
    return {
      records: [],
      isAdmin: false,
    }
  }

  const result = await callWechatCloudFunction('feedback-sync', {
    action: 'listAdmin',
    status,
  })

  return normalizeListResult(result)
}

export const updateAdminFeedback = async (payload: {
  id: string
  status: FeedbackStatus
  adminReply: string
}) => {
  if (!isWechatCloudConfigured()) {
    throw new Error('WeChat cloud is not configured.')
  }

  const result = await callWechatCloudFunction<{ record?: unknown; isAdmin?: unknown }>(
    'feedback-sync',
    {
      action: 'updateAdmin',
      id: payload.id,
      status: payload.status,
      adminReply: payload.adminReply,
    },
    30000,
  )

  const record = normalizeRecord((result.record ?? {}) as Partial<FeedbackRecord>)
  if (!record) {
    throw new Error('Invalid feedback response.')
  }

  return {
    record,
    isAdmin: Boolean(result.isAdmin),
  }
}
