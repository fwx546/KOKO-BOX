<script setup lang="ts">
import { computed } from 'vue'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()

const coreCards = computed(() => t.value.statsPage.overviewCards.slice(0, 3))
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.statsPage.eyebrow }}</view>
        <view>{{ t.statsPage.title }}</view>
      </view>
      <view>{{ t.statsPage.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block" v-for="card in coreCards" :key="card.title">
        <view class="eyebrow">{{ card.label }}</view>
        <view>{{ card.title }}</view>
        <view class="compact-kpi">{{ card.value }}</view>
        <view class="muted-line">{{ card.hint }}</view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.statsPage.trendLabel }}</view>
        <view>{{ t.statsPage.trendTitle }}</view>
        <view class="pill-row">
          <button class="quick-action-button" v-for="range in t.statsPage.ranges.slice(0, 2)" :key="range">{{ range }}</button>
        </view>
        <view class="chart-placeholder">
          <view>{{ t.statsPage.chartPlaceholder }}</view>
        </view>
      </view>
    </view>
  </view>
</template>
