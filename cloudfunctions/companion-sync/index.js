const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

const db = cloud.database()
const _ = db.command
const companionRecords = db.collection('user_companion_state')
const now = () => new Date().toISOString()

const rewardSources = ['task', 'chat', 'mini-game', 'system']
const shopItemIds = ['meal', 'water', 'clean-kit']

const clampNumber = (value, min, max, fallback = 0) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, Math.round(numeric)))
}

const normalizeText = (value, maxLength) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

const sanitizePet = (value = {}) => ({
  id: normalizeText(value.id, 80) || 'pet-koko',
  name: normalizeText(value.name, 40) || 'Koko',
  species: normalizeText(value.species, 20) || 'cat',
  stage: normalizeText(value.stage, 20) || 'growing',
  state: normalizeText(value.state, 20) || 'normal',
  health: clampNumber(value.health, 0, 100, 84),
  mood: clampNumber(value.mood, 0, 100, 78),
  hunger: clampNumber(value.hunger, 0, 100, 72),
  energy: clampNumber(value.energy, 0, 100, 69),
  intimacy: clampNumber(value.intimacy, 0, 100, 58),
  clean: clampNumber(value.clean, 0, 100, 85),
  lastFedAt: normalizeText(value.lastFedAt, 40) || undefined,
  digestingUntil: normalizeText(value.digestingUntil, 40) || undefined,
  activeMiniGame: normalizeText(value.activeMiniGame, 20) || null,
  homeSceneMood: normalizeText(value.homeSceneMood, 40) || 'meadow',
  rotationFrame: clampNumber(value.rotationFrame, 0, 15, 0),
  facingDirection: normalizeText(value.facingDirection, 30) || 'front',
  updatedAt: normalizeText(value.updatedAt, 40) || now(),
})

const sanitizeInventory = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, count]) => [normalizeText(key, 60), clampNumber(count, 0, 999, 0)])
      .filter(([key, count]) => Boolean(key) && count > 0)
      .slice(0, 80),
  )
}

const sanitizeRewardLedger = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, entry = {}]) => {
        const normalizedKey = normalizeText(entry.key || key, 120)
        if (!normalizedKey) return null
        return [
          normalizedKey,
          {
            key: normalizedKey,
            source: rewardSources.includes(entry.source) ? entry.source : 'system',
            amount: clampNumber(entry.amount, 0, 1000, 0),
            createdAt: normalizeText(entry.createdAt, 40) || now(),
          },
        ]
      })
      .filter(Boolean)
      .slice(-500),
  )
}

const sanitizeDailyChatRewards = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, amount]) => [normalizeText(key, 20), clampNumber(amount, 0, 20, 0)])
      .filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .slice(-45),
  )
}

const sanitizePurchaseHistory = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item = {}, index) => {
      const itemId = normalizeText(item.itemId, 60)
      if (!shopItemIds.includes(itemId)) return null
      return {
        id: normalizeText(item.id, 80) || `purchase-${index + 1}`,
        itemId,
        price: clampNumber(item.price, 0, 1000, 0),
        createdAt: normalizeText(item.createdAt, 40) || now(),
      }
    })
    .filter(Boolean)
    .slice(-100)

const sanitizeCoinLogs = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item = {}, index) => {
      const amount = clampNumber(item.amount, -999999, 999999, 0)
      if (!amount) return null
      const type = item.type === 'consume' || amount < 0 ? 'consume' : 'gain'
      const signedAmount = type === 'consume' ? -Math.abs(amount) : Math.abs(amount)
      return {
        id: normalizeText(item.id, 80) || `coin-log-${index + 1}`,
        type,
        amount: signedAmount,
        reason: normalizeText(item.reason, 80) || (type === 'gain' ? 'Reward' : 'Consume'),
        created_at: normalizeText(item.created_at, 40) || now(),
      }
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())

const sanitizeEconomy = (value = {}) => ({
  coins: clampNumber(value.coins, 0, 999999, 0),
  inventory: sanitizeInventory(value.inventory),
  purchaseHistory: sanitizePurchaseHistory(value.purchaseHistory),
  rewardLedger: sanitizeRewardLedger(value.rewardLedger),
  coinLogs: sanitizeCoinLogs(value.coinLogs),
  dailyChatRewards: sanitizeDailyChatRewards(value.dailyChatRewards),
  starterResourcesGranted: Boolean(value.starterResourcesGranted),
  updatedAt: normalizeText(value.updatedAt, 40) || now(),
})

const keepSingleByOpenid = async (openid) => {
  const result = await companionRecords
    .where(
      _.or([
        { _openid: openid },
        { ownerOpenid: openid },
      ]),
    )
    .limit(100)
    .get()
  const records = result.data || []

  if (!records.length) {
    return null
  }

  const [primary, ...duplicates] = records
  if (duplicates.length) {
    await Promise.all(
      duplicates
        .filter((item) => item && item._id)
        .map((item) => companionRecords.doc(item._id).remove()),
    )
  }

  return primary
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    throw new Error('Unable to identify the current WeChat user.')
  }

  const action = ['load', 'save', 'clear'].includes(event.action) ? event.action : 'load'
  const existing = await keepSingleByOpenid(OPENID)

  if (action === 'load') {
    return {
      exists: Boolean(existing),
      pet: existing?.pet ? sanitizePet(existing.pet) : undefined,
      economy: sanitizeEconomy(existing?.economy),
      updatedAt: normalizeText(existing?.updatedAt, 40),
    }
  }

  const updatedAt = normalizeText(event.updatedAt, 40) || now()

  if (action === 'clear') {
    const payload = {
      economy: sanitizeEconomy(),
      updatedAt,
    }

    if (existing?._id) {
      await companionRecords.doc(existing._id).update({
        data: payload,
      })
    }

    return payload
  }

  const payload = {
    _openid: OPENID,
    ownerOpenid: OPENID,
    pet: sanitizePet(event.pet),
    economy: {
      ...sanitizeEconomy(event.economy),
      updatedAt,
    },
    updatedAt,
  }

  if (!existing) {
    await companionRecords.add({
      data: {
        ...payload,
        createdAt: now(),
      },
    })
  } else {
    await companionRecords.doc(existing._id).update({
      data: payload,
    })
  }

  return payload
}
