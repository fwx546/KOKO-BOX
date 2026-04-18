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

const defaultPet = (openid) => ({
  _openid: openid,
  name: 'Koko',
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
  language: 'zh',
  lowDisturbanceMode: false,
  reminderIntensity: 'gentle',
  createdAt: now(),
  updatedAt: now(),
})

const getFirstByOpenid = async (collection, openid) => {
  const result = await collection.where({ _openid: openid }).limit(1).get()
  return result.data[0]
}

const createIfMissing = async (collection, dataFactory, openid) => {
  const existing = await getFirstByOpenid(collection, openid)

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
})

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    throw new Error('无法获取微信用户身份，请确认云开发环境已正确开启')
  }

  const profile = pickProfile(event.profile)
  let user = await getFirstByOpenid(users, OPENID)
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

    await users.doc(user._id).update({ data })
    user = {
      ...user,
      ...data,
    }
  }

  const pet = await createIfMissing(pets, defaultPet, OPENID)
  await createIfMissing(userSettings, defaultSettings, OPENID)

  return {
    openid: OPENID,
    user,
    pet,
    isNewUser,
  }
}
