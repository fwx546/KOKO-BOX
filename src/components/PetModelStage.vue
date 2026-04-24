<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PetActionType } from '../types/koko'

const FRAME_COUNT = 16
const STEP_PX = 18

const props = withDefaults(
  defineProps<{
    interactive?: boolean
    initialFrame?: number
    action?: PetActionType
    petName?: string
  }>(),
  {
    interactive: true,
    initialFrame: 0,
    action: 'idle',
    petName: 'Koko',
  },
)

const emit = defineEmits<{
  rotate: [frame: number]
  pettap: []
  dragstart: []
  dragend: [frame: number]
}>()

const normalizeFrame = (value: number) => ((Math.round(value) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT
const currentFrame = ref(normalizeFrame(props.initialFrame))
const dragging = ref(false)

let startX = 0
let movedDistance = 0
let carry = 0

const radian = computed(() => (currentFrame.value / FRAME_COUNT) * Math.PI * 2)
const frontness = computed(() => Math.max(0, Math.cos(radian.value)))
const backness = computed(() => Math.max(0, -Math.cos(radian.value)))
const sideBias = computed(() => Math.sin(radian.value))
const facingRight = computed(() => sideBias.value >= 0)
const widthScale = computed(() => 0.82 + frontness.value * 0.2)
const headShift = computed(() => `${sideBias.value * 32}rpx`)
const tailShift = computed(() => `${sideBias.value * 74}rpx`)
const faceOpacity = computed(() => `${0.16 + frontness.value * 0.84}`)
const backOpacity = computed(() => `${0.08 + backness.value * 0.88}`)
const sideShadowOpacity = computed(() => `${0.12 + Math.abs(sideBias.value) * 0.28}`)
const legSpread = computed(() => `${12 + Math.abs(sideBias.value) * 20}rpx`)
const earTilt = computed(() => 8 + sideBias.value * 12)

const bodyStyle = computed(() => ({
  transform: `translateX(-50%) scaleX(${widthScale.value})`,
}))

const headStyle = computed(() => ({
  transform: `translateX(calc(-50% + ${headShift.value})) scaleX(${0.92 + frontness.value * 0.1})`,
}))

const tailStyle = computed(() => ({
  transform: `translateX(${tailShift.value}) scaleX(${facingRight.value ? 1 : -1})`,
  opacity: `${0.72 + Math.abs(sideBias.value) * 0.28}`,
}))

const faceStyle = computed(() => ({ opacity: faceOpacity.value }))
const backStyle = computed(() => ({ opacity: backOpacity.value }))
const sideShadowStyle = computed(() => ({ opacity: sideShadowOpacity.value }))
const leftLegStyle = computed(() => ({ transform: `translateX(-${legSpread.value})` }))
const rightLegStyle = computed(() => ({ transform: `translateX(${legSpread.value})` }))
const leftEarStyle = computed(() => ({ transform: `rotate(${earTilt.value}deg)` }))
const rightEarStyle = computed(() => ({ transform: `rotate(${-earTilt.value}deg)` }))

const applyDelta = (deltaX: number) => {
  if (!props.interactive) return
  carry += deltaX
  const steps = carry > 0 ? Math.floor(carry / STEP_PX) : Math.ceil(carry / STEP_PX)
  if (steps === 0) return
  carry -= steps * STEP_PX
  currentFrame.value = normalizeFrame(currentFrame.value + steps)
  emit('rotate', currentFrame.value)
}

const beginDrag = (pageX: number) => {
  if (!props.interactive) return
  dragging.value = true
  startX = pageX
  movedDistance = 0
  carry = 0
  emit('dragstart')
}

const moveDrag = (pageX: number) => {
  if (!dragging.value) return
  const delta = pageX - startX
  startX = pageX
  movedDistance += Math.abs(delta)
  applyDelta(delta)
}

const endDrag = () => {
  if (!dragging.value) return
  const wasTap = movedDistance < 10
  dragging.value = false
  carry = 0
  if (wasTap) emit('pettap')
  emit('dragend', currentFrame.value)
}

const touchX = (event: any) => event?.touches?.[0]?.pageX ?? event?.changedTouches?.[0]?.pageX ?? 0

watch(
  () => props.initialFrame,
  (value) => {
    currentFrame.value = normalizeFrame(value)
  },
)
</script>

<template>
  <view
    class="pet-model-stage"
    @touchstart.stop="beginDrag(touchX($event))"
    @touchmove.stop.prevent="moveDrag(touchX($event))"
    @touchend.stop="endDrag"
    @touchcancel.stop="endDrag"
  >
    <view class="pet-model-stage__halo" />
    <view class="pet-model-stage__platform" />
    <view class="pet-model-stage__badge">360</view>
    <view class="pet-model-stage__hint">{{ dragging ? 'Drag to rotate' : 'Swipe left or right' }}</view>

    <view class="pet-faux3d" :class="`pet-faux3d--${action}`">
      <view class="pet-faux3d__shadow" />

      <view class="pet-faux3d__tail" :style="tailStyle">
        <view class="pet-faux3d__tail-core" />
      </view>

      <view class="pet-faux3d__body" :style="bodyStyle">
        <view class="pet-faux3d__body-backmark" :style="backStyle" />
        <view class="pet-faux3d__body-side-shadow" :style="sideShadowStyle" />
        <view class="pet-faux3d__belly" :style="faceStyle" />
        <view class="pet-faux3d__leg pet-faux3d__leg--left" :style="leftLegStyle" />
        <view class="pet-faux3d__leg pet-faux3d__leg--right" :style="rightLegStyle" />
      </view>

      <view class="pet-faux3d__head" :style="headStyle">
        <view class="pet-faux3d__head-backmark" :style="backStyle" />
        <view class="pet-faux3d__ear pet-faux3d__ear--left" :style="leftEarStyle">
          <view class="pet-faux3d__ear-inner" />
        </view>
        <view class="pet-faux3d__ear pet-faux3d__ear--right" :style="rightEarStyle">
          <view class="pet-faux3d__ear-inner" />
        </view>
        <view class="pet-faux3d__face" :style="faceStyle">
          <view class="pet-faux3d__eye pet-faux3d__eye--left" />
          <view class="pet-faux3d__eye pet-faux3d__eye--right" />
          <view class="pet-faux3d__blush pet-faux3d__blush--left" />
          <view class="pet-faux3d__blush pet-faux3d__blush--right" />
          <view class="pet-faux3d__nose" />
          <view class="pet-faux3d__mouth" />
          <view class="pet-faux3d__whiskers pet-faux3d__whiskers--left" />
          <view class="pet-faux3d__whiskers pet-faux3d__whiskers--right" />
        </view>
        <view class="pet-faux3d__collar" :style="faceStyle">
          <view class="pet-faux3d__bell" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.pet-model-stage {
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.pet-model-stage__halo {
  background: radial-gradient(circle, rgba(255, 244, 192, 0.84), rgba(255, 244, 192, 0));
  border-radius: 50%;
  height: 360rpx;
  position: absolute;
  width: 360rpx;
}

.pet-model-stage__platform {
  background: radial-gradient(circle, rgba(81, 138, 77, 0.24), rgba(81, 138, 77, 0));
  border-radius: 50%;
  bottom: 74rpx;
  height: 80rpx;
  position: absolute;
  width: 310rpx;
}

.pet-model-stage__badge,
.pet-model-stage__hint {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 999rpx;
  color: #47667a;
  position: absolute;
}

.pet-model-stage__badge {
  font-size: 22rpx;
  padding: 10rpx 16rpx;
  right: 12rpx;
  top: 12rpx;
}

.pet-model-stage__hint {
  bottom: 10rpx;
  font-size: 21rpx;
  left: 50%;
  padding: 12rpx 22rpx;
  transform: translateX(-50%);
}

.pet-faux3d {
  height: 420rpx;
  position: relative;
  width: 320rpx;
}

.pet-faux3d__shadow {
  background: rgba(59, 100, 67, 0.18);
  border-radius: 50%;
  bottom: 78rpx;
  height: 42rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 210rpx;
}

.pet-faux3d__tail {
  bottom: 156rpx;
  height: 128rpx;
  left: 50%;
  position: absolute;
  width: 58rpx;
}

.pet-faux3d__tail-core {
  background: linear-gradient(180deg, #f9dfae, #efb86d);
  border-radius: 999rpx;
  height: 100%;
  transform: rotate(24deg);
  width: 34rpx;
}

.pet-faux3d__body {
  background: linear-gradient(180deg, #fffbed 0%, #ffeeca 62%, #ffd896 100%);
  border-radius: 48% 48% 42% 42%;
  bottom: 84rpx;
  box-shadow: inset 0 0 0 2rpx rgba(255, 255, 255, 0.34);
  height: 236rpx;
  left: 50%;
  overflow: hidden;
  position: absolute;
  transform: translateX(-50%);
  width: 230rpx;
}

.pet-faux3d__body-backmark,
.pet-faux3d__body-side-shadow {
  inset: 0;
  position: absolute;
}

.pet-faux3d__body-backmark {
  background: radial-gradient(circle at 50% 34%, rgba(236, 185, 110, 0.9), transparent 56%);
}

.pet-faux3d__body-side-shadow {
  background: linear-gradient(90deg, rgba(224, 180, 114, 0.2), transparent 26%, transparent 74%, rgba(224, 180, 114, 0.2));
}

.pet-faux3d__belly {
  background: rgba(255, 252, 242, 0.92);
  border-radius: 44% 44% 40% 40%;
  bottom: 18rpx;
  height: 148rpx;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 138rpx;
}

.pet-faux3d__leg {
  background: linear-gradient(180deg, #ffe7b6, #f8c97e);
  border-radius: 28rpx;
  bottom: -4rpx;
  height: 66rpx;
  left: 50%;
  position: absolute;
  width: 34rpx;
}

.pet-faux3d__head {
  background: linear-gradient(180deg, #fffdf1 0%, #ffe8b5 100%);
  border-radius: 44% 44% 40% 40%;
  box-shadow: inset 0 0 0 2rpx rgba(255, 255, 255, 0.34);
  height: 168rpx;
  left: 50%;
  overflow: hidden;
  position: absolute;
  top: 66rpx;
  transform: translateX(-50%);
  width: 170rpx;
}

.pet-faux3d__head-backmark {
  background: radial-gradient(circle at 50% 34%, rgba(236, 185, 110, 0.8), transparent 52%);
  inset: 0;
  position: absolute;
}

.pet-faux3d__ear {
  background: linear-gradient(180deg, #ffefc3, #ffd38c);
  border-radius: 34rpx 34rpx 12rpx 12rpx;
  height: 60rpx;
  position: absolute;
  top: -24rpx;
  width: 40rpx;
}

.pet-faux3d__ear--left {
  left: 24rpx;
}

.pet-faux3d__ear--right {
  right: 24rpx;
}

.pet-faux3d__ear-inner {
  background: rgba(255, 170, 170, 0.54);
  border-radius: 28rpx;
  bottom: 10rpx;
  left: 8rpx;
  position: absolute;
  right: 8rpx;
  top: 10rpx;
}

.pet-faux3d__face,
.pet-faux3d__collar {
  position: absolute;
}

.pet-faux3d__face {
  inset: 0;
}

.pet-faux3d__eye {
  background: #58473a;
  border-radius: 999rpx;
  height: 16rpx;
  position: absolute;
  top: 56rpx;
  width: 12rpx;
}

.pet-faux3d__eye--left {
  left: 44rpx;
}

.pet-faux3d__eye--right {
  right: 44rpx;
}

.pet-faux3d__blush {
  background: rgba(255, 165, 165, 0.48);
  border-radius: 999rpx;
  height: 22rpx;
  position: absolute;
  top: 78rpx;
  width: 28rpx;
}

.pet-faux3d__blush--left {
  left: 22rpx;
}

.pet-faux3d__blush--right {
  right: 22rpx;
}

.pet-faux3d__nose {
  background: #ffab83;
  border-radius: 12rpx;
  height: 16rpx;
  left: 50%;
  position: absolute;
  top: 74rpx;
  transform: translateX(-50%);
  width: 18rpx;
}

.pet-faux3d__mouth {
  border-bottom: 4rpx solid #8f6950;
  border-radius: 0 0 36rpx 36rpx;
  height: 18rpx;
  left: 50%;
  position: absolute;
  top: 96rpx;
  transform: translateX(-50%);
  width: 34rpx;
}

.pet-faux3d__whiskers {
  border-top: 3rpx solid rgba(113, 95, 83, 0.42);
  position: absolute;
  top: 92rpx;
  width: 34rpx;
}

.pet-faux3d__whiskers--left {
  left: 10rpx;
  transform: rotate(6deg);
}

.pet-faux3d__whiskers--right {
  right: 10rpx;
  transform: rotate(-6deg);
}

.pet-faux3d__collar {
  background: linear-gradient(90deg, #8ed6f1, #57b8e8);
  border-radius: 999rpx;
  bottom: 14rpx;
  height: 18rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 98rpx;
}

.pet-faux3d__bell {
  background: linear-gradient(180deg, #ffd86f, #f9a742);
  border-radius: 50%;
  height: 22rpx;
  left: 50%;
  position: absolute;
  top: 10rpx;
  transform: translateX(-50%);
  width: 22rpx;
}

.pet-faux3d--idle .pet-faux3d__body,
.pet-faux3d--idle .pet-faux3d__head {
  animation: pet-float 2.6s ease-in-out infinite;
}

.pet-faux3d--idle .pet-faux3d__tail-core,
.pet-faux3d--chase .pet-faux3d__tail-core {
  animation: pet-tail 1.2s ease-in-out infinite;
}

.pet-faux3d--greet .pet-faux3d__head,
.pet-faux3d--nuzzle .pet-faux3d__head {
  animation: pet-nuzzle 0.7s ease-in-out infinite alternate;
}

.pet-faux3d--pounce {
  animation: pet-bounce 0.5s ease-in-out infinite alternate;
}

.pet-faux3d--spin {
  animation: pet-spin 0.9s ease-in-out 1;
}

.pet-faux3d--stretch .pet-faux3d__body {
  animation: pet-stretch 0.8s ease-in-out infinite alternate;
}

.pet-faux3d--munch .pet-faux3d__mouth {
  animation: pet-mouth 0.34s ease-in-out infinite;
}

.pet-faux3d--sip .pet-faux3d__head {
  animation: pet-sip 0.82s ease-in-out infinite;
}

.pet-faux3d--sparkle .pet-faux3d__body,
.pet-faux3d--sparkle .pet-faux3d__head {
  animation: pet-float 1.2s ease-in-out infinite;
}

@keyframes pet-float {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-10rpx);
  }
}

@keyframes pet-tail {
  0%,
  100% {
    transform: rotate(16deg);
  }
  50% {
    transform: rotate(40deg);
  }
}

@keyframes pet-nuzzle {
  from {
    transform: translateX(-50%) rotate(-2deg);
  }
  to {
    transform: translateX(-50%) rotate(2deg);
  }
}

@keyframes pet-bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-20rpx);
  }
}

@keyframes pet-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pet-stretch {
  from {
    transform: translateX(-50%) scaleY(1);
  }
  to {
    transform: translateX(-50%) scaleY(1.04);
  }
}

@keyframes pet-mouth {
  0%,
  100% {
    transform: translateX(-50%) scaleX(1);
  }
  50% {
    transform: translateX(-50%) scaleX(0.7);
  }
}

@keyframes pet-sip {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(8rpx);
  }
}
</style>
