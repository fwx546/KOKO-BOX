const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command

const users = db.collection('users')
const pets = db.collection('pets')

const ONLINE_TTL_MS = 90 * 1000
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000
const MAX_ROOM_MEMBERS = 2
const TOWN_ACTIONS = ['load', 'heartbeat', 'createInvite', 'joinInvite', 'offline']

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

const normalizeMembers = (members, ownerOpenid) => {
  const values = Array.isArray(members) ? members : []
  return Array.from(new Set([ownerOpenid, ...values].map((item) => normalizeText(item, 80)).filter(Boolean))).slice(0, MAX_ROOM_MEMBERS)
}

const createJoinMembers = (ownerOpenid, joiningOpenid) =>
  normalizeMembers(joiningOpenid === ownerOpenid ? [] : [joiningOpenid], ownerOpenid)

const normalizePresenceAction = (event) => {
  const currentAction = normalizeText(event.petAction, 20)
  if (currentAction) return currentAction

  const legacyAction = normalizeText(event.action, 20)
  return legacyAction && !TOWN_ACTIONS.includes(legacyAction) ? legacyAction : 'idle'
}

const publicRoom = (ownerDoc, memberOpenids) => ({
  id: `town-${(ownerDoc && ownerDoc._openid) || ''}`,
  ownerOpenid: (ownerDoc && ownerDoc._openid) || '',
  inviteCode: (ownerDoc && ownerDoc.townInviteCode) || '',
  inviteExpiresAt: (ownerDoc && ownerDoc.townInviteExpiresAt) || '',
  memberCount: memberOpenids.length,
  updatedAt: (ownerDoc && (ownerDoc.townUpdatedAt || ownerDoc.updatedAt)) || '',
})

const findUserByOpenid = async (openid) => {
  const result = await users.where({ _openid: openid }).limit(1).get()
  return (result.data && result.data[0]) || null
}

const ensureUser = async (openid, event = {}) => {
  const existing = await findUserByOpenid(openid)
  if (existing) return existing

  const timestamp = nowIso()
  const payload = {
    _openid: openid,
    nickName: normalizeText(event.nickName, 40) || 'Koko Friend',
    avatarUrl: normalizeText(event.avatarUrl, 300),
    onboardingDone: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const created = await users.add({ data: payload })
  return {
    _id: created._id,
    ...payload,
  }
}

const updateUserByOpenid = async (openid, data, event = {}) => {
  const user = await ensureUser(openid, event)
  await users.doc(user._id).update({ data })
  return {
    ...user,
    ...data,
  }
}

const loadUsersByOpenids = async (openids) => {
  if (!openids.length) return {}

  const result = await users.where({ _openid: _.in(openids) }).limit(100).get()
  return Object.fromEntries((result.data || []).map((item) => [item._openid, item]))
}

const loadPetMap = async (openids) => {
  if (!openids.length) return {}

  try {
    const result = await pets.where({ _openid: _.in(openids) }).limit(100).get()
    return Object.fromEntries((result.data || []).map((item) => [item._openid, item]))
  } catch (error) {
    console.warn('[town-community] pet profile lookup failed:', (error && error.message) || error)
    return {}
  }
}

const ensureOwnerRoom = async (openid, event = {}) => {
  const user = await ensureUser(openid, event)
  const memberOpenids = normalizeMembers(user.townMemberOpenids, openid)
  const data = {
    townRoomOwnerOpenid: openid,
    townMemberOpenids: memberOpenids,
    townUpdatedAt: nowIso(),
  }

  if (user.townRoomOwnerOpenid === openid && Array.isArray(user.townMemberOpenids)) {
    return {
      ...user,
      ...data,
    }
  }

  return updateUserByOpenid(openid, data, event)
}

const ensureInvite = async (ownerDoc) => {
  const currentExpiresAt = new Date(ownerDoc.townInviteExpiresAt || 0).getTime() || 0
  if (ownerDoc.townInviteCode && currentExpiresAt > Date.now()) {
    if (!ownerDoc.townQrCodeFileID) {
      const qrCodeFileID = await createQrCode(ownerDoc.townInviteCode)
      if (qrCodeFileID) {
        return updateUserByOpenid(ownerDoc._openid, {
          townQrCodeFileID: qrCodeFileID,
          townUpdatedAt: nowIso(),
        })
      }
    }

    return ownerDoc
  }

  const inviteCode = createInviteCode()
  const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()
  const qrCodeFileID = await createQrCode(inviteCode)
  return updateUserByOpenid(ownerDoc._openid, {
    townInviteCode: inviteCode,
    townInviteExpiresAt: inviteExpiresAt,
    townQrCodeFileID: qrCodeFileID || '',
    townUpdatedAt: nowIso(),
  })
}

const createQrCode = async (inviteCode) => {
  if (!cloud.openapi || !cloud.openapi.wxacode || !cloud.openapi.wxacode.getUnlimited) return null

  try {
    const wxacode = await cloud.openapi.wxacode.getUnlimited({
      scene: `invite=${inviteCode}`,
      page: 'pages/town/index',
      checkPath: false,
      width: 430,
    })
    const buffer = wxacode && wxacode.buffer
    if (!buffer) return null

    const uploaded = await cloud.uploadFile({
      cloudPath: `town-invites/${inviteCode}-${Date.now()}.jpg`,
      fileContent: buffer,
    })

    return normalizeText(uploaded && uploaded.fileID, 300)
  } catch (error) {
    console.warn('[town-community] QR generation failed:', (error && error.message) || error)
    return null
  }
}

const resolveOwnerForUser = async (openid, event = {}) => {
  const user = await ensureUser(openid, event)
  const ownerOpenid = normalizeText(user.townRoomOwnerOpenid, 80) || openid
  const ownerDoc = ownerOpenid === openid ? await ensureOwnerRoom(openid, event) : await ensureUser(ownerOpenid, event)
  const memberOpenids = normalizeMembers(ownerDoc.townMemberOpenids, ownerDoc._openid)
  return {
    user,
    ownerDoc,
    memberOpenids,
  }
}

const savePresence = async (openid, event, ownerOpenid) => {
  const timestamp = nowIso()
  const townPresence = {
    nickName: normalizeText(event.nickName, 40),
    avatarUrl: normalizeText(event.avatarUrl, 300),
    petName: normalizeText(event.petName, 24) || 'Koko',
    x: clampNumber(event.x, 8, 92, 52),
    y: clampNumber(event.y, 24, 92, 76),
    action: normalizePresenceAction(event),
    online: event.online !== false,
    lastSeenAt: timestamp,
    updatedAt: timestamp,
  }

  return updateUserByOpenid(openid, {
    townRoomOwnerOpenid: ownerOpenid,
    townPresence,
    townUpdatedAt: timestamp,
  }, event)
}

const loadState = async (openid, ownerDoc) => {
  const memberOpenids = normalizeMembers(ownerDoc.townMemberOpenids, ownerDoc._openid)
  const [userMap, petMap] = await Promise.all([
    loadUsersByOpenids(memberOpenids),
    loadPetMap(memberOpenids),
  ])
  const timestampMs = Date.now()

  const partners = memberOpenids.map((memberOpenid, index) => {
    const user = userMap[memberOpenid] || {}
    const pet = petMap[memberOpenid] || {}
    const currentPresence = user.townPresence || {}
    const lastSeenAt = normalizeText(currentPresence.lastSeenAt, 40)
    const lastSeenMs = new Date(lastSeenAt || 0).getTime() || 0
    const online = Boolean(lastSeenMs && timestampMs - lastSeenMs <= ONLINE_TTL_MS && currentPresence.online !== false)

    return {
      openid: memberOpenid,
      nickName: normalizeText(currentPresence.nickName, 40) || normalizeText(user.nickName, 40) || `Koko Friend ${index + 1}`,
      avatarUrl: normalizeText(currentPresence.avatarUrl, 300) || normalizeText(user.avatarUrl, 300),
      petName: normalizeText(currentPresence.petName, 24) || normalizeText(pet.name, 24) || 'Koko',
      x: clampNumber(currentPresence.x, 8, 92, 18 + index * 10),
      y: clampNumber(currentPresence.y, 24, 92, 72),
      action: normalizeText(currentPresence.action, 20) || 'idle',
      online,
      isSelf: memberOpenid === openid,
      lastSeenAt,
    }
  })

  return {
    room: publicRoom(ownerDoc, memberOpenids),
    partners,
    invitePath: ownerDoc.townInviteCode ? `/pages/town/index?invite=${ownerDoc.townInviteCode}` : '',
    inviteCode: ownerDoc.townInviteCode || '',
    qrCodeFileID: ownerDoc.townQrCodeFileID || '',
  }
}

const joinInvite = async (openid, inviteCode, event) => {
  const code = normalizeText(inviteCode, 32).toUpperCase()
  if (!code) {
    throw new Error('Missing invite code.')
  }

  const result = await users.where({ townInviteCode: code }).limit(1).get()
  const ownerDoc = (result.data && result.data[0]) || null

  if (!ownerDoc || !ownerDoc._id) {
    throw new Error('Invite was not found.')
  }

  if (ownerDoc.townInviteExpiresAt && new Date(ownerDoc.townInviteExpiresAt).getTime() < Date.now()) {
    throw new Error('Invite has expired.')
  }

  const memberOpenids = createJoinMembers(ownerDoc._openid, openid)
  const updatedOwner = await updateUserByOpenid(ownerDoc._openid, {
    townMemberOpenids: memberOpenids,
    townUpdatedAt: nowIso(),
  })
  await savePresence(openid, event, ownerDoc._openid)

  return updatedOwner
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    throw new Error('Unable to identify the current WeChat user.')
  }

  const action = TOWN_ACTIONS.includes(event.action)
    ? event.action
    : 'load'

  if (action === 'joinInvite') {
    const ownerDoc = await joinInvite(OPENID, event.inviteCode || event.invite, event)
    return loadState(OPENID, ownerDoc)
  }

  if (action === 'createInvite') {
    const ownerDoc = await ensureInvite(await ensureOwnerRoom(OPENID, event))
    await savePresence(OPENID, event, OPENID)
    return loadState(OPENID, ownerDoc)
  }

  const { ownerDoc } = await resolveOwnerForUser(OPENID, event)

  if (action === 'heartbeat') {
    await savePresence(OPENID, event, ownerDoc._openid)
    return loadState(OPENID, ownerDoc)
  }

  if (action === 'offline') {
    await savePresence(
      OPENID,
      {
        ...event,
        online: false,
      },
      ownerDoc._openid,
    )
    return loadState(OPENID, ownerDoc)
  }

  return loadState(OPENID, ownerDoc)
}
