<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import StatusCard from '../components/StatusCard.vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'
import type { StatKey } from '../i18n'

const { t } = useLanguage()
const { pet, carePet } = useKokoState()
const showGrowthPopup = ref(false)
const petImageSrc = ref('')

onMounted(() => {
  petImageSrc.value = ['/static', 'pet', '1.png'].join('/')
})

const growthSteps = [
  '蛋期',
  '幼体',
  '成长期',
  '成熟期',
  '守护期',
]

const statColors: Record<StatKey, string> = {
  health: 'var(--mint)',
  mood: 'var(--sun)',
  hunger: 'var(--peach)',
  energy: 'var(--sky)',
  intimacy: 'var(--rose)',
  clean: 'var(--lime)',
}

const statEntries = computed(() => {
  const labels = t.value.stats
  const valueMap: Record<StatKey, number> = {
    health: pet.value.health,
    mood: pet.value.mood,
    hunger: pet.value.hunger,
    energy: pet.value.energy,
    intimacy: pet.value.intimacy,
    clean: pet.value.clean,
  }

  return (Object.keys(valueMap) as StatKey[]).map((key) => ({
    key,
    value: valueMap[key],
    label: labels[key].label,
    hint: labels[key].hint,
    color: statColors[key],
  }))
})

const openPage = (url: string) => {
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">宠物主界面</view>
        <view>首页</view>
      </view>
      <view>今天继续和团子一起成长吧。</view>
    </view>

    <view class="page-grid-2 page-home-stack">
      <view class="hero-card panel-block--full home-pet-card">
        <view class="hero-layout hero-layout--centered">
          <view class="pet-image-frame">
            <image class="home-pet-image" :src="petImageSrc" mode="widthFix" />
          </view>

          <view class="hero-copy hero-copy--centered">
            <view class="eyebrow">我的宠物</view>
            <view>{{ pet.name }} · {{ pet.stage }} · {{ pet.state }}</view>
            <view>圆圆的团子今天软乎乎的，继续陪伴就能慢慢长大。</view>
            <button class="quick-action-button" @click="showGrowthPopup = true">成长阶段</button>
          </view>
        </view>
      </view>

      <view class="panel-block panel-block--full home-attribute-panel">
        <view class="eyebrow">属性概览</view>
        <view>健康、心情、饥饿、精力、亲密度、清洁度</view>
        <view class="stats-grid">
          <StatusCard
            v-for="item in statEntries"
            :key="item.key"
            :label="item.label"
            :value="item.value"
            :hint="item.hint"
            :color="item.color"
          />
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">宠物照料</view>
        <view>日常互动</view>
        <view class="quick-action-grid">
          <button class="quick-action-button" @click="carePet('feedMeal')">喂食</button>
          <button class="quick-action-button" @click="carePet('clean')">清洁</button>
          <button class="quick-action-button" @click="carePet('rest')">打理小窝</button>
          <button class="quick-action-button" @click="carePet('play')">装扮</button>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">生命档案</view>
        <view>记录陪伴轨迹</view>
        <view class="muted-line">查看领养时间、成长阶段、病史和里程碑记录。</view>
        <view class="action-stack">
          <button class="quick-action-button quick-action-button--ghost" @click="openPage('/pages/archive/index')">
            打开生命档案
          </button>
        </view>
      </view>
    </view>

    <view v-if="showGrowthPopup" class="overlay-mask" @click="showGrowthPopup = false">
      <view class="overlay-card" @click.stop>
        <view class="eyebrow">成长路线</view>
        <view>团子成长五阶段</view>
        <view class="stage-row">
          <view v-for="(item, index) in growthSteps" :key="item" class="stage-item stage-item--active">
            <view>{{ index + 1 }}</view>
            <view>{{ item }}</view>
          </view>
        </view>
        <button class="quick-action-button quick-action-button--ghost" @click="showGrowthPopup = false">关闭</button>
      </view>
    </view>
  </view>
</template>
