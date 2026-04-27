<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PetLottieAvatar from '../components/PetLottieAvatar.vue'
import { useKokoState } from '../composables/useKokoState'
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

const { pet } = useKokoState()

// Coordinates are based on the original map.webp pixel grid (941x1672).
// Fine-tune these values after previewing in WeChat DevTools.
const hotspots: BuildingHotspot[] = [
  {
    id: 'home',
    name: '家',
    description: '这是你和团子的温馨小屋，可以在这里休息和互动。',
    x: 200,
    y: 560,
    width: 180,
    height: 170,
  },
  {
    id: 'playground',
    name: '宠物乐园',
    description: '团子最喜欢的活动区，可以玩小游戏和互动设施。',
    x: 630,
    y: 560,
    width: 180,
    height: 170,
  },
  {
    id: 'shop',
    name: '商店',
    description: '可以买零食和装饰道具，给团子更好的生活体验。',
    x: 120,
    y: 900,
    width: 220,
    height: 210,
  },
  {
    id: 'task-board',
    name: '任务公告栏',
    description: '这里会发布每日任务和小镇活动通知。',
    x: 650,
    y: 940,
    width: 190,
    height: 180,
  },
  {
    id: 'talk-house',
    name: '倾诉小屋',
    description: '想放松时可以来这里和团子聊聊天，记录心情。',
    x: 360,
    y: 1180,
    width: 190,
    height: 190,
  },
]

const activeBuilding = ref<BuildingHotspot | null>(null)
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
}

const closeBuildingPopup = () => {
  activeBuilding.value = null
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
        <button class="town-popup__button" @click="closeBuildingPopup">知道啦</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.town-page {
  bottom: 0;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
}

.town-map-wrap {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.town-map {
  position: relative;
  line-height: 0;
  width: 100%;
  height: 100%;
}

.town-map__image {
  width: 100%;
  height: 100%;
  display: block;
}

.town-hotspot {
  position: absolute;
  box-sizing: border-box;
  z-index: 4;
}

.town-hotspot__label {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 8rpx 24rpx;
  border-radius: 999rpx;
  border: 2rpx solid #111111;
  background: rgba(128, 128, 128, 0.28);
  color: #111111;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}

.town-popup-mask {
  bottom: 0;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: rgba(15, 23, 42, 0.52);
}

.town-pet {
  position: absolute;
  z-index: 3;
  transform: translate(-50%, -100%);
  transition-property: left, top;
  transition-timing-function: linear;
  pointer-events: auto;
}

.town-pet__name {
  position: absolute;
  left: 50%;
  top: -42rpx;
  transform: translateX(-50%);
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.88);
  color: #1f3551;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.town-pet__shadow {
  position: absolute;
  left: 50%;
  bottom: 24rpx;
  width: 150rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(37, 72, 54, 0.18);
  transform: translateX(-50%);
  filter: blur(3rpx);
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
  width: 100%;
  max-width: 600rpx;
  padding: 32rpx 30rpx 28rpx;
  border-radius: 24rpx;
  background: #fffdf8;
  box-shadow: 0 24rpx 48rpx rgba(15, 23, 42, 0.25);
}

.town-popup__title {
  color: #243047;
  font-size: 34rpx;
  font-weight: 700;
}

.town-popup__description {
  margin-top: 14rpx;
  color: #55657f;
  font-size: 28rpx;
  line-height: 1.6;
}

.town-popup__button {
  margin-top: 26rpx;
  height: 80rpx;
  line-height: 80rpx;
  border: none;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #7c89ff 0%, #9f7dff 100%);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
}

.town-popup__button::after {
  border: none;
}

:deep(.page-shell) {
  bottom: 0;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  min-height: 100vh;
  padding: 0;
  overflow: hidden;
}

:deep(.app-card) {
  width: 100%;
  height: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

:deep(.view-container) {
  width: 100%;
  height: 100%;
  margin-top: 0;
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
    transform: translateX(-50%) scaleX(1);
    opacity: 0.22;
  }
  50% {
    transform: translateX(-50%) scaleX(0.88);
    opacity: 0.14;
  }
}
</style>
