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

const LOCAL_INVITE_STORAGE_KEY = 'koko-town-local-invite-v1'

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
  let response: { result: unknown } | null = null

  try {
    response = await callTownCommunityPrimary(data, timeout)
  } catch (error) {
    if (!shouldUseLoginFallback(error)) {
      return createLocalTownCommunityState(data) as T
    }

    try {
      response = await callTownCommunityFallback(data, timeout)
    } catch {
      return createLocalTownCommunityState(data) as T
    }
  }

  const state = normalizeTownCommunityState(response?.result)

  if (!state.room.ownerOpenid && !state.partners.length) {
    return createLocalTownCommunityState(data) as T
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

const readLocalInviteCode = () => {
  try {
    const stored = uni.getStorageSync(LOCAL_INVITE_STORAGE_KEY)
    return normalizeText(stored).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()
  } catch {
    return ''
  }
}

const writeLocalInviteCode = (code: string) => {
  try {
    uni.setStorageSync(LOCAL_INVITE_STORAGE_KEY, code)
  } catch {
    // Local-only fallback still works for the current session if storage fails.
  }
}

const createLocalInviteCode = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase()

const getLocalInviteCode = (action: unknown, inviteCode?: unknown) => {
  const incomingCode = normalizeText(inviteCode).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()
  if (incomingCode) {
    writeLocalInviteCode(incomingCode)
    return incomingCode
  }

  const storedCode = readLocalInviteCode()
  if (storedCode) return storedCode

  if (action !== 'createInvite') return ''

  const nextCode = createLocalInviteCode()
  writeLocalInviteCode(nextCode)
  return nextCode
}

const createLocalTownCommunityState = (data: Record<string, unknown>): TownCommunityState => {
  const timestamp = new Date().toISOString()
  const inviteCode = getLocalInviteCode(data.action, data.inviteCode)
  const ownerOpenid = inviteCode ? `local-town-${inviteCode}` : 'local-town-self'
  const selfPartner = normalizePartner({
    openid: `${ownerOpenid}-self`,
    nickName: data.nickName,
    avatarUrl: data.avatarUrl,
    petName: data.petName,
    x: data.x,
    y: data.y,
    action: data.action === 'offline' ? 'idle' : data.action,
    online: data.action !== 'offline',
    isSelf: true,
    lastSeenAt: timestamp,
  }, 0)

  return {
    room: {
      id: ownerOpenid,
      ownerOpenid,
      inviteCode,
      inviteExpiresAt: inviteCode ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : '',
      memberCount: 1,
      updatedAt: timestamp,
    },
    partners: [selfPartner],
    invitePath: inviteCode ? `/pages/town/index?invite=${inviteCode}` : '',
    inviteCode,
    qrCodeFileID: '',
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
