<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PetLottieAvatar from '../components/PetLottieAvatar.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { PetActionType } from '../types/koko'

interface BuildingHotspot {
  id: string
  name: string
  description: string
  x: number
  y: number
  width: number
  height: number
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

const { pet, economy, shopItems, todayTasks, completedTasks, settings, purchaseShopItem, syncEconomyFromCloud } = useKokoState()
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

let moveTimer: ReturnType<typeof setTimeout> | undefined
let roamTimer: ReturnType<typeof setInterval> | undefined

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

const petStyle = computed(() => ({
  left: `${petPosition.value.x}%`,
  top: `${petPosition.value.y}%`,
  transitionDuration: `${petMoveDurationMs.value}ms`,
}))

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
}

const roamSomewhere = () => {
  if (!walkingEnabled.value || activeBuilding.value) return
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
  const { x, y } = getTouchPoint(event)
  const windowInfo = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : undefined
  const width = windowInfo?.windowWidth ?? 1
  const height = windowInfo?.windowHeight ?? 1
  movePetTo((x / width) * 100, (y / height) * 100)
}

const openBuildingPopup = (spot: BuildingHotspot) => {
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
  uni.switchTab({ url: '/pages/home/index' })
}

watch(
  () => activeBuilding.value,
  (value) => {
    if (value) {
      walkingEnabled.value = false
      petAction.value = 'idle'
      return
    }
    walkingEnabled.value = true
  },
)

onMounted(() => {
  void ensureTownMap()
  void syncEconomyFromCloud()
  petMirror.value = false
  roamTimer = setInterval(() => {
    roamSomewhere()
  }, 5200)
  queueIdle(1600)
})

onBeforeUnmount(() => {
  stopMoveTimer()
  if (roamTimer) clearInterval(roamTimer)
  roamTimer = undefined
})
</script>

<template>
  <view class="town-page">
    <view class="town-map-wrap" @click="movePetFromMapTap">
      <view class="town-map">
        <image class="town-map__image" :src="townMapSrc" mode="scaleToFill" @error="handleTownMapError" />

        <view class="town-pet" :class="`town-pet--${petAction}`" :style="petStyle" @click.stop>
          <view class="town-pet__name">{{ pet.name }}</view>
          <PetLottieAvatar :size-rpx="PET_SIZE_RPX" :mirror="petMirror" />
          <view class="town-pet__shadow" />
        </view>

        <view
          v-for="spot in hotspots"
          :key="spot.id"
          class="town-hotspot"
          :style="hotspotStyle(spot)"
          @click.stop="openBuildingPopup(spot)"
        >
          <view class="town-hotspot__label">{{ spot.name }}</view>
        </view>
      </view>
    </view>

    <view v-if="activeBuilding" class="town-popup-mask" @click="closeBuildingPopup">
      <view class="town-popup" @click.stop>
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
          <button class="town-popup__button" @click="goHome">{{ shopText.openHomeChat }}</button>
        </view>

        <button v-else class="town-popup__button" @click="closeBuildingPopup">{{ t.town.ok }}</button>
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

.town-popup {
  background: #fffdf8;
  border: 2rpx solid rgba(176, 143, 102, 0.18);
  border-radius: 30rpx;
  box-shadow: 0 24rpx 48rpx rgba(47, 67, 58, 0.22);
  max-width: 600rpx;
  padding: 32rpx 30rpx 28rpx;
  width: 100%;
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
