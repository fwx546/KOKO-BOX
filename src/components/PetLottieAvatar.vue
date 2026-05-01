<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import lottie from 'lottie-miniprogram'
import angryDogAnimation from '../assets/animations/angry-dog.json'
import happyDogAnimation from '../assets/animations/happy-dog.json'

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

const componentInstance = getCurrentInstance()
const canvasId = `pet-lottie-${Math.random().toString(36).slice(2, 10)}`
const avatarSizeStyle = computed(() => ({
  width: `${props.sizeRpx}rpx`,
  height: `${props.sizeRpx}rpx`,
}))
const wrapperStyle = computed(() => ({
  width: `${props.sizeRpx}rpx`,
  height: `${props.sizeRpx}rpx`,
  transform: `scaleX(${props.mirror ? -1 : 1})`,
}))
const animationData = computed(() => (props.variant === 'angry' ? angryDogAnimation : happyDogAnimation))

type LottieInstance = {
  destroy?: () => void
  goToAndStop?: (value: number, isFrame?: boolean) => void
  stop?: () => void
  addEventListener?: (event: string, handler: () => void) => void
  removeEventListener?: (event: string, handler: () => void) => void
} | null

let lottieInstance: LottieInstance = null
let onComplete: (() => void) | undefined

const destroyLottie = () => {
  if (onComplete && lottieInstance?.removeEventListener) {
    lottieInstance.removeEventListener('complete', onComplete)
  }
  onComplete = undefined
  lottieInstance?.destroy?.()
  lottieInstance = null
}

const initPetLottie = () => {
  return new Promise<void>((resolve) => {
    if (props.paused) {
      destroyLottie()
      resolve()
      return
    }

    const query = uni.createSelectorQuery()
    const scope = componentInstance?.proxy
    if (scope) query.in(scope)

    query
      .select(`#${canvasId}`)
      .fields({ node: true, size: true }, (result: any) => {
        const canvas = result?.node
        if (!canvas) {
          resolve()
          return
        }

        const context = canvas.getContext('2d')
        if (!context) {
          resolve()
          return
        }

        const windowInfo = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : undefined
        const dpr = windowInfo?.pixelRatio ?? 1
        const width = Number(result?.width ?? 0)
        const height = Number(result?.height ?? 0)
        const fallbackSizePx = uni.upx2px(props.sizeRpx)
        const finalWidth = width > 0 ? width : fallbackSizePx
        const finalHeight = height > 0 ? height : fallbackSizePx

        canvas.width = finalWidth * dpr
        canvas.height = finalHeight * dpr
        if (canvas.style) {
          canvas.style.width = `${finalWidth}px`
          canvas.style.height = `${finalHeight}px`
        }
        context.scale(dpr, dpr)

        destroyLottie()
        lottie.setup(canvas)
        lottieInstance = lottie.loadAnimation({
          loop: props.loop,
          autoplay: !props.still,
          animationData: animationData.value,
          rendererSettings: {
            context,
            preserveAspectRatio: 'xMidYMid meet',
          },
        })

        if (props.still) {
          lottieInstance?.goToAndStop?.(12, true)
          lottieInstance?.stop?.()
          resolve()
          return
        }

        if (!props.loop && lottieInstance?.addEventListener) {
          onComplete = () => {
            destroyLottie()
            emit('complete')
          }
          lottieInstance.addEventListener('complete', onComplete)
        }

        resolve()
      })
      .exec()
  })
}

watch(
  () => [props.paused, props.sizeRpx, props.still, props.loop, props.variant],
  async () => {
    await nextTick()
    await initPetLottie()
  },
)

onMounted(async () => {
  await nextTick()
  await initPetLottie()
})

onBeforeUnmount(() => {
  destroyLottie()
})
</script>

<template>
  <view class="pet-lottie-avatar" :style="wrapperStyle">
    <canvas
      :id="canvasId"
      :canvas-id="canvasId"
      type="2d"
      class="pet-lottie-avatar__canvas"
      :style="avatarSizeStyle"
    />
  </view>
</template>

<style scoped>
.pet-lottie-avatar {
  align-items: center;
  display: flex;
  justify-content: center;
  position: relative;
}

.pet-lottie-avatar__canvas {
  display: block;
  height: 100%;
  left: 0;
  position: absolute;
  top: 0;
  width: 100%;
}
</style>
