<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.planner.eyebrow }}</view>
        <view>{{ t.planner.title }}</view>
      </view>
      <view>{{ t.planner.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block">
        <view class="eyebrow">{{ t.planner.createLabel }}</view>
        <view>{{ t.planner.createTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in t.planner.createItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.planner.categoryLabel }}</view>
        <view>{{ t.planner.categoryTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in t.planner.categoryItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.planner.petReminderLabel }}</view>
        <view>{{ t.planner.petReminderTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in t.planner.petReminderItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block">
        <view class="eyebrow">{{ t.planner.rewardLabel }}</view>
        <view>{{ t.planner.rewardTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in t.planner.rewardItems" :key="item">{{ item }}</view>
        </view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.planner.unfinishedLabel }}</view>
        <view>{{ t.planner.unfinishedTitle }}</view>
        <view class="bullet-list">
          <view v-for="item in t.planner.unfinishedItems" :key="item">{{ item }}</view>
        </view>
      </view>
    </view>
  </view>
</template>
