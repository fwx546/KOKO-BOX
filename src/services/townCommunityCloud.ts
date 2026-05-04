import { isWechatCloudConfigured } from '../config/cloud'

export interface TownCommunityPartner {
  openid: string
  nickName: string
  avatarUrl: string
  petName: string
  x: number
  y: number
  action: string
  online: boolean
  isSelf: boolean
  lastSeenAt: string
}

export interface TownCommunityRoom {
  id: string
  ownerOpenid: string
  inviteCode: string
  inviteExpiresAt: string
  memberCount: number
  updatedAt: string
}

export interface TownCommunityState {
  room: TownCommunityRoom
  partners: TownCommunityPartner[]
  invitePath: string
  inviteCode: string
  qrCodeFileID?: string
}

export interface TownCommunityPresencePayload {
  nickName?: string
  avatarUrl?: string
  petName?: string
  x: number
  y: number
  action?: string
}

interface WechatCloudApi {
  callFunction?: (options: unknown) => Promise<{ result: unknown }>
}

type TownCommunityAction = 'load' | 'heartbeat' | 'offline' | 'createInvite' | 'joinInvite'

const getWechatCloudApi = () =>
  (globalThis as { wx?: { cloud?: WechatCloudApi } }).wx?.cloud

const callTownCommunityPrimary = async (data: Record<string, unknown>, timeout: number) => {
  const wxCloud = getWechatCloudApi()

  if (!wxCloud?.callFunction || !isWechatCloudConfigured()) {
    throw new Error('Town community cloud is unavailable.')
  }

  return wxCloud.callFunction({
    name: 'town-community',
    data,
    timeout,
  })
}

const callTownCommunityFallback = async (data: Record<string, unknown>, timeout: number) => {
  const wxCloud = getWechatCloudApi()

  if (!wxCloud?.callFunction || !isWechatCloudConfigured()) {
    throw new Error('Town community cloud is unavailable.')
  }

  return wxCloud.callFunction({
    name: 'login',
    data: {
      action: 'townCommunity',
      townCommunity: data,
    },
    timeout,
  })
}

const getCloudErrorText = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'errMsg' in error) {
    const errMsg = (error as { errMsg?: unknown }).errMsg
    return typeof errMsg === 'string' ? errMsg : ''
  }
  return ''
}

const shouldUseLoginFallback = (error: unknown) => {
  const message = getCloudErrorText(error).toLowerCase()
  return (
    message.includes('not found') ||
    message.includes('not exist') ||
    message.includes('cannot find') ||
    message.includes('cloud function') ||
    message.includes('fail') ||
    message.includes('timeout')
  )
}

const callTownCommunityFunction = async <T>(data: Record<string, unknown>, timeout = 20000) => {
  let response: { result: unknown }

  try {
    response = await callTownCommunityPrimary(data, timeout)
  } catch (error) {
    if (!shouldUseLoginFallback(error)) {
      throw error
    }

    response = await callTownCommunityFallback(data, timeout)
  }

  const state = normalizeTownCommunityState(response.result)

  if (!state.room.ownerOpenid && !state.partners.length) {
    throw new Error('Town community cloud returned no room state. Please deploy the latest login or town-community cloud function.')
  }

  return state as T
}

const createTownPayload = (action: TownCommunityAction, payload?: Record<string, unknown>) => ({
  action,
  ...(payload ?? {}),
})

const normalizeText = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

const normalizeNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const normalizePartner = (value: unknown, index: number): TownCommunityPartner => {
  const source = (value ?? {}) as Partial<TownCommunityPartner>
  return {
    openid: normalizeText(source.openid, `partner-${index}`),
    nickName: normalizeText(source.nickName, `Koko Friend ${index + 1}`),
    avatarUrl: normalizeText(source.avatarUrl),
    petName: normalizeText(source.petName, 'Koko'),
    x: normalizeNumber(source.x, 18 + index * 10),
    y: normalizeNumber(source.y, 72),
    action: normalizeText(source.action, 'idle'),
    online: Boolean(source.online),
    isSelf: Boolean(source.isSelf),
    lastSeenAt: normalizeText(source.lastSeenAt),
  }
}

const normalizeTownCommunityState = (value: unknown): TownCommunityState => {
  const source = (value ?? {}) as Partial<TownCommunityState>
  const room = (source.room ?? {}) as Partial<TownCommunityRoom>

  return {
    room: {
      id: normalizeText(room.id),
      ownerOpenid: normalizeText(room.ownerOpenid),
      inviteCode: normalizeText(room.inviteCode),
      inviteExpiresAt: normalizeText(room.inviteExpiresAt),
      memberCount: normalizeNumber(room.memberCount, 1),
      updatedAt: normalizeText(room.updatedAt),
    },
    partners: Array.isArray(source.partners)
      ? source.partners.map((item, index) => normalizePartner(item, index)).filter((item) => item.openid)
      : [],
    invitePath: normalizeText(source.invitePath),
    inviteCode: normalizeText(source.inviteCode),
    qrCodeFileID: normalizeText(source.qrCodeFileID),
  }
}

export const loadTownCommunityState = () =>
  callTownCommunityFunction<TownCommunityState>(createTownPayload('load'))

export const sendTownCommunityHeartbeat = (payload: TownCommunityPresencePayload) =>
  callTownCommunityFunction<TownCommunityState>(createTownPayload('heartbeat', payload as unknown as Record<string, unknown>))

export const markTownCommunityOffline = (payload: TownCommunityPresencePayload) =>
  callTownCommunityFunction<TownCommunityState>(createTownPayload('offline', payload as unknown as Record<string, unknown>))

export const createTownInvite = (payload: TownCommunityPresencePayload) =>
  callTownCommunityFunction<TownCommunityState>(
    createTownPayload('createInvite', payload as unknown as Record<string, unknown>),
    30000,
  )

export const joinTownInvite = (inviteCode: string, payload: TownCommunityPresencePayload) =>
  callTownCommunityFunction<TownCommunityState>(
    createTownPayload('joinInvite', {
      inviteCode,
      ...payload,
    }),
    30000,
  )
