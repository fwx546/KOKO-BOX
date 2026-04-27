<script setup lang="ts">
import { useKokoState } from '../composables/useKokoState'
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
const { overviewStats, snapshots, metrics, weeklyCompletionRate } = useKokoState()
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
      <view class="panel-block" v-for="card in overviewStats" :key="card.key">
        <view class="eyebrow">{{ t.statsPage.overviewLabel }}</view>
        <view>{{ card.label }}</view>
        <view class="compact-kpi">{{ card.value }}</view>
        <view class="muted-line">{{ card.hint }}</view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.statsPage.metricLabel }}</view>
        <view>{{ t.statsPage.metricTitle }}</view>
        <view class="bullet-list">
          <view>{{ t.statsPage.interactions }}: {{ metrics.interactions }}</view>
          <view>{{ t.statsPage.companionMinutes }}: {{ metrics.companionMinutes }} {{ t.statsPage.minutes }}</view>
          <view>{{ t.statsPage.completedTasks }}: {{ metrics.completedTasks }}</view>
          <view>{{ t.statsPage.currentCompletionRate }}: {{ weeklyCompletionRate }}%</view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.statsPage.trendLabel }}</view>
        <view>{{ t.statsPage.trendTitle }}</view>
        <view class="trend-grid">
          <view v-for="item in snapshots" :key="item.id" class="trend-card">
            <view>{{ item.label }}</view>
            <view>{{ t.statsPage.mood }} {{ item.mood }}</view>
            <view>{{ t.statsPage.intimacy }} {{ item.intimacy }}</view>
            <view>{{ t.statsPage.completionRate }} {{ item.completionRate }}%</view>
            <view>{{ t.statsPage.interactions }} {{ item.interactions }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
