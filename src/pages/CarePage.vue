<script setup lang="ts">
import { computed } from 'vue'
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
const { pet, archive, carePet } = useKokoState()

const growthSteps = [
  { key: 'egg', label: '蛋期' },
  { key: 'baby', label: '幼体' },
  { key: 'growing', label: '成长期' },
  { key: 'adult', label: '成体' },
]

const games = [
  { title: '接球', effect: '提升心情 +6' },
  { title: '拼图', effect: '提升亲密度 +4' },
  { title: '戳泡泡', effect: '演示版作为轻互动入口' },
]

const activeStageIndex = computed(() => growthSteps.findIndex((item) => item.key === pet.value.stage))
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.care.eyebrow }}</view>
        <view>{{ t.care.title }}</view>
      </view>
      <view>{{ t.care.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="eyebrow">{{ t.care.routineLabel }}</view>
        <view>{{ t.care.routineTitle }}</view>
        <view class="action-stack">
          <button class="quick-action-button" @click="carePet('feedMeal')">喂主食</button>
          <button class="quick-action-button" @click="carePet('feedSnack')">喂零食</button>
          <button class="quick-action-button" @click="carePet('clean')">清洁</button>
          <button class="quick-action-button" @click="carePet('heal')">治疗</button>
          <button class="quick-action-button" @click="carePet('rest')">休息</button>
          <button class="quick-action-button" @click="carePet('play')">互动</button>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.care.growthLabel }}</view>
        <view>{{ t.care.growthTitle }}</view>
        <view class="stage-row">
          <view
            v-for="(item, index) in growthSteps"
            :key="item.key"
            class="stage-item"
            :class="{ 'stage-item--active': index <= activeStageIndex }"
          >
            <view>{{ index + 1 }}</view>
            <view>{{ item.label }}</view>
          </view>
        </view>
        <view class="muted-line stage-copy">
          当前阶段：{{ pet.stage }}，亲密度 {{ pet.intimacy }}，继续完成照料和计划可推动下一阶段成长。
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.care.gameLabel }}</view>
        <view>{{ t.care.gameTitle }}</view>
        <view class="card-list">
          <view v-for="game in games" :key="game.title" class="mini-card">
            <view>{{ game.title }}</view>
            <view>{{ game.effect }}</view>
            <button class="profile-shortcut-button" @click="carePet('play')">模拟游玩</button>
          </view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.care.archiveLabel }}</view>
        <view>{{ t.care.archiveTitle }}</view>
        <view class="archive-grid">
          <view v-for="item in archive.milestones.slice(0, 4)" :key="item.id" class="archive-item">
            <view>{{ item.title }}</view>
            <view>{{ item.description }}</view>
            <view class="muted-line">{{ item.timestamp }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
