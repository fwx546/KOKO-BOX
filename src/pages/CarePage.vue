<script setup lang="ts">
import { computed } from 'vue'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()

const growthStages = ['Egg', 'Baby', 'Growing', 'Adult', 'Special']
const miniGames = computed(() => ['Hide & Seek', 'Catch Ball', 'Puzzle'])
const dailyItems = computed(() => t.value.care.dailyCareItems.slice(0, 5))
const milestoneItems = computed(() => t.value.care.lifeArchiveItems.slice(0, 3))
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
      <view class="panel-block panel-block--full">
        <view class="eyebrow">Growth Stage</view>
        <view>Life progression</view>
        <view class="stage-row">
          <view v-for="(stage, index) in growthStages" :key="stage" class="stage-item">
            <view>{{ index + 1 }}</view>
            <view>{{ stage }}</view>
          </view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.care.dailyCareLabel }}</view>
        <view>{{ t.care.dailyCareTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in dailyItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">Mini Games</view>
        <view>Lightweight interaction</view>
        <view class="pill-row">
          <button v-for="game in miniGames" :key="game" class="quick-action-button">{{ game }}</button>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.care.lifeArchiveLabel }}</view>
        <view>{{ t.care.lifeArchiveTitle }}</view>
        <view class="archive-grid">
          <view v-for="item in milestoneItems" :key="item.title" class="archive-item">
            <h4>{{ item.title }}</h4>
            <view>{{ item.description }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
