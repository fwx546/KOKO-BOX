<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onHide, onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import PetLottieAvatar from '../components/PetLottieAvatar.vue'
import { useAuth } from '../composables/useAuth'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { PetActionType } from '../types/koko'
import {
  createTownInvite,
  joinTownInvite,
  loadTownCommunityState,
  markTownCommunityOffline,
  sendTownCommunityHeartbeat,
  type TownCommunityPartner,
  type TownCommunityRoom,
} from '../services/townCommunityCloud'

interface BuildingHotspot {
  id: string
  name: string
  description: string
  x: number
  y: number
  width: number
  height: number
}

interface TownGuideStep {
  title: string
  body: string
  focus: 'map' | 'pet' | 'community' | 'home' | 'playground' | 'shop' | 'task-board'
}

const MAP_WIDTH = 941
const MAP_HEIGHT = 1672
const townMapCandidates = [
  '/static/town/map-fallback.jpg',
  'static/town/map-fallback.jpg',
  '/static/town/map.webp',
  'static/town/map.webp',
]
const townMapSrc = ref(townMapCandidates[0])
let townMapIndex = 0
const PET_SIZE_RPX = 240
const PET_MIN_X = 10
const PET_MAX_X = 90
const PET_MIN_Y = 26
const PET_MAX_Y = 92
const TOWN_CENTER_PAW_POSITION = { x: 52, y: 58 }
const TOWN_HOME_ACTION_STORAGE_KEY = 'koko-town-home-action'
const TOWN_GUIDE_STORAGE_KEY = 'hasSeenTownGuideCommunityV1'
const TOWN_INVITE_SHARE_STORAGE_KEY = 'koko-town-share-invite'
const TOWN_PENDING_INVITE_STORAGE_KEY = 'koko-town-pending-invite'
const VIRTUAL_FRIEND_OPENID = 'virtual-town-friend-device'

const { pet, economy, shopItems, todayTasks, completedTasks, settings, purchaseShopItem, syncEconomyFromCloud } = useKokoState()
const { user, authMode, isMockSession, login } = useAuth()
const { t } = useLanguage()

const hotspots = computed<BuildingHotspot[]>(() => [
  { id: 'home', ...t.value.town.buildings.home, x: 200, y: 560, width: 180, height: 170 },
  { id: 'playground', ...t.value.town.buildings.playground, x: 630, y: 560, width: 180, height: 170 },
  { id: 'shop', ...t.value.town.buildings.shop, x: 120, y: 900, width: 220, height: 210 },
  { id: 'task-board', ...t.value.town.buildings.task, x: 650, y: 940, width: 190, height: 180 },
  { id: 'talk-house', ...t.value.town.buildings.chat, x: 360, y: 1180, width: 190, height: 190 },
])

const activeBuilding = ref<BuildingHotspot | null>(null)
const shopMessage = ref('')
const petPosition = ref({ x: 52, y: 76 })
const petMoveDurationMs = ref(0)
const petMirror = ref(false)
const petAction = ref<PetActionType>('idle')
const walkingEnabled = ref(true)
const guideVisible = ref(false)
const guideStepIndex = ref(0)
const guideSavedPetPosition = ref<{ x: number; y: number } | null>(null)
const communityPanelOpen = ref(false)
const communityLoading = ref(false)
const communityMessage = ref('')
const communityPartners = ref<TownCommunityPartner[]>([])
const communityRoom = ref<TownCommunityRoom | null>(null)
const communityInvitePath = ref('')
const communityInviteCode = ref('')
const communityQrCodeFileID = ref('')
const pendingInviteCode = ref('')
const virtualFriendConnected = ref(false)
const virtualFriendPosition = ref({ x: 66, y: 72 })
const virtualFriendAction = ref<PetActionType>('idle')

let moveTimer: ReturnType<typeof setTimeout> | undefined
let roamTimer: ReturnType<typeof setInterval> | undefined
let communityHeartbeatTimer: ReturnType<typeof setInterval> | undefined
let communityRefreshTimer: ReturnType<typeof setInterval> | undefined
let communityMoveTimer: ReturnType<typeof setTimeout> | undefined
let virtualFriendTimer: ReturnType<typeof setInterval> | undefined

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

const handleTownMapError = (event: any) => {
  console.error('[TownPage] map image load failed:', townMapSrc.value, event?.detail?.errMsg ?? event)
  if (townMapIndex < townMapCandidates.length - 1) {
    townMapIndex += 1
    townMapSrc.value = townMapCandidates[townMapIndex]
    console.warn('[TownPage] switch map candidate to:', townMapSrc.value)
  }
}

const checkImageSource = (src: string) =>
  new Promise<{ ok: boolean; errMsg?: string }>((resolve) => {
    if (typeof uni === 'undefined' || typeof uni.getImageInfo !== 'function') {
      resolve({ ok: true })
      return
    }

    uni.getImageInfo({
      src,
      success: () => resolve({ ok: true }),
      fail: (err) => {
        const errMsg = (err as { errMsg?: string })?.errMsg ?? String(err)
        console.error('[TownPage] getImageInfo failed:', src, errMsg)
        resolve({ ok: false, errMsg })
      },
    })
  })

const ensureTownMap = async () => {
  for (let index = 0; index < townMapCandidates.length; index += 1) {
    const candidate = townMapCandidates[index]
    const result = await checkImageSource(candidate)
    if (result.ok) {
      townMapIndex = index
      townMapSrc.value = candidate
      return
    }
  }
  console.error('[TownPage] all map candidates failed:', townMapCandidates.join(', '))
}

const hotspotStyle = (spot: BuildingHotspot) =>
  `left:${(spot.x / MAP_WIDTH) * 100}%;top:${(spot.y / MAP_HEIGHT) * 100}%;width:${(spot.width / MAP_WIDTH) * 100}%;height:${(spot.height / MAP_HEIGHT) * 100}%;`

const guideHighlightStyle = computed(() => {
  const focus = activeGuideStep.value.focus
  if (focus === 'map') {
    return 'left:6%;top:10%;width:88%;height:78%;'
  }
  if (focus === 'pet') {
    return `left:${petPosition.value.x - 14}%;top:${petPosition.value.y - 20}%;width:28%;height:24%;`
  }
  if (focus === 'community') {
    return 'left:4%;top:7%;width:92%;height:23%;'
  }

  const spot = hotspots.value.find((item) => item.id === focus)
  if (!spot) return 'left:8%;top:14%;width:84%;height:24%;'

  const left = ((spot.x - 24) / MAP_WIDTH) * 100
  const top = ((spot.y - 24) / MAP_HEIGHT) * 100
  const width = ((spot.width + 48) / MAP_WIDTH) * 100
  const height = ((spot.height + 48) / MAP_HEIGHT) * 100
  return `left:${left}%;top:${top}%;width:${width}%;height:${height}%;`
})

const guideButtonText = computed(() => {
  const isLast = guideStepIndex.value >= guideSteps.value.length - 1
  if (settings.value.language === 'zh') return isLast ? '完成' : '下一步'
  return isLast ? 'Done' : 'Next'
})

const guideEntryText = computed(() => (settings.value.language === 'zh' ? '小镇指南' : 'Town Guide'))

const petStyle = computed(() => ({
  left: `${petPosition.value.x}%`,
  top: `${petPosition.value.y}%`,
  transitionDuration: `${petMoveDurationMs.value}ms`,
}))
const communityAvailable = computed(() => authMode.value === 'wechat' && !isMockSession.value)
const communityOtherPartners = computed(() => communityPartners.value.filter((partner) => !partner.isSelf))
const communityOnlinePartners = computed(() => communityOtherPartners.value.filter((partner) => partner.online))
const communityPartnerCapacity = computed(() => Math.max(communityOtherPartners.value.length, (communityRoom.value?.memberCount ?? 1) - 1, 1))
const communityHudOnline = computed(() => communityAvailable.value || virtualFriendConnected.value)
const activeCommunityInviteCode = computed(() => communityInviteCode.value || communityRoom.value?.inviteCode || '')
const activeCommunityInvitePath = computed(() => {
  if (communityInvitePath.value) return communityInvitePath.value
  return activeCommunityInviteCode.value ? `/pages/town/index?invite=${activeCommunityInviteCode.value}` : ''
})

const persistPanelInviteCode = (inviteCode: string) => {
  if (!inviteCode || typeof uni.setStorageSync !== 'function') return
  uni.setStorageSync(TOWN_INVITE_SHARE_STORAGE_KEY, inviteCode)
}

const townPendingTasks = computed(() => todayTasks.value.slice(0, 3))
const townCompletedTasks = computed(() => completedTasks.value.slice(0, 3))
const shopText = computed(() => ({
  owned: settings.value.language === 'zh' ? '已拥有' : 'Owned',
  openTasks: settings.value.language === 'zh' ? '打开待办' : 'Open Tasks',
  openHomeChat: settings.value.language === 'zh' ? '回首页聊天' : 'Open Home Chat',
  chatHint: settings.value.language === 'zh' ? '和 Koko 聊天，每天最多可获得 20 金币。' : 'Chat with Koko and earn up to 20 coins every day.',
  pending: settings.value.language === 'zh' ? '待办' : 'pending',
  done: settings.value.language === 'zh' ? '完成' : 'done',
}))

const communityCopy = computed(() => {
  const isZh = settings.value.language === 'zh'
  return {
    title: isZh ? '社区联机' : 'Community Co-op',
    subtitle: isZh ? '邀请好友进入同一座小镇，看见彼此的 Koko 在地图上散步。' : 'Invite friends into the same town and watch every Koko wander on the map.',
    online: isZh ? '在线' : 'online',
    offline: isZh ? '离线' : 'offline',
    openPanel: isZh ? '联机' : 'Co-op',
    invite: isZh ? '生成邀请' : 'Create invite',
    refresh: isZh ? '刷新伙伴' : 'Refresh',
    share: isZh ? '转发邀请链接' : 'Share invite link',
    copy: isZh ? '复制邀请信息' : 'Copy invite',
    qrTitle: isZh ? '线下扫码联机' : 'Scan to join nearby',
    qrPending: isZh ? '二维码生成中或暂不可用，可先用转发链接。' : 'QR is being generated or unavailable. Use the share link for now.',
    unavailable: isZh ? '社区联机需要微信登录和云开发环境，游客模式不会显示虚假的在线好友。' : 'Community co-op needs WeChat login and cloud. Guest mode never shows fake online friends.',
    empty: isZh ? '还没有联机伙伴。生成邀请后转发给好友，或让好友线下扫码加入。' : 'No partners yet. Create an invite, share it, or let a friend scan nearby.',
    joined: isZh ? '已加入好友小镇。' : 'Joined your friend town.',
    inviteReady: isZh ? '邀请已生成，可以转发或扫码。' : 'Invite ready. Share it or scan it.',
    loadFailed: isZh ? '联机状态暂时加载失败。' : 'Community state failed to load.',
    copied: isZh ? '邀请信息已复制。' : 'Invite copied.',
    greet: isZh ? 'Koko 去找伙伴打招呼啦' : 'Koko is heading over to say hi',
  }
})

const virtualFriendCopy = computed(() => {
  const isZh = settings.value.language === 'zh'
  return {
    title: isZh ? '虚拟好友设备' : 'Virtual friend device',
    body: isZh
      ? '不用第二台手机也可以测试联机。连接后，虚拟好友的 Koko 会进入小镇，自动散步并靠近你的 Koko 互动。'
      : 'Test co-op without a second phone. A virtual friend Koko joins town, wanders around, and reacts to your Koko.',
    connect: isZh ? '连接虚拟好友' : 'Connect',
    disconnect: isZh ? '断开虚拟好友' : 'Disconnect',
    connected: isZh ? '虚拟好友已连接，会在小镇里陪 Koko 散步。' : 'Virtual friend connected and walking around town.',
    disconnected: isZh ? '虚拟好友已断开。' : 'Virtual friend disconnected.',
    toast: isZh ? '虚拟好友已进入小镇' : 'Virtual friend joined town',
    name: isZh ? '虚拟好友设备' : 'Virtual Device',
    petName: isZh ? '好友 Koko' : 'Friend Koko',
  }
})

const getCommunityErrorText = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'errMsg' in error) {
    const errMsg = (error as { errMsg?: unknown }).errMsg
    return typeof errMsg === 'string' ? errMsg : ''
  }
  return ''
}

const buildCommunityFailureMessage = (error: unknown) => {
  const reason = getCommunityErrorText(error).trim()
  if (!reason) return communityCopy.value.loadFailed
  return settings.value.language === 'zh'
    ? `${communityCopy.value.loadFailed} 原因：${reason}`
    : `${communityCopy.value.loadFailed} Reason: ${reason}`
}

const ensureCommunitySession = async () => {
  if (authMode.value === 'guest') return false

  if (authMode.value !== 'wechat' || !user.value) {
    await login('wechat')
  }

  return communityAvailable.value
}

const guideSteps = computed<TownGuideStep[]>(() => {
  const isZh = settings.value.language === 'zh'
  return [
    {
      title: isZh ? '欢迎来到 Koko 小镇' : 'Welcome to Koko Town',
      body: isZh ? '这里是宠物探索、购物、任务和互动入口的地图页面。' : 'This map connects pet exploration, shop, tasks, and interaction entrances.',
      focus: 'map',
    },
    {
      title: isZh ? '宠物可以移动' : 'Your pet can move',
      body: isZh ? '点击地图任意位置，Koko 会用简单动画走过去。' : 'Tap anywhere on the map and Koko will walk there with a simple animation.',
      focus: 'pet',
    },
    {
      title: isZh ? '社区联机小镇' : 'Community co-op town',
      body: isZh ? '点右上角「联机」生成邀请。好友通过转发链接或线下扫码进入后，会出现在同一张地图上。' : 'Tap Co-op in the top-right to create an invite. Friends can join from a share link or by scanning your QR code nearby.',
      focus: 'community',
    },
    {
      title: isZh ? '在线和离线都是真实状态' : 'Online and offline are real',
      body: isZh ? '好友在线时宠物会继续更新位置；如果好友离开或断线，就显示离线，宠物停在最后一次所在的位置。' : 'Online friends keep updating their pet positions. When they leave or disconnect, they show offline and their pet stays at its last spot.',
      focus: 'community',
    },
    {
      title: isZh ? '每个地点都有作用' : 'Every location has a role',
      body: isZh ? '商店可兑换资源，任务板查看待办，游乐场可进入玩耍。' : 'The shop redeems resources, the board shows tasks, and the playground opens play.',
      focus: 'shop',
    },
    {
      title: isZh ? '点击地点查看详情' : 'Tap places for details',
      body: isZh ? '地点卡片支持左上角关闭，也可以点击遮罩关闭。' : 'Place cards can be closed from the top-left X or by tapping the overlay.',
      focus: 'task-board',
    },
  ]
})

const activeGuideStep = computed(() => guideSteps.value[guideStepIndex.value] ?? guideSteps.value[0])

const townActionText = computed(() => {
  const isZh = settings.value.language === 'zh'
  return {
    openHome: isZh ? '回到首页' : 'Open Home',
    openPlay: isZh ? '去玩耍' : 'Open Play',
    openChat: isZh ? '去聊天' : 'Open Chat',
  }
})

const shopItemCopy = (item: (typeof shopItems)[number]) => {
  if (settings.value.language !== 'zh') {
    return {
      name: item.name,
      description: item.description,
    }
  }

  const zhCopy = {
    meal: { name: '主食', description: '购买后进入库存，可在首页喂食时使用。' },
    water: { name: '水', description: '购买后进入库存，可在首页喂水时使用。' },
    'clean-kit': { name: '清洁用品', description: '购买后进入库存，可在首页清洁时使用。' },
  } as const

  return zhCopy[item.id]
}

const decodeInviteCode = (value?: string) => {
  if (!value) return ''

  const decoded = decodeURIComponent(value)
  const query = decoded.includes('?') ? decoded.slice(decoded.indexOf('?') + 1) : decoded
  const invitePair = query
    .split('&')
    .map((part) => part.split('='))
    .find(([key]) => key === 'invite')

  return (invitePair?.[1] || decoded).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()
}

const partnerStyle = (partner: TownCommunityPartner) => ({
  left: `${clamp(partner.x, PET_MIN_X, PET_MAX_X)}%`,
  top: `${clamp(partner.y, PET_MIN_Y, PET_MAX_Y)}%`,
  transitionDuration: partner.online ? '1600ms' : '0ms',
})

const partnerLastSeenLabel = (partner: TownCommunityPartner) => {
  if (partner.online) return communityCopy.value.online
  if (!partner.lastSeenAt) return communityCopy.value.offline

  const date = new Date(partner.lastSeenAt)
  if (Number.isNaN(date.getTime())) return communityCopy.value.offline

  return `${communityCopy.value.offline} ${date.toLocaleTimeString(settings.value.language === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`
}

const buildVirtualFriendPartner = (): TownCommunityPartner => ({
  openid: VIRTUAL_FRIEND_OPENID,
  nickName: virtualFriendCopy.value.name,
  avatarUrl: '',
  petName: virtualFriendCopy.value.petName,
  x: virtualFriendPosition.value.x,
  y: virtualFriendPosition.value.y,
  action: virtualFriendAction.value,
  online: true,
  isSelf: false,
  lastSeenAt: new Date().toISOString(),
})

const mergeVirtualFriendPartner = (partners: TownCommunityPartner[]) => {
  const realPartners = partners.filter((partner) => partner.openid !== VIRTUAL_FRIEND_OPENID)
  return virtualFriendConnected.value ? [...realPartners, buildVirtualFriendPartner()] : realPartners
}

const syncVirtualFriendPartner = () => {
  communityPartners.value = mergeVirtualFriendPartner(communityPartners.value)
}

const communityPayload = () => ({
  nickName: user.value?.nickName,
  avatarUrl: user.value?.avatarUrl,
  petName: pet.value.name,
  x: petPosition.value.x,
  y: petPosition.value.y,
  action: petAction.value,
})

const applyCommunityState = (state: Awaited<ReturnType<typeof loadTownCommunityState>>) => {
  const inviteCode = state.inviteCode || state.room.inviteCode || communityInviteCode.value
  const invitePath = state.invitePath || communityInvitePath.value || (inviteCode ? `/pages/town/index?invite=${inviteCode}` : '')

  communityPartners.value = mergeVirtualFriendPartner(state.partners)
  communityRoom.value = state.room
  communityInvitePath.value = invitePath
  communityInviteCode.value = inviteCode
  communityQrCodeFileID.value = state.qrCodeFileID || communityQrCodeFileID.value

  persistPanelInviteCode(inviteCode)
}

const loadCommunityState = async () => {
  if (!communityAvailable.value) return

  try {
    applyCommunityState(await loadTownCommunityState())
  } catch (error) {
    communityMessage.value = buildCommunityFailureMessage(error)
  }
}

const heartbeatCommunity = async () => {
  if (!communityAvailable.value) return

  try {
    applyCommunityState(await sendTownCommunityHeartbeat(communityPayload()))
    if (!communityMessage.value) return
    communityMessage.value = ''
  } catch (error) {
    communityMessage.value = buildCommunityFailureMessage(error)
  }
}

const queueCommunityHeartbeat = (delay = 500) => {
  if (communityMoveTimer) clearTimeout(communityMoveTimer)
  communityMoveTimer = setTimeout(() => {
    void heartbeatCommunity()
  }, delay)
}

const stopCommunityTimers = () => {
  if (communityHeartbeatTimer) clearInterval(communityHeartbeatTimer)
  if (communityRefreshTimer) clearInterval(communityRefreshTimer)
  if (communityMoveTimer) clearTimeout(communityMoveTimer)
  communityHeartbeatTimer = undefined
  communityRefreshTimer = undefined
  communityMoveTimer = undefined
}

const startCommunityTimers = () => {
  stopCommunityTimers()
  communityHeartbeatTimer = setInterval(() => {
    void heartbeatCommunity()
  }, 15000)
  communityRefreshTimer = setInterval(() => {
    void loadCommunityState()
  }, 5200)
}

const stopVirtualFriendTimer = () => {
  if (virtualFriendTimer) clearInterval(virtualFriendTimer)
  virtualFriendTimer = undefined
}

const moveVirtualFriendTo = (nextX: number, nextY: number, forcedAction?: PetActionType) => {
  const x = clamp(nextX, PET_MIN_X, PET_MAX_X)
  const y = clamp(nextY, PET_MIN_Y, PET_MAX_Y)
  const dx = x - virtualFriendPosition.value.x
  const dy = y - virtualFriendPosition.value.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  virtualFriendAction.value = forcedAction ?? (distance > 12 ? 'chase' : 'nuzzle')
  virtualFriendPosition.value = { x, y }
  syncVirtualFriendPartner()

  if (Math.abs(x - petPosition.value.x) < 10 && Math.abs(y - petPosition.value.y) < 10) {
    virtualFriendAction.value = 'sparkle'
    petAction.value = 'sparkle'
    syncVirtualFriendPartner()
    queueIdle(1800)
  }
}

const roamVirtualFriend = () => {
  if (!virtualFriendConnected.value || guideVisible.value || activeBuilding.value) return

  const followKoko = Math.random() > 0.38
  const baseX = followKoko ? petPosition.value.x : virtualFriendPosition.value.x
  const baseY = followKoko ? petPosition.value.y : virtualFriendPosition.value.y
  moveVirtualFriendTo(
    baseX + randomBetween(-14, 14),
    baseY + randomBetween(-10, 8),
  )
}

const startVirtualFriendTimer = () => {
  stopVirtualFriendTimer()
  virtualFriendTimer = setInterval(roamVirtualFriend, 3600)
}

const connectVirtualFriend = () => {
  virtualFriendConnected.value = true
  moveVirtualFriendTo(
    petPosition.value.x + randomBetween(9, 16),
    petPosition.value.y + randomBetween(-8, 3),
    'sparkle',
  )
  startVirtualFriendTimer()
  communityMessage.value = virtualFriendCopy.value.connected
  communityPanelOpen.value = false
  uni.showToast({ title: virtualFriendCopy.value.toast, icon: 'none' })
}

const disconnectVirtualFriend = () => {
  virtualFriendConnected.value = false
  stopVirtualFriendTimer()
  syncVirtualFriendPartner()
  communityMessage.value = virtualFriendCopy.value.disconnected
}

const toggleVirtualFriend = () => {
  if (virtualFriendConnected.value) {
    disconnectVirtualFriend()
    return
  }

  connectVirtualFriend()
}

const joinPendingInviteIfNeeded = async () => {
  if (!pendingInviteCode.value || !communityAvailable.value) return false

  communityLoading.value = true
  try {
    applyCommunityState(await joinTownInvite(pendingInviteCode.value, communityPayload()))
    communityMessage.value = communityCopy.value.joined
    communityPanelOpen.value = true
    pendingInviteCode.value = ''
    if (typeof uni.removeStorageSync === 'function') {
      uni.removeStorageSync(TOWN_PENDING_INVITE_STORAGE_KEY)
    }
    return true
  } catch (error) {
    communityMessage.value = buildCommunityFailureMessage(error)
    return false
  } finally {
    communityLoading.value = false
  }
}

const startCommunity = async () => {
  communityLoading.value = true
  try {
    const canUseCommunity = await ensureCommunitySession()
    if (!canUseCommunity) {
      communityMessage.value = communityCopy.value.unavailable
      return
    }

    const joined = await joinPendingInviteIfNeeded()
    if (!joined) {
      await heartbeatCommunity()
    }
    startCommunityTimers()
  } finally {
    communityLoading.value = false
  }
}

const markCommunityOfflineNow = () => {
  if (!communityAvailable.value) return
  void markTownCommunityOffline(communityPayload()).catch(() => undefined)
}

const restorePendingInvite = () => {
  if (pendingInviteCode.value || typeof uni.getStorageSync !== 'function') return
  const stored = decodeInviteCode(String(uni.getStorageSync(TOWN_PENDING_INVITE_STORAGE_KEY) || ''))
  if (stored) {
    pendingInviteCode.value = stored
  }
}

const openCommunityPanel = () => {
  communityPanelOpen.value = true
  void startCommunity()
}

const closeCommunityPanel = () => {
  communityPanelOpen.value = false
}

const createCommunityInvite = async () => {
  communityLoading.value = true
  try {
    const canUseCommunity = await ensureCommunitySession()
    if (!canUseCommunity) {
      communityMessage.value = communityCopy.value.unavailable
      return
    }

    communityPanelOpen.value = true
    applyCommunityState(await createTownInvite(communityPayload()))
    communityMessage.value = communityCopy.value.inviteReady
  } catch (error) {
    communityMessage.value = buildCommunityFailureMessage(error)
  } finally {
    communityLoading.value = false
  }
}

const copyInvite = () => {
  const inviteCode = activeCommunityInviteCode.value
  if (!inviteCode) {
    uni.showToast({ title: communityCopy.value.empty, icon: 'none' })
    return
  }

  const text = inviteCode
    ? `${communityCopy.value.title}: ${activeCommunityInvitePath.value || inviteCode}`
    : communityCopy.value.empty

  if (typeof uni.setClipboardData === 'function') {
    uni.setClipboardData({
      data: text,
      success: () => {
        uni.showToast({ title: communityCopy.value.copied, icon: 'none' })
      },
    })
  }
}

onShareAppMessage(() => {
  return {
    title: settings.value.language === 'zh' ? '邀请你加入 Koko 小镇' : 'Join my Koko Town',
    path: activeCommunityInvitePath.value || '/pages/town/index',
  }
})

const greetPartner = (partner: TownCommunityPartner) => {
  if (guideVisible.value) return

  movePetTo(
    partner.x + randomBetween(-5, 5),
    partner.y + randomBetween(4, 8),
  )
  petAction.value = 'sparkle'
  uni.showToast({
    title: communityCopy.value.greet,
    icon: 'none',
  })
  if (partner.openid === VIRTUAL_FRIEND_OPENID) {
    moveVirtualFriendTo(
      petPosition.value.x + randomBetween(-6, 6),
      petPosition.value.y + randomBetween(-8, 4),
      'sparkle',
    )
  }
  queueIdle(2200)
  queueCommunityHeartbeat(300)
}

const stopMoveTimer = () => {
  if (moveTimer) clearTimeout(moveTimer)
  moveTimer = undefined
}

const queueIdle = (delay: number) => {
  stopMoveTimer()
  moveTimer = setTimeout(() => {
    petAction.value = Math.random() > 0.6 ? 'sparkle' : 'idle'
  }, delay)
}

const movePetTo = (nextX: number, nextY: number) => {
  const x = clamp(nextX, PET_MIN_X, PET_MAX_X)
  const y = clamp(nextY, PET_MIN_Y, PET_MAX_Y)
  const dx = x - petPosition.value.x
  const dy = y - petPosition.value.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance < 1.2) return

  petMirror.value = dx < 0
  petAction.value = distance > 10 ? 'chase' : 'nuzzle'
  petMoveDurationMs.value = Math.round(clamp(distance * 120, 1400, 4200))
  petPosition.value = { x, y }
  queueIdle(petMoveDurationMs.value + 120)
  queueCommunityHeartbeat(700)
}

const roamSomewhere = () => {
  if (!walkingEnabled.value || activeBuilding.value || guideVisible.value) return
  movePetTo(
    petPosition.value.x + randomBetween(-18, 18),
    petPosition.value.y + randomBetween(-14, 14),
  )
}

const getTouchPoint = (event: any) => {
  const touch = event?.changedTouches?.[0] ?? event?.touches?.[0]
  if (touch) return { x: touch.pageX, y: touch.pageY }
  const detailX = Number(event?.detail?.x ?? 0)
  const detailY = Number(event?.detail?.y ?? 0)
  return { x: detailX, y: detailY }
}

const movePetFromMapTap = (event: any) => {
  if (guideVisible.value) return
  const { x, y } = getTouchPoint(event)
  const windowInfo = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : undefined
  const width = windowInfo?.windowWidth ?? 1
  const height = windowInfo?.windowHeight ?? 1
  movePetTo((x / width) * 100, (y / height) * 100)
}

const openBuildingPopup = (spot: BuildingHotspot) => {
  if (guideVisible.value) return
  movePetTo((spot.x / MAP_WIDTH) * 100, (spot.y / MAP_HEIGHT) * 100 + 10)
  activeBuilding.value = spot
  shopMessage.value = ''
}

const closeBuildingPopup = () => {
  activeBuilding.value = null
  shopMessage.value = ''
}

const buyShopItem = (itemId: (typeof shopItems)[number]['id']) => {
  const result = purchaseShopItem(itemId)
  shopMessage.value = result.message
  uni.showToast({
    title: result.message,
    icon: 'none',
  })

  if (result.success) {
    petAction.value = 'sparkle'
    queueIdle(2200)
  }
}

const goPlanner = () => {
  uni.switchTab({ url: '/pages/planner/index' })
}

const goHome = () => {
  closeBuildingPopup()
  uni.switchTab({ url: '/pages/home/index' })
}

const goHomePlay = () => {
  closeBuildingPopup()
  if (typeof uni.setStorageSync === 'function') {
    uni.setStorageSync(TOWN_HOME_ACTION_STORAGE_KEY, 'play')
  }
  uni.switchTab({ url: '/pages/home/index' })
}

const goChat = () => {
  closeBuildingPopup()
  uni.navigateTo({ url: '/pages/chat/index' })
}

const startTownGuide = () => {
  guideSavedPetPosition.value = { ...petPosition.value }
  stopMoveTimer()
  petMoveDurationMs.value = 900
  petMirror.value = TOWN_CENTER_PAW_POSITION.x < petPosition.value.x
  petPosition.value = { ...TOWN_CENTER_PAW_POSITION }
  guideVisible.value = true
  guideStepIndex.value = 0
  walkingEnabled.value = false
  petAction.value = 'idle'
}

const showTownGuideIfNeeded = () => {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return
  if (uni.getStorageSync(TOWN_GUIDE_STORAGE_KEY)) return
  startTownGuide()
}

const openTownGuide = () => {
  closeBuildingPopup()
  startTownGuide()
}

const finishTownGuide = () => {
  if (guideSavedPetPosition.value) {
    petMoveDurationMs.value = 0
    petPosition.value = guideSavedPetPosition.value
    guideSavedPetPosition.value = null
  }
  guideVisible.value = false
  walkingEnabled.value = true
  if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
    uni.setStorageSync(TOWN_GUIDE_STORAGE_KEY, true)
  }
  queueIdle(900)
}

const nextTownGuideStep = () => {
  if (guideStepIndex.value >= guideSteps.value.length - 1) {
    finishTownGuide()
    return
  }
  guideStepIndex.value += 1
}

watch(
  () => activeBuilding.value,
  (value) => {
    if (value) {
      walkingEnabled.value = false
      petAction.value = 'idle'
      return
    }
    walkingEnabled.value = !guideVisible.value
  },
)

watch(
  () => settings.value.language,
  () => {
    if (virtualFriendConnected.value) {
      syncVirtualFriendPartner()
    }
  },
)

onMounted(() => {
  void ensureTownMap()
  void syncEconomyFromCloud()
  petMirror.value = false
  showTownGuideIfNeeded()
  void startCommunity()
  roamTimer = setInterval(() => {
    roamSomewhere()
  }, 5200)
  queueIdle(1600)
})

onLoad((options = {}) => {
  const invite = decodeInviteCode(String(options.invite || options.scene || ''))
  if (invite) {
    pendingInviteCode.value = invite
  }
})

onShow(() => {
  restorePendingInvite()
  if (virtualFriendConnected.value) {
    startVirtualFriendTimer()
    syncVirtualFriendPartner()
  }
  void startCommunity()
})

onHide(() => {
  stopCommunityTimers()
  stopVirtualFriendTimer()
  markCommunityOfflineNow()
})

onBeforeUnmount(() => {
  stopMoveTimer()
  stopCommunityTimers()
  stopVirtualFriendTimer()
  markCommunityOfflineNow()
  if (roamTimer) clearInterval(roamTimer)
  roamTimer = undefined
})
</script>

<template>
  <view class="town-page">
    <view class="town-map-wrap" @tap="movePetFromMapTap">
      <view class="town-map">
        <image class="town-map__image" :src="townMapSrc" mode="scaleToFill" @error="handleTownMapError" />

        <view
          v-if="!activeBuilding && !communityPanelOpen"
          class="town-pet"
          :class="`town-pet--${petAction}`"
          :style="petStyle"
          @click.stop
        >
          <view class="town-pet__name">{{ pet.name }}</view>
          <PetLottieAvatar :size-rpx="PET_SIZE_RPX" :mirror="petMirror" />
          <view class="town-pet__shadow" />
        </view>

        <template v-if="!communityPanelOpen">
          <view
            v-for="partner in communityOtherPartners"
            :key="partner.openid"
            class="town-partner-pet"
            :class="{ 'town-partner-pet--offline': !partner.online }"
            :style="partnerStyle(partner)"
            @tap.stop="greetPartner(partner)"
          >
            <view class="town-partner-pet__name">
              <view class="town-partner-pet__dot" :class="{ 'town-partner-pet__dot--offline': !partner.online }" />
              <text>{{ partner.petName }}</text>
            </view>
            <PetLottieAvatar :size-rpx="158" :still="!partner.online" />
            <view class="town-partner-pet__shadow" />
          </view>
        </template>

        <view
          v-for="spot in hotspots"
          :key="spot.id"
          class="town-hotspot"
          :style="hotspotStyle(spot)"
          @tap.stop="openBuildingPopup(spot)"
        >
          <view class="town-hotspot__label">{{ spot.name }}</view>
        </view>
      </view>
    </view>

    <button class="town-guide-entry" hover-class="town-guide-entry--pressed" @tap.stop="openTownGuide">
      <text class="town-guide-entry__icon">?</text>
      <text>{{ guideEntryText }}</text>
    </button>

    <view class="town-community-hud">
      <button class="town-community-hud__button" hover-class="town-community-hud__button--pressed" @tap.stop="openCommunityPanel">
        <view class="town-community-hud__pulse" :class="{ 'town-community-hud__pulse--offline': !communityHudOnline }" />
        <view>
          <view class="town-community-hud__title">{{ communityCopy.openPanel }}</view>
          <view class="town-community-hud__meta">{{ communityOnlinePartners.length }} {{ communityCopy.online }}</view>
        </view>
      </button>
    </view>

    <view v-if="communityPanelOpen" class="town-community-layer" @tap="closeCommunityPanel">
      <view class="town-community-panel" @tap.stop>
        <button class="town-community-panel__close" @tap="closeCommunityPanel">×</button>
        <view class="town-community-panel__head">
          <view>
            <view class="town-community-panel__eyebrow">KOKO LINK</view>
            <view class="town-community-panel__title">{{ communityCopy.title }}</view>
          </view>
          <view class="town-community-panel__count">{{ communityOnlinePartners.length }}/{{ communityPartnerCapacity }}</view>
        </view>
        <view class="town-community-panel__subtitle">{{ communityCopy.subtitle }}</view>

        <view v-if="communityMessage" class="town-community-panel__message">{{ communityMessage }}</view>
        <view v-else-if="!communityAvailable" class="town-community-panel__message">{{ communityCopy.unavailable }}</view>

        <view class="town-virtual-device">
          <view class="town-virtual-device__icon">V</view>
          <view class="town-virtual-device__main">
            <view class="town-virtual-device__title">{{ virtualFriendCopy.title }}</view>
            <view class="town-virtual-device__body">{{ virtualFriendCopy.body }}</view>
          </view>
          <button
            class="town-virtual-device__button"
            :class="{ 'town-virtual-device__button--connected': virtualFriendConnected }"
            @tap="toggleVirtualFriend"
          >
            {{ virtualFriendConnected ? virtualFriendCopy.disconnect : virtualFriendCopy.connect }}
          </button>
        </view>

        <view class="town-community-panel__actions">
          <button class="town-community-panel__primary" :disabled="communityLoading || !communityAvailable" @tap="createCommunityInvite">
            {{ communityLoading ? '...' : communityCopy.invite }}
          </button>
          <button class="town-community-panel__ghost" :disabled="communityLoading || !communityAvailable" @tap="loadCommunityState">
            {{ communityCopy.refresh }}
          </button>
        </view>

        <view v-if="activeCommunityInviteCode" class="town-invite-card">
          <view>
            <view class="town-invite-card__label">{{ communityCopy.qrTitle }}</view>
            <view class="town-invite-card__code">{{ activeCommunityInviteCode }}</view>
          </view>
          <image v-if="communityQrCodeFileID" class="town-invite-card__qr" :src="communityQrCodeFileID" mode="aspectFit" />
          <view v-else class="town-invite-card__qr town-invite-card__qr--empty">{{ communityCopy.qrPending }}</view>
        </view>

        <view class="town-community-panel__share-row">
          <button class="town-community-panel__share" open-type="share" :disabled="communityLoading || !communityAvailable || !activeCommunityInviteCode">
            {{ communityCopy.share }}
          </button>
          <button class="town-community-panel__share town-community-panel__share--soft" :disabled="communityLoading || !communityAvailable || !activeCommunityInviteCode" @tap="copyInvite">
            {{ communityCopy.copy }}
          </button>
        </view>

        <view class="town-partner-list">
          <view v-if="!communityOtherPartners.length" class="town-partner-list__empty">{{ communityCopy.empty }}</view>
          <view v-for="partner in communityOtherPartners" :key="partner.openid" class="town-partner-row">
            <view class="town-partner-row__avatar">
              <image v-if="partner.avatarUrl" :src="partner.avatarUrl" mode="aspectFill" />
              <text v-else>{{ partner.nickName.charAt(0).toUpperCase() }}</text>
            </view>
            <view class="town-partner-row__main">
              <view class="town-partner-row__name">{{ partner.nickName }}</view>
              <view class="town-partner-row__pet">{{ partner.petName }} · {{ partnerLastSeenLabel(partner) }}</view>
            </view>
            <view class="town-partner-row__status" :class="{ 'town-partner-row__status--offline': !partner.online }" />
          </view>
        </view>
      </view>
    </view>

    <view v-if="activeBuilding" class="town-popup-mask" @tap="closeBuildingPopup">
      <view class="town-popup" @tap.stop>
        <button class="town-popup__close" @tap.stop="closeBuildingPopup">×</button>
        <view class="town-popup__title">{{ activeBuilding.name }}</view>
        <view class="town-popup__description">{{ activeBuilding.description }}</view>

        <view v-if="activeBuilding.id === 'shop'" class="town-shop">
          <view class="town-shop__balance">
            <view class="town-coin-icon" />
            <text>{{ economy.coins }}</text>
          </view>
          <view
            v-for="item in shopItems"
            :key="item.id"
            class="town-shop__item"
          >
            <view>
              <view class="town-shop__name">{{ shopItemCopy(item).name }}</view>
              <view class="town-shop__copy">{{ shopItemCopy(item).description }}</view>
              <view class="town-shop__owned">{{ shopText.owned }} {{ economy.inventory[item.resourceKey] ?? 0 }}</view>
            </view>
            <button class="town-shop__buy" @click="buyShopItem(item.id)">
              <view class="town-coin-icon town-coin-icon--small" />
              <text>{{ item.price }}</text>
            </button>
          </view>
          <view v-if="shopMessage" class="town-shop__message">{{ shopMessage }}</view>
        </view>

        <view v-else-if="activeBuilding.id === 'task-board'" class="town-board">
          <view class="town-board__stat">{{ townPendingTasks.length }} {{ shopText.pending }} · {{ completedTasks.length }} {{ shopText.done }}</view>
          <view v-for="task in townPendingTasks" :key="task.id" class="town-board__task">{{ task.title }}</view>
          <view v-for="task in townCompletedTasks" :key="task.id" class="town-board__task town-board__task--done">{{ task.title }}</view>
          <button class="town-popup__button" @click="goPlanner">{{ shopText.openTasks }}</button>
        </view>

        <view v-else-if="activeBuilding.id === 'talk-house'" class="town-board">
          <view class="town-board__stat">{{ shopText.chatHint }}</view>
          <button class="town-popup__button" @click="goChat">{{ townActionText.openChat }}</button>
        </view>

        <button v-else-if="activeBuilding.id === 'home'" class="town-popup__button" @click="goHome">{{ townActionText.openHome }}</button>
        <button v-else-if="activeBuilding.id === 'playground'" class="town-popup__button" @click="goHomePlay">{{ townActionText.openPlay }}</button>
        <button v-else class="town-popup__button" @click="closeBuildingPopup">{{ t.town.ok }}</button>
      </view>
    </view>

    <view v-if="guideVisible" class="town-guide-layer" @tap.stop>
      <view class="town-guide-layer__mask" />
      <view class="town-guide-highlight" :style="guideHighlightStyle" />
      <view class="town-guide-bubble">
        <button class="town-guide-bubble__close" @tap.stop="finishTownGuide">×</button>
        <view class="town-guide-bubble__pet">
          <PetLottieAvatar :size-rpx="112" />
        </view>
        <view class="town-guide-bubble__step">{{ guideStepIndex + 1 }} / {{ guideSteps.length }}</view>
        <view class="town-guide-bubble__title">{{ activeGuideStep.title }}</view>
        <view class="town-guide-bubble__body">{{ activeGuideStep.body }}</view>
        <button class="town-guide-bubble__button" @tap.stop="nextTownGuideStep">{{ guideButtonText }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.town-page {
  bottom: 0;
  height: 100vh;
  left: 0;
  min-height: 100vh;
  overflow: hidden;
  position: fixed;
  right: 0;
  top: 0;
  width: 100vw;
}

.town-map-wrap,
.town-map {
  height: 100vh;
  overflow: hidden;
  width: 100vw;
}

.town-map {
  line-height: 0;
  position: relative;
}

.town-map__image {
  display: block;
  height: 100%;
  width: 100%;
}

.town-hotspot {
  box-sizing: border-box;
  position: absolute;
  z-index: 4;
}

.town-hotspot__label {
  background: rgba(255, 253, 248, 0.88);
  border: 2rpx solid rgba(95, 199, 168, 0.42);
  border-radius: 999rpx;
  box-shadow: 0 10rpx 22rpx rgba(73, 112, 88, 0.14);
  color: #365f56;
  font-size: 25rpx;
  font-weight: 800;
  left: 50%;
  line-height: 1.4;
  padding: 8rpx 24rpx;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}

.town-guide-entry {
  align-items: center;
  background: rgba(255, 253, 248, 0.94);
  border: 2rpx solid rgba(95, 199, 168, 0.26);
  border-radius: 999rpx;
  box-shadow: 0 12rpx 28rpx rgba(40, 72, 59, 0.16);
  color: #365f56;
  display: flex;
  font-size: 24rpx;
  font-weight: 900;
  gap: 8rpx;
  left: 24rpx;
  line-height: 1;
  margin: 0;
  padding: 14rpx 20rpx 14rpx 14rpx;
  position: fixed;
  top: calc(22rpx + env(safe-area-inset-top));
  z-index: 18;
}

.town-guide-entry::after {
  border: none;
}

.town-guide-entry--pressed {
  transform: scale(0.96);
}

.town-guide-entry__icon {
  align-items: center;
  background: linear-gradient(135deg, #ffe08a, #8adfb0);
  border-radius: 50%;
  color: #173f38;
  display: flex;
  height: 34rpx;
  justify-content: center;
  width: 34rpx;
}

.town-popup-mask {
  align-items: center;
  background: rgba(47, 67, 58, 0.42);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  padding: 32rpx;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 40;
}

.town-pet {
  pointer-events: auto;
  position: absolute;
  transform: translate(-50%, -100%);
  transition-property: left, top;
  transition-timing-function: linear;
  z-index: 3;
}

.town-pet__name {
  background: rgba(255, 253, 248, 0.9);
  border-radius: 999rpx;
  color: #365f56;
  font-size: 22rpx;
  font-weight: 800;
  left: 50%;
  line-height: 1.2;
  padding: 8rpx 20rpx;
  position: absolute;
  top: -42rpx;
  transform: translateX(-50%);
  white-space: nowrap;
}

.town-pet__shadow {
  background: rgba(37, 72, 54, 0.18);
  border-radius: 50%;
  bottom: 24rpx;
  filter: blur(3rpx);
  height: 40rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 150rpx;
}

.town-pet--idle {
  animation: town-pet-float 3s ease-in-out infinite;
}

.town-pet--sparkle {
  animation: town-pet-float 1.6s ease-in-out infinite;
}

.town-pet--chase,
.town-pet--nuzzle {
  animation: town-pet-walk 0.85s ease-in-out infinite;
}

.town-pet--chase .town-pet__shadow,
.town-pet--nuzzle .town-pet__shadow {
  animation: town-pet-shadow 0.85s ease-in-out infinite;
}

.town-partner-pet {
  opacity: 0.95;
  pointer-events: auto;
  position: absolute;
  transform: translate(-50%, -100%);
  transition-property: left, top;
  transition-timing-function: ease-out;
  z-index: 3;
}

.town-partner-pet--offline {
  filter: grayscale(0.45);
  opacity: 0.62;
}

.town-partner-pet__name {
  align-items: center;
  background: rgba(255, 253, 248, 0.9);
  border: 2rpx solid rgba(95, 199, 168, 0.18);
  border-radius: 999rpx;
  color: #365f56;
  display: flex;
  font-size: 20rpx;
  font-weight: 900;
  gap: 8rpx;
  left: 50%;
  line-height: 1.2;
  max-width: 180rpx;
  overflow: hidden;
  padding: 7rpx 14rpx;
  position: absolute;
  text-overflow: ellipsis;
  top: -34rpx;
  transform: translateX(-50%);
  white-space: nowrap;
}

.town-partner-pet__dot {
  background: #5fc782;
  border-radius: 50%;
  box-shadow: 0 0 12rpx rgba(95, 199, 130, 0.68);
  flex: 0 0 auto;
  height: 13rpx;
  width: 13rpx;
}

.town-partner-pet__dot--offline {
  background: #b4a58f;
  box-shadow: none;
}

.town-partner-pet__shadow {
  background: rgba(37, 72, 54, 0.14);
  border-radius: 50%;
  bottom: 18rpx;
  filter: blur(3rpx);
  height: 28rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 104rpx;
}

.town-community-hud {
  position: fixed;
  right: 24rpx;
  top: calc(22rpx + env(safe-area-inset-top));
  z-index: 18;
}

.town-community-hud__button {
  align-items: center;
  background: rgba(255, 253, 248, 0.94);
  border: 2rpx solid rgba(95, 199, 168, 0.26);
  border-radius: 999rpx;
  box-shadow: 0 12rpx 28rpx rgba(40, 72, 59, 0.16);
  color: #365f56;
  display: flex;
  gap: 12rpx;
  margin: 0;
  min-height: 62rpx;
  padding: 10rpx 18rpx 10rpx 14rpx;
}

.town-community-hud__button::after,
.town-community-panel__close::after,
.town-community-panel__primary::after,
.town-community-panel__ghost::after,
.town-community-panel__share::after,
.town-virtual-device__button::after {
  border: none;
}

.town-community-hud__button--pressed {
  transform: scale(0.96);
}

.town-community-hud__pulse {
  background: #5fc782;
  border-radius: 50%;
  box-shadow: 0 0 0 8rpx rgba(95, 199, 130, 0.16), 0 0 18rpx rgba(95, 199, 130, 0.62);
  height: 18rpx;
  width: 18rpx;
}

.town-community-hud__pulse--offline {
  background: #b4a58f;
  box-shadow: 0 0 0 8rpx rgba(180, 165, 143, 0.12);
}

.town-community-hud__title {
  color: #253047;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 1.12;
}

.town-community-hud__meta {
  color: #7d8a74;
  font-size: 19rpx;
  font-weight: 800;
  line-height: 1.12;
  margin-top: 4rpx;
}

.town-community-layer {
  align-items: flex-end;
  background: rgba(47, 67, 58, 0.38);
  bottom: 0;
  display: flex;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 80;
}

.town-community-panel {
  background: linear-gradient(180deg, #fffdf8 0%, #eefbf2 100%);
  border-radius: 32rpx 32rpx 0 0;
  box-shadow: 0 -18rpx 48rpx rgba(47, 67, 58, 0.2);
  box-sizing: border-box;
  max-height: 86vh;
  overflow-y: auto;
  padding: 30rpx 26rpx calc(30rpx + env(safe-area-inset-bottom));
  position: relative;
  width: 100%;
  z-index: 81;
}

.town-community-panel__close {
  align-items: center;
  background: rgba(255, 240, 202, 0.9);
  border-radius: 50%;
  color: #7d644f;
  display: flex;
  font-size: 34rpx;
  font-weight: 900;
  height: 54rpx;
  justify-content: center;
  line-height: 54rpx;
  margin: 0;
  padding: 0;
  position: absolute;
  right: 24rpx;
  top: 24rpx;
  width: 54rpx;
}

.town-community-panel__head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding-right: 72rpx;
}

.town-community-panel__eyebrow {
  color: #5f8c78;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 3rpx;
}

.town-community-panel__title {
  color: #253047;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.16;
  margin-top: 6rpx;
}

.town-community-panel__count {
  background: #fff0ca;
  border-radius: 999rpx;
  color: #735420;
  font-size: 24rpx;
  font-weight: 900;
  padding: 10rpx 18rpx;
}

.town-community-panel__subtitle,
.town-community-panel__message,
.town-partner-list__empty {
  color: #6d7890;
  font-size: 25rpx;
  line-height: 1.5;
  margin-top: 14rpx;
}

.town-community-panel__message {
  background: rgba(255, 240, 202, 0.64);
  border-radius: 18rpx;
  color: #7d644f;
  font-weight: 800;
  padding: 14rpx 16rpx;
}

.town-virtual-device {
  align-items: center;
  background: rgba(255, 255, 255, 0.78);
  border: 2rpx solid rgba(95, 199, 168, 0.18);
  border-radius: 22rpx;
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
  padding: 16rpx;
}

.town-virtual-device__icon {
  align-items: center;
  background: linear-gradient(135deg, #ffe08a, #8adfb0);
  border-radius: 18rpx;
  color: #173f38;
  display: flex;
  flex: 0 0 auto;
  font-size: 28rpx;
  font-weight: 900;
  height: 68rpx;
  justify-content: center;
  width: 68rpx;
}

.town-virtual-device__main {
  flex: 1;
  min-width: 0;
}

.town-virtual-device__title {
  color: #253047;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 1.2;
}

.town-virtual-device__body {
  color: #7d8a74;
  font-size: 21rpx;
  font-weight: 700;
  line-height: 1.38;
  margin-top: 6rpx;
}

.town-virtual-device__button {
  background: rgba(255, 240, 202, 0.96);
  border-radius: 999rpx;
  color: #735420;
  flex: 0 0 auto;
  font-size: 22rpx;
  font-weight: 900;
  height: 64rpx;
  line-height: 64rpx;
  margin: 0;
  max-width: 190rpx;
  padding: 0 18rpx;
}

.town-virtual-device__button--connected {
  background: rgba(232, 249, 241, 0.96);
  color: #365f56;
}

.town-community-panel__actions,
.town-community-panel__share-row {
  display: grid;
  gap: 14rpx;
  grid-template-columns: 1fr 1fr;
  margin-top: 20rpx;
}

.town-community-panel__primary,
.town-community-panel__ghost,
.town-community-panel__share {
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 900;
  height: 78rpx;
  line-height: 78rpx;
  margin: 0;
  padding: 0 18rpx;
}

.town-community-panel__primary {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  color: #173f38;
}

.town-community-panel__ghost,
.town-community-panel__share--soft {
  background: rgba(255, 255, 255, 0.82);
  color: #365f56;
}

.town-community-panel__share {
  background: linear-gradient(135deg, #ffe08a, #f0b94a);
  color: #4d3219;
}

.town-community-panel__primary[disabled],
.town-community-panel__ghost[disabled],
.town-community-panel__share[disabled] {
  opacity: 0.48;
}

.town-invite-card {
  align-items: center;
  background: rgba(255, 255, 255, 0.72);
  border: 2rpx solid rgba(95, 199, 168, 0.16);
  border-radius: 24rpx;
  display: flex;
  gap: 18rpx;
  justify-content: space-between;
  margin-top: 20rpx;
  padding: 18rpx;
}

.town-invite-card__label {
  color: #7d8a74;
  font-size: 22rpx;
  font-weight: 800;
}

.town-invite-card__code {
  color: #253047;
  font-size: 38rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
  margin-top: 8rpx;
}

.town-invite-card__qr {
  background: #fffdf8;
  border-radius: 18rpx;
  height: 156rpx;
  width: 156rpx;
}

.town-invite-card__qr--empty {
  align-items: center;
  color: #8a7a68;
  display: flex;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.28;
  padding: 14rpx;
  text-align: center;
}

.town-partner-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 20rpx;
}

.town-partner-row {
  align-items: center;
  background: rgba(255, 255, 255, 0.72);
  border: 2rpx solid rgba(176, 143, 102, 0.12);
  border-radius: 20rpx;
  display: flex;
  gap: 16rpx;
  padding: 16rpx;
}

.town-partner-row__avatar {
  align-items: center;
  background: linear-gradient(135deg, #ffe08a, #8adfb0);
  border-radius: 18rpx;
  color: #365f56;
  display: flex;
  flex: 0 0 auto;
  font-size: 28rpx;
  font-weight: 900;
  height: 68rpx;
  justify-content: center;
  overflow: hidden;
  width: 68rpx;
}

.town-partner-row__avatar image {
  height: 100%;
  width: 100%;
}

.town-partner-row__main {
  flex: 1;
  min-width: 0;
}

.town-partner-row__name {
  color: #253047;
  font-size: 28rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.town-partner-row__pet {
  color: #7d8a74;
  font-size: 22rpx;
  font-weight: 700;
  margin-top: 4rpx;
}

.town-partner-row__status {
  background: #5fc782;
  border-radius: 50%;
  box-shadow: 0 0 12rpx rgba(95, 199, 130, 0.62);
  height: 18rpx;
  width: 18rpx;
}

.town-partner-row__status--offline {
  background: #b4a58f;
  box-shadow: none;
}

.town-popup {
  background: #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 30rpx;
  box-shadow: 0 24rpx 48rpx rgba(47, 67, 58, 0.22);
  max-width: 600rpx;
  padding: 76rpx 30rpx 28rpx;
  position: relative;
  width: 100%;
}

.town-popup__close {
  align-items: center;
  background: rgba(255, 240, 202, 0.9);
  border-radius: 50%;
  color: #7d644f;
  display: flex;
  font-size: 38rpx;
  font-weight: 900;
  height: 56rpx;
  justify-content: center;
  left: 20rpx;
  line-height: 56rpx;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 18rpx;
  width: 56rpx;
}

.town-popup__close::after {
  border: none;
}

.town-popup__title {
  color: #253047;
  font-size: 34rpx;
  font-weight: 800;
}

.town-popup__description {
  color: #8a7a68;
  font-size: 28rpx;
  line-height: 1.6;
  margin-top: 14rpx;
}

.town-popup__button {
  background: linear-gradient(135deg, #8adfb0, #6bd4c7);
  border: none;
  border-radius: 999rpx;
  color: #173f38;
  font-size: 28rpx;
  font-weight: 800;
  height: 80rpx;
  line-height: 80rpx;
  margin-top: 26rpx;
}

.town-popup__button::after {
  border: none;
}

.town-shop {
  margin-top: 22rpx;
}

.town-shop__balance {
  align-items: center;
  background: rgba(255, 232, 173, 0.72);
  border-radius: 999rpx;
  color: #735420;
  display: inline-flex;
  gap: 10rpx;
  font-size: 25rpx;
  font-weight: 800;
  line-height: 1;
  padding: 14rpx 22rpx;
}

.town-coin-icon {
  background:
    radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.82) 0, rgba(255, 255, 255, 0.82) 8rpx, transparent 9rpx),
    linear-gradient(135deg, #ffe08a, #f0b94a 62%, #c98624);
  border: 3rpx solid rgba(139, 93, 22, 0.18);
  border-radius: 50%;
  box-shadow: inset 0 -4rpx 0 rgba(130, 88, 20, 0.14), 0 4rpx 8rpx rgba(167, 124, 72, 0.16);
  box-sizing: border-box;
  height: 34rpx;
  position: relative;
  width: 34rpx;
}

.town-coin-icon::after {
  background: rgba(116, 79, 19, 0.24);
  border-radius: 999rpx;
  content: '';
  height: 16rpx;
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 6rpx;
}

.town-coin-icon--small {
  height: 28rpx;
  width: 28rpx;
}

.town-coin-icon--small::after {
  height: 13rpx;
  width: 5rpx;
}

.town-shop__item {
  align-items: center;
  background: rgba(245, 250, 238, 0.72);
  border: 2rpx solid rgba(95, 199, 168, 0.16);
  border-radius: 22rpx;
  display: flex;
  gap: 18rpx;
  justify-content: space-between;
  margin-top: 16rpx;
  padding: 18rpx;
}

.town-shop__name {
  color: #253047;
  font-size: 28rpx;
  font-weight: 800;
}

.town-shop__copy,
.town-shop__owned,
.town-board__stat {
  color: #7d8a74;
  font-size: 23rpx;
  line-height: 1.45;
  margin-top: 6rpx;
}

.town-shop__buy {
  align-items: center;
  background: linear-gradient(135deg, #ffe08a, #f0b94a);
  border: none;
  border-radius: 999rpx;
  color: #513915;
  display: flex;
  flex: 0 0 auto;
  font-size: 25rpx;
  font-weight: 900;
  gap: 8rpx;
  height: 70rpx;
  justify-content: center;
  line-height: 1;
  min-width: 86rpx;
  padding: 0 18rpx;
}

.town-shop__buy::after {
  border: none;
}

.town-shop__message {
  color: #365f56;
  font-size: 24rpx;
  font-weight: 700;
  margin-top: 16rpx;
}

.town-board {
  margin-top: 20rpx;
}

.town-board__task {
  background: rgba(255, 255, 255, 0.76);
  border-radius: 18rpx;
  color: #365f56;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.4;
  margin-top: 12rpx;
  padding: 14rpx 16rpx;
}

.town-board__task--done {
  color: #8a7a68;
  text-decoration: line-through;
}

.town-guide-layer {
  bottom: 0;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 60;
}

.town-guide-layer__mask {
  background: rgba(20, 36, 32, 0.54);
  bottom: 0;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.town-guide-highlight {
  border: 4rpx solid rgba(255, 224, 138, 0.95);
  border-radius: 28rpx;
  box-shadow: 0 0 0 9999rpx rgba(20, 36, 32, 0.12), 0 0 28rpx rgba(255, 224, 138, 0.48);
  box-sizing: border-box;
  position: absolute;
  z-index: 61;
}

.town-guide-bubble {
  background: #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 28rpx;
  bottom: calc(46rpx + env(safe-area-inset-bottom));
  box-shadow: 0 24rpx 48rpx rgba(20, 36, 32, 0.28);
  box-sizing: border-box;
  left: 34rpx;
  padding: 26rpx;
  position: absolute;
  right: 34rpx;
  z-index: 62;
}

.town-guide-bubble__pet {
  height: 112rpx;
  overflow: visible;
  position: absolute;
  right: 18rpx;
  top: 18rpx;
  width: 112rpx;
  z-index: 1;
}

.town-guide-bubble__close {
  align-items: center;
  background: rgba(255, 240, 202, 0.92);
  border-radius: 50%;
  color: #7d644f;
  display: flex;
  font-size: 32rpx;
  font-weight: 900;
  height: 50rpx;
  justify-content: center;
  line-height: 50rpx;
  margin: 0;
  padding: 0;
  position: absolute;
  right: 18rpx;
  top: -62rpx;
  width: 50rpx;
  z-index: 3;
}

.town-guide-bubble__close::after {
  border: none;
}

.town-guide-bubble__step {
  color: #5f8c78;
  font-size: 22rpx;
  font-weight: 900;
  padding-right: 128rpx;
}

.town-guide-bubble__title {
  color: #253047;
  font-size: 34rpx;
  font-weight: 900;
  margin-top: 8rpx;
  padding-right: 128rpx;
}

.town-guide-bubble__body {
  color: #6d7890;
  font-size: 26rpx;
  line-height: 1.55;
  margin-top: 12rpx;
  padding-right: 128rpx;
}

.town-guide-bubble__button {
  background: linear-gradient(135deg, #ffe08a, #8adfb0);
  border-radius: 999rpx;
  color: #173f38;
  font-size: 28rpx;
  font-weight: 900;
  height: 78rpx;
  line-height: 78rpx;
  margin: 24rpx 0 0;
}

.town-guide-bubble__button::after {
  border: none;
}

:deep(.page-shell) {
  bottom: 0;
  left: 0;
  min-height: 100vh;
  overflow: hidden;
  padding: 0;
  position: fixed;
  right: 0;
  top: 0;
}

:deep(.app-card) {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  height: 100%;
  margin: 0;
  max-width: none;
  padding: 0;
  width: 100%;
}

:deep(.view-container) {
  height: 100%;
  margin-top: 0;
  width: 100%;
}

@keyframes town-pet-float {
  0%,
  100% {
    margin-top: 0;
  }
  50% {
    margin-top: -10rpx;
  }
}

@keyframes town-pet-walk {
  0%,
  100% {
    margin-top: 0;
  }
  50% {
    margin-top: -16rpx;
  }
}

@keyframes town-pet-shadow {
  0%,
  100% {
    opacity: 0.22;
    transform: translateX(-50%) scaleX(1);
  }
  50% {
    opacity: 0.14;
    transform: translateX(-50%) scaleX(0.88);
  }
}
</style>
