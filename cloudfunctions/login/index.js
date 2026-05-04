const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command
const users = db.collection('users')
const pets = db.collection('pets')
const userSettings = db.collection('user_settings')
const TOWN_ONLINE_TTL_MS = 90 * 1000
const TOWN_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000
const TOWN_MAX_ROOM_MEMBERS = 2

const now = () => db.serverDate()
const townNowIso = () => new Date().toISOString()

const defaultUser = (openid, profile = {}) => ({
  _openid: openid,
  nickName: profile.nickName || 'Koko Friend',
  avatarUrl: profile.avatarUrl || '',
  createdAt: now(),
  updatedAt: now(),
  lastLoginAt: now(),
  onboardingDone: false,
})

const defaultPet = (openid, profile = {}) => ({
  _openid: openid,
  name: profile.petName || 'Koko',
  stage: 'growing',
  mood: 82,
  health: 88,
  hunger: 64,
  energy: 76,
  intimacy: 55,
  cleanliness: 90,
  createdAt: now(),
  updatedAt: now(),
})

const defaultSettings = (openid) => ({
  _openid: openid,
  language: 'en',
  lowDisturbanceMode: false,
  reminderIntensity: 'gentle',
  createdAt: now(),
  updatedAt: now(),
})

const getByOpenidList = async (collection, openid) => {
  const result = await collection.where({ _openid: openid }).limit(100).get()
  return result.data || []
}

const keepSingleByOpenid = async (collection, openid) => {
  const records = await getByOpenidList(collection, openid)

  if (!records.length) {
    return undefined
  }

  const [primary, ...duplicates] = records

  if (duplicates.length) {
    await Promise.all(
      duplicates
        .filter((item) => Boolean(item && item._id))
        .map((item) => collection.doc(item._id).remove()),
    )
  }

  return primary
}

const createIfMissing = async (collection, dataFactory, openid) => {
  const existing = await keepSingleByOpenid(collection, openid)

  if (existing) {
    return existing
  }

  const data = dataFactory(openid)
  const created = await collection.add({ data })
  return {
    _id: created._id,
    ...data,
  }
}

const pickProfile = (profile = {}) => ({
  nickName: typeof profile.nickName === 'string' && profile.nickName.trim() ? profile.nickName.trim() : undefined,
  avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : undefined,
  petName: typeof profile.petName === 'string' && profile.petName.trim() ? profile.petName.trim() : undefined,
  onboardingDone: typeof profile.onboardingDone === 'boolean' ? profile.onboardingDone : undefined,
})

const townNormalizeText = (value, maxLength = 80) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

const townClampNumber = (value, min, max, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, Math.round(numeric * 100) / 100))
}

const townCreateInviteCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

const townNormalizeMembers = (members, ownerOpenid) => {
  const values = Array.isArray(members) ? members : []
  return Array.from(new Set([ownerOpenid].concat(values).map((item) => townNormalizeText(item, 80)).filter(Boolean))).slice(0, TOWN_MAX_ROOM_MEMBERS)
}

const townFindUserByOpenid = async (openid) => {
  const result = await users.where({ _openid: openid }).limit(1).get()
  return (result.data && result.data[0]) || null
}

const townUpdateUserByOpenid = async (openid, data) => {
  const target = await townFindUserByOpenid(openid)
  if (!target || !target._id) {
    throw new Error('Town community user profile was not found.')
  }

  await users.doc(target._id).update({ data })
  return {
    ...target,
    ...data,
  }
}

const townPublicRoom = (ownerDoc, memberOpenids) => ({
  id: `town-${(ownerDoc && ownerDoc._openid) || ''}`,
  ownerOpenid: (ownerDoc && ownerDoc._openid) || '',
  inviteCode: (ownerDoc && ownerDoc.townInviteCode) || '',
  inviteExpiresAt: (ownerDoc && ownerDoc.townInviteExpiresAt) || '',
  memberCount: memberOpenids.length,
  updatedAt: (ownerDoc && (ownerDoc.townUpdatedAt || ownerDoc.updatedAt)) || '',
})

const townEnsureOwnerRoom = async (openid) => {
  const owner = await townFindUserByOpenid(openid)
  const memberOpenids = townNormalizeMembers(owner && owner.townMemberOpenids, openid)
  const data = {
    townRoomOwnerOpenid: openid,
    townMemberOpenids: memberOpenids,
    townUpdatedAt: townNowIso(),
  }

  if (owner && owner.townRoomOwnerOpenid === openid && Array.isArray(owner.townMemberOpenids)) {
    return {
      ...owner,
      ...data,
    }
  }

  return townUpdateUserByOpenid(openid, data)
}

const townEnsureInvite = async (ownerDoc) => {
  const currentExpiresAt = new Date(ownerDoc.townInviteExpiresAt || 0).getTime() || 0
  if (ownerDoc.townInviteCode && currentExpiresAt > Date.now()) {
    return ownerDoc
  }

  return townUpdateUserByOpenid(ownerDoc._openid, {
    townInviteCode: townCreateInviteCode(),
    townInviteExpiresAt: new Date(Date.now() + TOWN_INVITE_TTL_MS).toISOString(),
    townUpdatedAt: townNowIso(),
  })
}

const townSavePresence = async (openid, event, ownerOpenid) => {
  const timestamp = townNowIso()
  return townUpdateUserByOpenid(openid, {
    townRoomOwnerOpenid: ownerOpenid,
    townPresence: {
      nickName: townNormalizeText(event.nickName, 40),
      avatarUrl: townNormalizeText(event.avatarUrl, 300),
      petName: townNormalizeText(event.petName, 24) || 'Koko',
      x: townClampNumber(event.x, 8, 92, 52),
      y: townClampNumber(event.y, 24, 92, 76),
      action: townNormalizeText(event.action, 20) || 'idle',
      online: event.online !== false,
      lastSeenAt: timestamp,
      updatedAt: timestamp,
    },
    townUpdatedAt: timestamp,
  })
}

const townLoadUsersByOpenids = async (openids) => {
  if (!openids.length) return {}
  const result = await users.where({ _openid: _.in(openids) }).limit(100).get()
  return Object.fromEntries((result.data || []).map((item) => [item._openid, item]))
}

const townLoadState = async (openid, ownerDoc) => {
  const memberOpenids = townNormalizeMembers(ownerDoc.townMemberOpenids, ownerDoc._openid)
  const userMap = await townLoadUsersByOpenids(memberOpenids)
  const timestampMs = Date.now()
  const partners = memberOpenids.map((memberOpenid, index) => {
    const member = userMap[memberOpenid] || {}
    const currentPresence = member.townPresence || {}
    const lastSeenAt = townNormalizeText(currentPresence.lastSeenAt, 40)
    const lastSeenMs = new Date(lastSeenAt || 0).getTime() || 0
    const online = Boolean(lastSeenMs && timestampMs - lastSeenMs <= TOWN_ONLINE_TTL_MS && currentPresence.online !== false)

    return {
      openid: memberOpenid,
      nickName: townNormalizeText(currentPresence.nickName, 40) || townNormalizeText(member.nickName, 40) || `Koko Friend ${index + 1}`,
      avatarUrl: townNormalizeText(currentPresence.avatarUrl, 300) || townNormalizeText(member.avatarUrl, 300),
      petName: townNormalizeText(currentPresence.petName, 24) || 'Koko',
      x: townClampNumber(currentPresence.x, 8, 92, 18 + index * 10),
      y: townClampNumber(currentPresence.y, 24, 92, 72),
      action: townNormalizeText(currentPresence.action, 20) || 'idle',
      online,
      isSelf: memberOpenid === openid,
      lastSeenAt,
    }
  })

  return {
    room: townPublicRoom(ownerDoc, memberOpenids),
    partners,
    invitePath: ownerDoc.townInviteCode ? `/pages/town/index?invite=${ownerDoc.townInviteCode}` : '',
    inviteCode: ownerDoc.townInviteCode || '',
    qrCodeFileID: ownerDoc.townQrCodeFileID || '',
  }
}

const townJoinInvite = async (openid, inviteCode, event) => {
  const code = townNormalizeText(inviteCode, 32).toUpperCase()
  if (!code) throw new Error('Missing invite code.')

  const result = await users.where({ townInviteCode: code }).limit(1).get()
  const ownerDoc = (result.data && result.data[0]) || null
  if (!ownerDoc || !ownerDoc._id) throw new Error('Invite was not found.')
  if (ownerDoc.townInviteExpiresAt && new Date(ownerDoc.townInviteExpiresAt).getTime() < Date.now()) {
    throw new Error('Invite has expired.')
  }

  const memberOpenids = townNormalizeMembers([].concat(ownerDoc.townMemberOpenids || [], openid), ownerDoc._openid)
  const updatedOwner = await townUpdateUserByOpenid(ownerDoc._openid, {
    townMemberOpenids: memberOpenids,
    townUpdatedAt: townNowIso(),
  })
  await townSavePresence(openid, event, ownerDoc._openid)
  return updatedOwner
}

const handleTownCommunity = async (openid, event = {}) => {
  const action = ['load', 'heartbeat', 'createInvite', 'joinInvite', 'offline'].includes(event.action)
    ? event.action
    : 'load'

  if (action === 'joinInvite') {
    const ownerDoc = await townJoinInvite(openid, event.inviteCode || event.invite, event)
    return townLoadState(openid, ownerDoc)
  }

  if (action === 'createInvite') {
    const ownerDoc = await townEnsureInvite(await townEnsureOwnerRoom(openid))
    await townSavePresence(openid, event, openid)
    return townLoadState(openid, ownerDoc)
  }

  const currentUser = await townFindUserByOpenid(openid)
  const ownerOpenid = townNormalizeText(currentUser && currentUser.townRoomOwnerOpenid, 80) || openid
  const ownerDoc = ownerOpenid === openid ? await townEnsureOwnerRoom(openid) : await townFindUserByOpenid(ownerOpenid)
  if (!ownerDoc) throw new Error('Town room owner was not found.')

  if (action === 'heartbeat') {
    await townSavePresence(openid, event, ownerDoc._openid)
  } else if (action === 'offline') {
    await townSavePresence(openid, { ...event, online: false }, ownerDoc._openid)
  }

  return townLoadState(openid, ownerDoc)
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    throw new Error('Unable to identify the current WeChat user. Please confirm CloudBase is enabled correctly.')
  }

  const profile = pickProfile(event.profile)
  let user = await keepSingleByOpenid(users, OPENID)
  const isNewUser = !user

  if (!user) {
    const data = defaultUser(OPENID, profile)
    const created = await users.add({ data })
    user = {
      _id: created._id,
      ...data,
    }
  } else {
    const shouldSyncProfile = event.action === 'syncUserProfile'
    const data = {
      updatedAt: now(),
      lastLoginAt: now(),
    }

    if (shouldSyncProfile) {
      if (profile.nickName) {
        data.nickName = profile.nickName
      }

      if (profile.avatarUrl !== undefined) {
        data.avatarUrl = profile.avatarUrl
      }
    }

    if (typeof event.onboardingDone === 'boolean' || typeof profile.onboardingDone === 'boolean') {
      data.onboardingDone = typeof event.onboardingDone === 'boolean' ? event.onboardingDone : profile.onboardingDone
    }

    await users.doc(user._id).update({ data })
    user = {
      ...user,
      ...data,
    }
  }

  let pet = await createIfMissing(pets, (openid) => defaultPet(openid, profile), OPENID)
  if (profile.petName && pet.name !== profile.petName) {
    const data = {
      name: profile.petName,
      updatedAt: now(),
    }
    await pets.doc(pet._id).update({ data })
    pet = {
      ...pet,
      ...data,
    }
  }
  await createIfMissing(userSettings, defaultSettings, OPENID)

  if (event.action === 'townCommunity') {
    return handleTownCommunity(OPENID, event.townCommunity || {})
  }

  return {
    openid: OPENID,
    user,
    pet,
    isNewUser,
  }
}
