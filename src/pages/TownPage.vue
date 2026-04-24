<script setup lang="ts">
import { ref } from 'vue'

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
const townMapSrc = '/static/town/map.webp'

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

const hotspotStyle = (spot: BuildingHotspot) =>
  `left:${(spot.x / MAP_WIDTH) * 100}%;top:${(spot.y / MAP_HEIGHT) * 100}%;width:${(spot.width / MAP_WIDTH) * 100}%;height:${(spot.height / MAP_HEIGHT) * 100}%;`

const openBuildingPopup = (spot: BuildingHotspot) => {
  activeBuilding.value = spot
}

const closeBuildingPopup = () => {
  activeBuilding.value = null
}
</script>

<template>
  <view class="town-page">
    <view class="town-map-wrap">
      <view class="town-map">
        <image class="town-map__image" :src="townMapSrc" mode="scaleToFill" />

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
  position: fixed;
  inset: 0;
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
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: rgba(15, 23, 42, 0.52);
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
  position: fixed;
  inset: 0;
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
</style>
