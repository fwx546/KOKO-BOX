<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'

type PetVariant = 'happy' | 'angry'

const emit = defineEmits<{
  (event: 'complete'): void
}>()

const props = withDefaults(
  defineProps<{
    sizeRpx?: number
    paused?: boolean
    still?: boolean
    mirror?: boolean
    variant?: PetVariant
    loop?: boolean
  }>(),
  {
    sizeRpx: 600,
    paused: false,
    still: false,
    mirror: false,
    variant: 'happy',
    loop: true,
  },
)

let completeTimer: ReturnType<typeof setTimeout> | undefined

const wrapperStyle = computed(() => ({
  width: `${props.sizeRpx}rpx`,
  height: `${props.sizeRpx}rpx`,
  transform: `scaleX(${props.mirror ? -1 : 1})`,
}))

const avatarClass = computed(() => [
  'pet-lottie-avatar',
  `pet-lottie-avatar--${props.variant}`,
  {
    'pet-lottie-avatar--still': props.still,
    'pet-lottie-avatar--paused': props.paused,
    'pet-lottie-avatar--one-shot': !props.loop,
  },
])

const clearCompleteTimer = () => {
  if (completeTimer) {
    clearTimeout(completeTimer)
    completeTimer = undefined
  }
}

const scheduleComplete = () => {
  clearCompleteTimer()

  if (props.paused || props.still || props.loop || props.variant !== 'angry') return

  completeTimer = setTimeout(() => {
    completeTimer = undefined
    emit('complete')
  }, 1280)
}

watch(
  () => [props.paused, props.still, props.loop, props.variant],
  scheduleComplete,
  { immediate: true },
)

onBeforeUnmount(() => {
  clearCompleteTimer()
})
</script>

<template>
  <view :class="avatarClass" :style="wrapperStyle" aria-hidden="true">
    <view class="pet-lottie-avatar__tail" />
    <view class="pet-lottie-avatar__body">
      <view class="pet-lottie-avatar__belly" />
      <view class="pet-lottie-avatar__paw pet-lottie-avatar__paw--left" />
      <view class="pet-lottie-avatar__paw pet-lottie-avatar__paw--right" />
    </view>
    <view class="pet-lottie-avatar__head">
      <view class="pet-lottie-avatar__ear pet-lottie-avatar__ear--left" />
      <view class="pet-lottie-avatar__ear pet-lottie-avatar__ear--right" />
      <view class="pet-lottie-avatar__muzzle">
        <view class="pet-lottie-avatar__nose" />
        <view class="pet-lottie-avatar__mouth" />
        <view class="pet-lottie-avatar__tongue" />
      </view>
      <view class="pet-lottie-avatar__eye pet-lottie-avatar__eye--left" />
      <view class="pet-lottie-avatar__eye pet-lottie-avatar__eye--right" />
      <view class="pet-lottie-avatar__brow pet-lottie-avatar__brow--left" />
      <view class="pet-lottie-avatar__brow pet-lottie-avatar__brow--right" />
      <view class="pet-lottie-avatar__cheek pet-lottie-avatar__cheek--left" />
      <view class="pet-lottie-avatar__cheek pet-lottie-avatar__cheek--right" />
    </view>
    <view class="pet-lottie-avatar__bandana" />
    <view class="pet-lottie-avatar__anger pet-lottie-avatar__anger--left" />
    <view class="pet-lottie-avatar__anger pet-lottie-avatar__anger--right" />
  </view>
</template>

<style scoped>
.pet-lottie-avatar {
  height: 100%;
  position: relative;
  transform-origin: center;
  width: 100%;
}

.pet-lottie-avatar--paused {
  opacity: 0;
}

.pet-lottie-avatar--still .pet-lottie-avatar__body,
.pet-lottie-avatar--still .pet-lottie-avatar__tail,
.pet-lottie-avatar--still .pet-lottie-avatar__head,
.pet-lottie-avatar--still .pet-lottie-avatar__eye,
.pet-lottie-avatar--still .pet-lottie-avatar__tongue,
.pet-lottie-avatar--still.pet-lottie-avatar--angry,
.pet-lottie-avatar--paused .pet-lottie-avatar__body,
.pet-lottie-avatar--paused .pet-lottie-avatar__tail,
.pet-lottie-avatar--paused .pet-lottie-avatar__head,
.pet-lottie-avatar--paused .pet-lottie-avatar__eye,
.pet-lottie-avatar--paused .pet-lottie-avatar__tongue,
.pet-lottie-avatar--paused.pet-lottie-avatar--angry {
  animation-play-state: paused !important;
}

.pet-lottie-avatar__body {
  animation: koko-body-breathe 2.4s ease-in-out infinite;
  background: #ffc04a;
  border: 4rpx solid #a34c0f;
  border-radius: 47% 47% 42% 42%;
  bottom: 8%;
  height: 42%;
  left: 22%;
  overflow: hidden;
  position: absolute;
  width: 56%;
  z-index: 2;
}

.pet-lottie-avatar__belly {
  background: #fff2d8;
  border-radius: 50% 50% 42% 42%;
  bottom: -1%;
  height: 70%;
  left: 29%;
  position: absolute;
  width: 42%;
}

.pet-lottie-avatar__paw {
  background: #ffe0a2;
  border: 3rpx solid #a34c0f;
  border-radius: 50%;
  bottom: 0;
  height: 17%;
  position: absolute;
  width: 15%;
}

.pet-lottie-avatar__paw--left {
  left: 30%;
}

.pet-lottie-avatar__paw--right {
  right: 30%;
}

.pet-lottie-avatar__tail {
  animation: koko-tail-wag 0.72s ease-in-out infinite;
  background: #ffc04a;
  border: 4rpx solid #a34c0f;
  border-radius: 60% 35% 55% 45%;
  bottom: 22%;
  height: 28%;
  position: absolute;
  right: 10%;
  transform: rotate(24deg);
  transform-origin: 12% 78%;
  width: 26%;
  z-index: 1;
}

.pet-lottie-avatar__head {
  animation: koko-head-bob 2.1s ease-in-out infinite;
  background: #ffc04a;
  border: 4rpx solid #a34c0f;
  border-radius: 46% 46% 44% 44%;
  height: 46%;
  left: 21%;
  position: absolute;
  top: 12%;
  width: 58%;
  z-index: 4;
}

.pet-lottie-avatar__ear {
  background: #ffc04a;
  border: 4rpx solid #a34c0f;
  border-radius: 18% 82% 24% 76%;
  height: 34%;
  position: absolute;
  top: -18%;
  width: 25%;
  z-index: -1;
}

.pet-lottie-avatar__ear::after {
  background: #ffdf9a;
  border-radius: 20% 80% 24% 76%;
  content: '';
  height: 58%;
  left: 21%;
  position: absolute;
  top: 24%;
  width: 54%;
}

.pet-lottie-avatar__ear--left {
  left: 6%;
  transform: rotate(-15deg);
}

.pet-lottie-avatar__ear--right {
  right: 6%;
  transform: scaleX(-1) rotate(-15deg);
}

.pet-lottie-avatar__eye {
  animation: koko-blink 4s ease-in-out infinite;
  background: #3f210d;
  border-radius: 50%;
  height: 8%;
  position: absolute;
  top: 42%;
  width: 13%;
}

.pet-lottie-avatar__eye--left {
  left: 27%;
}

.pet-lottie-avatar__eye--right {
  right: 27%;
}

.pet-lottie-avatar__cheek {
  background: #fff1cf;
  border-radius: 50%;
  height: 47%;
  opacity: 0.9;
  position: absolute;
  top: 46%;
  width: 37%;
}

.pet-lottie-avatar__cheek--left {
  left: 10%;
}

.pet-lottie-avatar__cheek--right {
  right: 10%;
}

.pet-lottie-avatar__muzzle {
  background: #fff4dc;
  border-radius: 52% 52% 48% 48%;
  height: 30%;
  left: 31%;
  position: absolute;
  top: 50%;
  width: 38%;
  z-index: 3;
}

.pet-lottie-avatar__nose {
  background: #3f210d;
  border-radius: 52% 52% 58% 58%;
  height: 22%;
  left: 38%;
  position: absolute;
  top: 13%;
  width: 24%;
}

.pet-lottie-avatar__mouth {
  border-bottom: 3rpx solid #3f210d;
  border-radius: 0 0 50% 50%;
  height: 20%;
  left: 31%;
  position: absolute;
  top: 34%;
  width: 38%;
}

.pet-lottie-avatar__tongue {
  animation: koko-tongue 1.1s ease-in-out infinite;
  background: #ff7d62;
  border: 2rpx solid #a34c0f;
  border-radius: 50% 50% 45% 45%;
  height: 28%;
  left: 39%;
  position: absolute;
  top: 46%;
  width: 22%;
}

.pet-lottie-avatar__bandana {
  background: #ff8d63;
  border: 3rpx solid #a93b22;
  border-radius: 12% 12% 45% 45%;
  height: 21%;
  left: 29%;
  position: absolute;
  top: 48%;
  transform: rotate(45deg);
  width: 42%;
  z-index: 5;
}

.pet-lottie-avatar__brow {
  background: #8f3d12;
  border-radius: 999px;
  height: 3.5%;
  opacity: 0;
  position: absolute;
  top: 33%;
  width: 16%;
  z-index: 6;
}

.pet-lottie-avatar__brow--left {
  left: 23%;
  transform: rotate(17deg);
}

.pet-lottie-avatar__brow--right {
  right: 23%;
  transform: rotate(-17deg);
}

.pet-lottie-avatar__anger {
  border: 3rpx solid #ef7e52;
  border-left: 0;
  border-radius: 50%;
  height: 12%;
  opacity: 0;
  position: absolute;
  top: 12%;
  width: 10%;
  z-index: 7;
}

.pet-lottie-avatar__anger--left {
  left: 8%;
  transform: rotate(-35deg);
}

.pet-lottie-avatar__anger--right {
  right: 8%;
  transform: scaleX(-1) rotate(-35deg);
}

.pet-lottie-avatar--angry {
  animation: koko-angry-shake 0.18s linear infinite;
}

.pet-lottie-avatar--angry .pet-lottie-avatar__brow,
.pet-lottie-avatar--angry .pet-lottie-avatar__anger {
  opacity: 1;
}

.pet-lottie-avatar--angry .pet-lottie-avatar__tongue {
  opacity: 0;
}

.pet-lottie-avatar--angry .pet-lottie-avatar__mouth {
  border-bottom-width: 2rpx;
  transform: rotate(180deg) translateY(-18%);
}

.pet-lottie-avatar--one-shot.pet-lottie-avatar--angry {
  animation: koko-angry-pop 1.2s ease-in-out 1;
}

@keyframes koko-tail-wag {
  0%,
  100% {
    transform: rotate(18deg);
  }

  50% {
    transform: rotate(38deg);
  }
}

@keyframes koko-body-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  50% {
    transform: translateY(1.5%) scale(1.018);
  }
}

@keyframes koko-head-bob {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(-2%) rotate(-1.2deg);
  }
}

@keyframes koko-blink {
  0%,
  92%,
  100% {
    transform: scaleY(1);
  }

  96% {
    transform: scaleY(0.18);
  }
}

@keyframes koko-tongue {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(9%);
  }
}

@keyframes koko-angry-shake {
  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-1.2%);
  }

  75% {
    transform: translateX(1.2%);
  }
}

@keyframes koko-angry-pop {
  0% {
    transform: scale(0.96) rotate(-1deg);
  }

  35% {
    transform: scale(1.04) rotate(1deg);
  }

  70% {
    transform: scale(1) rotate(-0.5deg);
  }

  100% {
    transform: scale(1);
  }
}
</style>
