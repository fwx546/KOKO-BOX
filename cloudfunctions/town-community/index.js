const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

const rooms = db.collection('town_rooms')
const presence = db.collection('town_presence')
const users = db.collection('users')
const pets = db.collection('pets')

const ONLINE_TTL_MS = 90 * 1000
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

const nowIso = () => new Date().toISOString()
const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, Math.round(numeric * 100) / 100))
}

const normalizeText = (value, maxLength = 80) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

const createInviteCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

const publicRoom = (room) => ({
  id: room?._id || '',
  ownerOpenid: room?.ownerOpenid || '',
  inviteCode: room?.inviteCode || '',
  inviteExpiresAt: room?.inviteExpiresAt || '',
  memberCount: Array.isArray(room?.memberOpenids) ? room.memberOpenids.length : 0,
  updatedAt: room?.updatedAt || '',
})

const getByOpenidList = async (collection, openid) => {
  const result = await collection.where({ _openid: openid }).limit(100).get()
  return result.data || []
}

const keepSingleByOpenid = async (collection, openid) => {
  const records = await getByOpenidList(collection, openid)
  if (!records.length) return null

  const [primary, ...duplicates] = records
  if (duplicates.length) {
    await Promise.all(
      duplicates
        .filter((item) => item && item._id)
        .map((item) => collection.doc(item._id).remove()),
    )
  }

  return primary
}

const findRoomForMember = async (openid) => {
  const result = await rooms
    .where({ memberOpenids: openid })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()

  return result.data?.[0] || null
}

const createRoomForUser = async (openid) => {
  const timestamp = nowIso()
  const payload = {
    _openid: openid,
    ownerOpenid: openid,
    memberOpenids: [openid],
    inviteCode: '',
    inviteExpiresAt: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const created = await rooms.add({ data: payload })
  return {
    _id: created._id,
    ...payload,
  }
}

const ensureRoomForUser = async (openid) => {
  const room = await findRoomForMember(openid)
  return room || createRoomForUser(openid)
}

const loadProfiles = async (openids) => {
  if (!openids.length) return {}

  const [userResult, petResult] = await Promise.all([
    users.where({ _openid: _.in(openids) }).limit(100).get(),
    pets.where({ _openid: _.in(openids) }).limit(100).get(),
  ])

  const userMap = Object.fromEntries((userResult.data || []).map((item) => [item._openid, item]))
  const petMap = Object.fromEntries((petResult.data || []).map((item) => [item._openid, item]))

  return Object.fromEntries(
    openids.map((openid, index) => {
      const user = userMap[openid] || {}
      const pet = petMap[openid] || {}
      return [
        openid,
        {
          nickName: normalizeText(user.nickName, 40) || `Koko Friend ${index + 1}`,
          avatarUrl: normalizeText(user.avatarUrl, 300),
          petName: normalizeText(pet.name, 24) || 'Koko',
        },
      ]
    }),
  )
}

const loadPresenceByMembers = async (memberOpenids) => {
  if (!memberOpenids.length) return {}

  const result = await presence.where({ _openid: _.in(memberOpenids) }).limit(100).get()
  return Object.fromEntries((result.data || []).map((item) => [item._openid, item]))
}

const loadState = async (openid, room) => {
  const memberOpenids = Array.isArray(room.memberOpenids) ? room.memberOpenids : [openid]
  const [profiles, presenceMap] = await Promise.all([
    loadProfiles(memberOpenids),
    loadPresenceByMembers(memberOpenids),
  ])
  const timestampMs = Date.now()

  const partners = memberOpenids.map((memberOpenid, index) => {
    const profile = profiles[memberOpenid] || {}
    const currentPresence = presenceMap[memberOpenid] || {}
    const lastSeenAt = normalizeText(currentPresence.lastSeenAt, 40)
    const lastSeenMs = new Date(lastSeenAt || 0).getTime() || 0
    const online = Boolean(lastSeenMs && timestampMs - lastSeenMs <= ONLINE_TTL_MS && currentPresence.online !== false)

    return {
      openid: memberOpenid,
      nickName: normalizeText(currentPresence.nickName, 40) || profile.nickName || `Koko Friend ${index + 1}`,
      avatarUrl: normalizeText(currentPresence.avatarUrl, 300) || profile.avatarUrl || '',
      petName: normalizeText(currentPresence.petName, 24) || profile.petName || 'Koko',
      x: clampNumber(currentPresence.x, 8, 92, 18 + index * 10),
      y: clampNumber(currentPresence.y, 24, 92, 72),
      action: normalizeText(currentPresence.action, 20) || 'idle',
      online,
      isSelf: memberOpenid === openid,
      lastSeenAt,
    }
  })

  return {
    room: publicRoom(room),
    partners,
    invitePath: room.inviteCode ? `/pages/town/index?invite=${room.inviteCode}` : '',
    inviteCode: room.inviteCode || '',
    qrCodeFileID: room.qrCodeFileID || '',
  }
}

const savePresence = async (openid, event, room) => {
  const timestamp = nowIso()
  const payload = {
    roomId: room._id,
    ownerRoomOpenid: room.ownerOpenid,
    nickName: normalizeText(event.nickName, 40),
    avatarUrl: normalizeText(event.avatarUrl, 300),
    petName: normalizeText(event.petName, 24) || 'Koko',
    x: clampNumber(event.x, 8, 92, 52),
    y: clampNumber(event.y, 24, 92, 76),
    action: normalizeText(event.action, 20) || 'idle',
    online: event.online !== false,
    lastSeenAt: timestamp,
    updatedAt: timestamp,
  }

  const existing = await keepSingleByOpenid(presence, openid)
  if (existing?._id) {
    await presence.doc(existing._id).update({ data: payload })
    return {
      ...existing,
      ...payload,
    }
  }

  const created = await presence.add({
    data: {
      _openid: openid,
      ...payload,
      createdAt: timestamp,
    },
  })

  return {
    _id: created._id,
    _openid: openid,
    ...payload,
  }
}

const createQrCode = async (inviteCode) => {
  if (!cloud.openapi?.wxacode?.getUnlimited) return null

  try {
    const wxacode = await cloud.openapi.wxacode.getUnlimited({
      scene: `invite=${inviteCode}`,
      page: 'pages/town/index',
      checkPath: false,
      width: 430,
    })
    const buffer = wxacode?.buffer
    if (!buffer) return null

    const uploaded = await cloud.uploadFile({
      cloudPath: `town-invites/${inviteCode}-${Date.now()}.jpg`,
      fileContent: buffer,
    })

    return normalizeText(uploaded?.fileID, 300)
  } catch (error) {
    console.warn('[town-community] QR generation failed:', error?.message || error)
    return null
  }
}

const ensureInvite = async (room) => {
  const currentExpiresAt = new Date(room.inviteExpiresAt || 0).getTime() || 0
  if (room.inviteCode && currentExpiresAt > Date.now()) {
    if (!room.qrCodeFileID) {
      const qrCodeFileID = await createQrCode(room.inviteCode)
      if (qrCodeFileID) {
        const data = {
          qrCodeFileID,
          updatedAt: nowIso(),
        }
        await rooms.doc(room._id).update({ data })
        return {
          ...room,
          ...data,
        }
      }
    }

    return room
  }

  const inviteCode = createInviteCode()
  const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()
  const qrCodeFileID = await createQrCode(inviteCode)
  const data = {
    inviteCode,
    inviteExpiresAt,
    qrCodeFileID: qrCodeFileID || '',
    updatedAt: nowIso(),
  }
  await rooms.doc(room._id).update({ data })
  return {
    ...room,
    ...data,
  }
}

const joinInvite = async (openid, inviteCode) => {
  const code = normalizeText(inviteCode, 32).toUpperCase()
  if (!code) {
    throw new Error('Missing invite code.')
  }

  const result = await rooms.where({ inviteCode: code }).limit(1).get()
  const room = result.data?.[0]

  if (!room?._id) {
    throw new Error('Invite was not found.')
  }

  if (room.inviteExpiresAt && new Date(room.inviteExpiresAt).getTime() < Date.now()) {
    throw new Error('Invite has expired.')
  }

  const memberOpenids = Array.from(new Set([...(room.memberOpenids || []), openid])).slice(0, 12)
  const data = {
    memberOpenids,
    updatedAt: nowIso(),
  }
  await rooms.doc(room._id).update({ data })

  return {
    ...room,
    ...data,
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    throw new Error('Unable to identify the current WeChat user.')
  }

  const action = ['load', 'heartbeat', 'createInvite', 'joinInvite', 'offline'].includes(event.action)
    ? event.action
    : 'load'

  if (action === 'joinInvite') {
    const room = await joinInvite(OPENID, event.inviteCode || event.invite)
    await savePresence(OPENID, event, room)
    return loadState(OPENID, room)
  }

  let room = await ensureRoomForUser(OPENID)

  if (action === 'createInvite') {
    room = await ensureInvite(room)
    return {
      ...(await loadState(OPENID, room)),
      qrCodeFileID: room.qrCodeFileID || '',
    }
  }

  if (action === 'heartbeat') {
    await savePresence(OPENID, event, room)
    return loadState(OPENID, room)
  }

  if (action === 'offline') {
    await savePresence(
      OPENID,
      {
        ...event,
        online: false,
      },
      room,
    )
    return loadState(OPENID, room)
  }

  return loadState(OPENID, room)
}
