<script setup lang="ts">
import { useLanguage } from '../composables/useLanguage'

const { t } = useLanguage()
</script>

<template>
  <view class="page-view">
    <view class="page-head">
      <view>
        <view class="eyebrow">{{ t.profile.eyebrow }}</view>
        <view>{{ t.profile.title }}</view>
      </view>
      <view>{{ t.profile.subtitle }}</view>
    </view>

    <view class="page-grid-2">
      <view class="panel-block" v-for="item in t.profile.archiveCards" :key="item.title">
        <view class="eyebrow">{{ item.label }}</view>
        <view>{{ item.title }}</view>
        <view>{{ item.description }}</view>
      </view>

      <view class="panel-block panel-block--full">
        <view class="eyebrow">{{ t.profile.milestoneLabel }}</view>
        <view>{{ t.profile.milestoneTitle }}</view>
        <view class="archive-grid">
          <view class="archive-item" v-for="entry in t.profile.milestones" :key="entry.title">
            <h4>{{ entry.title }}</h4>
            <view>{{ entry.description }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
