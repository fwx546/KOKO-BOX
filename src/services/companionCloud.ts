import { isWechatCloudConfigured } from '../config/cloud'
import type {
  CompanionEconomy,
  EconomyRewardLedgerEntry,
  Pet,
  ShopPurchaseRecord,
} from '../types/koko'

interface WechatCloudApi {
  callFunction?: (options: unknown) => Promise<{ result: unknown }>
}

export interface CompanionCloudSnapshot {
  pet?: Partial<Pet>
  economy: CompanionEconomy
  updatedAt: string
  exists?: boolean
}

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

const clampNumber = (value: unknown, min: number, max: number, fallback = 0) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, Math.round(numeric)))
}

const normalizeText = (value: unknown, maxLength: number) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

const normalizeInventory = (value: unknown): Record<string, number> => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, count]) => [normalizeText(key, 60), clampNumber(count, 0, 999, 0)] as const)
      .filter(([key, count]) => Boolean(key) && count > 0)
      .slice(0, 80),
  )
}

const normalizeRewardLedger = (value: unknown): CompanionEconomy['rewardLedger'] => {
  const source = value && typeof value === 'object' ? value as Record<string, Partial<EconomyRewardLedgerEntry>> : {}
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, entry]) => {
        const normalizedKey = normalizeText(entry?.key || key, 120)
        if (!normalizedKey) return null
        return [
          normalizedKey,
          {
            key: normalizedKey,
            source: ['task', 'chat', 'mini-game', 'system'].includes(entry?.source || '') ? entry?.source : 'system',
            amount: clampNumber(entry?.amount, 0, 1000, 0),
            createdAt: normalizeText(entry?.createdAt, 40) || new Date().toISOString(),
          },
        ] as const
      })
      .filter((item): item is readonly [string, EconomyRewardLedgerEntry] => Boolean(item))
      .slice(-500),
  )
}

const normalizeDailyChatRewards = (value: unknown): Record<string, number> => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, amount]) => [normalizeText(key, 20), clampNumber(amount, 0, 20, 0)] as const)
      .filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .slice(-45),
  )
}

const normalizePurchaseHistory = (value: unknown): ShopPurchaseRecord[] =>
  (Array.isArray(value) ? value : [])
    .map((item, index) => {
      const record = (item ?? {}) as Partial<ShopPurchaseRecord>
      const itemId = normalizeText(record.itemId, 60)
      if (!itemId) return null
      return {
        id: normalizeText(record.id, 80) || `purchase-${index + 1}`,
        itemId: itemId as ShopPurchaseRecord['itemId'],
        price: clampNumber(record.price, 0, 1000, 0),
        createdAt: normalizeText(record.createdAt, 40) || new Date().toISOString(),
      }
    })
    .filter((item): item is ShopPurchaseRecord => Boolean(item))
    .slice(-100)

export const normalizeCompanionEconomy = (value: unknown, fallbackCoins = 0): CompanionEconomy => {
  const source = (value ?? {}) as Partial<CompanionEconomy>
  return {
    coins: clampNumber(source.coins, 0, 999999, fallbackCoins),
    inventory: normalizeInventory(source.inventory),
    purchaseHistory: normalizePurchaseHistory(source.purchaseHistory),
    rewardLedger: normalizeRewardLedger(source.rewardLedger),
    dailyChatRewards: normalizeDailyChatRewards(source.dailyChatRewards),
    starterResourcesGranted: Boolean(source.starterResourcesGranted),
    updatedAt: normalizeText(source.updatedAt, 40) || new Date().toISOString(),
  }
}

const normalizeSnapshot = (value: unknown, fallbackCoins = 0): CompanionCloudSnapshot => {
  const source = (value ?? {}) as { exists?: unknown; pet?: Partial<Pet>; economy?: unknown; updatedAt?: unknown }
  const economy = normalizeCompanionEconomy(source.economy, fallbackCoins)
  return {
    exists: Boolean(source.exists),
    pet: source.pet && typeof source.pet === 'object' ? source.pet : undefined,
    economy,
    updatedAt: normalizeText(source.updatedAt, 40) || economy.updatedAt,
  }
}

export const loadCompanionFromCloud = async (fallbackCoins = 0) => {
  if (!isWechatCloudConfigured()) {
    return null
  }

  const result = await callWechatCloudFunction<unknown>('companion-sync', {
    action: 'load',
  })

  return normalizeSnapshot(result, fallbackCoins)
}

export const saveCompanionToCloud = async (payload: { pet: Pet; economy: CompanionEconomy; updatedAt: string }) => {
  if (!isWechatCloudConfigured()) {
    return null
  }

  const normalized = normalizeSnapshot(payload, payload.economy.coins)
  const result = await callWechatCloudFunction<unknown>(
    'companion-sync',
    {
      action: 'save',
      pet: payload.pet,
      economy: normalized.economy,
      updatedAt: payload.updatedAt || normalized.updatedAt,
    },
    30000,
  )

  return normalizeSnapshot(result, payload.economy.coins)
}
