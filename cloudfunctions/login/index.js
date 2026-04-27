const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const users = db.collection('users')
const pets = db.collection('pets')
const userSettings = db.collection('user_settings')

const now = () => db.serverDate()

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

  return {
    openid: OPENID,
    user,
    pet,
    isNewUser,
  }
}
