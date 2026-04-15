<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
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
      <view class="panel-block" v-for="card in t.statsPage.overviewCards" :key="card.title">
        <view class="eyebrow">{{ card.label }}</view>
        <view>{{ card.title }}</view>
        <view>{{ card.value }}</view>
        <view>{{ card.hint }}</view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="section-head section-head--compact">
          <view>
            <view class="eyebrow">{{ t.statsPage.trendLabel }}</view>
            <view>{{ t.statsPage.trendTitle }}</view>
          </view>
          <view class="pill-row">
            <button class="quick-action-button" v-for="range in t.statsPage.ranges" :key="range">{{ range }}</button>
          </view>
        </view>
        <view class="chart-placeholder">
          <view>{{ t.statsPage.chartPlaceholder }}</view>
        </view>
      </view>
    </view>
  </view>
</template>
