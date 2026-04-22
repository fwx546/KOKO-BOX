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
          <view>互动次数：{{ metrics.interactions }}</view>
          <view>陪伴时长：{{ metrics.companionMinutes }} 分钟</view>
          <view>累计完成任务：{{ metrics.completedTasks }}</view>
          <view>当前完成率：{{ weeklyCompletionRate }}%</view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.statsPage.trendLabel }}</view>
        <view>{{ t.statsPage.trendTitle }}</view>
        <view class="trend-grid">
          <view v-for="item in snapshots" :key="item.id" class="trend-card">
            <view>{{ item.label }}</view>
            <view>心情 {{ item.mood }}</view>
            <view>亲密 {{ item.intimacy }}</view>
            <view>完成率 {{ item.completionRate }}%</view>
            <view>互动 {{ item.interactions }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
